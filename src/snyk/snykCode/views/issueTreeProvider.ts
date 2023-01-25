import _ from 'lodash';
import { OpenCommandIssueType } from '../../common/commands/types';
import { IConfiguration } from '../../common/configuration/configuration';
import { SNYK_OPEN_ISSUE_COMMAND } from '../../common/constants/commands';
import { IssueSeverity } from '../../common/languageServer/types';
import { messages as commonMessages } from '../../common/messages/analysisMessages';
import { IContextService } from '../../common/services/contextService';
import { AnalysisTreeNodeProvder } from '../../common/views/analysisTreeNodeProvider';
import { INodeIcon, NODE_ICONS, TreeNode } from '../../common/views/treeNode';
import { Command } from '../../common/vscode/types';
import { ISnykCodeService } from '../codeService';
import { messages } from '../messages/analysis';
import { CodeIssueCommandArg } from './interfaces';

interface ISeverityCounts {
  [severity: string]: number;
}

export class IssueTreeProvider extends AnalysisTreeNodeProvder {
  constructor(
    protected readonly contextService: IContextService,
    protected readonly codeService: ISnykCodeService,
    protected readonly configuration: IConfiguration,
  ) {
    super(configuration, codeService);
  }

  static getSeverityIcon(severity: IssueSeverity | string): INodeIcon {
    return (
      {
        [IssueSeverity.Critical]: NODE_ICONS.critical,
        [IssueSeverity.High]: NODE_ICONS.high,
        [IssueSeverity.Medium]: NODE_ICONS.medium,
        [IssueSeverity.Low]: NODE_ICONS.low,
      }[severity] || NODE_ICONS.low
    );
  }

  getRootChildren(): TreeNode[] {
    const nodes: TreeNode[] = [];

    if (!this.contextService.shouldShowCodeAnalysis) return nodes;
    if (!this.codeService.isLsDownloadSuccessful) {
      return [this.getErrorEncounteredTreeNode()];
    }
    if (!this.codeService.isAnyWorkspaceFolderTrusted) {
      return [this.getNoWorkspaceTrustTreeNode()];
    }
    if (this.codeService.isAnalysisRunning) {
      return [
        new TreeNode({
          text: commonMessages.scanRunning,
        }),
      ];
    }

    if (this.codeService.result.size <= 0) {
      return [
        new TreeNode({
          text: messages.runTest,
        }),
      ];
    }

    // todo: draw vulnerabilities tree [folder->file->vulnerabilities]
    const [resultNodes, nIssues] = this.getResultNodes();
    nodes.push(...resultNodes);

    nodes.sort(this.compareNodes);

    const topNodes = [
      new TreeNode({
        text: this.getIssueFoundText(nIssues),
      }),
      this.getDurationTreeNode(),
      this.getNoSeverityFiltersSelectedTreeNode(),
    ];
    nodes.unshift(...topNodes.filter((n): n is TreeNode => n !== null));
    return nodes;
  }

  getResultNodes(): [TreeNode[], number] {
    // if single folder, don't create a parent node

    const nodes: TreeNode[] = [];
    let totalVulnCount = 0;

    for (const result of this.codeService.result.entries()) {
      const folderPath = result[0];
      const folderResult = result[1];
      if (folderResult instanceof Error) {
        nodes.push(this.getErrorEncounteredTreeNode(folderPath));
        continue;
      }

      const counts = this.initSeverityCounts();
      const fileNodes: TreeNode[] = [];

      const fileVulns = _.groupBy(folderResult, v => v.filePath);

      for (const file in fileVulns) {
        const fileIssues = fileVulns[file];
        const filePath = file.split('/');
        const filename = filePath.pop() || file;
        const dir = filePath.pop();

        const counts = this.initSeverityCounts();

        const issueNodes = fileIssues.map(issue => {
          counts[issue.severity] += 1;
          const params: {
            text: string;
            icon: INodeIcon;
            issue: { filePath: string; range?: Range }; // todo: where is Uri & Range used?
            internal: { severity: string };
            command: Command;
            children?: TreeNode[];
          } = {
            text: issue.additionalData.message,
            icon: IssueTreeProvider.getSeverityIcon(issue.severity),
            issue: {
              filePath: issue.filePath,
              range: issue.range,
            },
            internal: {
              severity: issue.severity,
            },
            command: {
              command: SNYK_OPEN_ISSUE_COMMAND,
              title: '',
              arguments: [
                {
                  issueType: OpenCommandIssueType.CodeIssue,
                  issue: {
                    message: issue.additionalData.message,
                    uri: uri,
                    range: issue.range,
                    diagnostic: issue,
                  } as CodeIssueCommandArg,
                } as OpenIssueCommandArg,
              ],
            },
          };
          return new TreeNode(params);
        });

        const fileSeverity = IssueTreeProvider.getHighestSeverity(counts);

        // append file node
        const fileNode = new TreeNode({
          text: filename,
          description: this.getIssueDescriptionText(dir, fileIssues),
          icon: IssueTreeProvider.getSeverityIcon(fileSeverity),
          children: issueNodes,
          internal: {
            nIssues: fileIssues.length,
            severity: fileSeverity, // where severity is used?
          },
        });
        fileNodes.push(fileNode);
      }

      const folderSeverity = IssueTreeProvider.getHighestSeverity(counts);

      const folderNode = new TreeNode({
        text: folderPath,
        description: this.getIssueDescriptionText(folderPath, fileNodes),
        icon: IssueTreeProvider.getSeverityIcon(folderSeverity),
        children: fileNodes,
        internal: {
          nIssues: fileNodes.length,
          // severity: OssVulnerabilityTreeProvider.getSeverityComparatorIndex(fileSeverity), // todo: is it used to sort folder nodes?
        },
      });

      nodes.push(folderNode);
    }
  }

  protected getIssueFoundText(nIssues: number): string {
    return `Snyk found ${!nIssues ? 'no issues! ✅' : `${nIssues} issue${nIssues === 1 ? '' : 's'}`}`;
  }

  protected getIssueDescriptionText(dir: string | undefined, diagnostics: readonly unknown[]): string | undefined {
    return `${dir} - ${diagnostics.length} issue${diagnostics.length === 1 ? '' : 's'}`;
  }

  // todo: remove after OSS scans migration to LS
  protected getFilteredIssues(diagnostics: readonly unknown[]): readonly unknown[] {
    // Diagnostics are already filtered by the analyzer
    return diagnostics;
  }

  static getHighestSeverity(counts: ISeverityCounts): IssueSeverity {
    for (const s of [IssueSeverity.Critical, IssueSeverity.High, IssueSeverity.Medium, IssueSeverity.Low]) {
      if (counts[s]) return s;
    }

    return IssueSeverity.Low;
  }

  private initSeverityCounts(): ISeverityCounts {
    return {
      [IssueSeverity.Critical]: 0,
      [IssueSeverity.High]: 0,
      [IssueSeverity.Medium]: 0,
      [IssueSeverity.Low]: 0,
    };
  }
}
