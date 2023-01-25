import _ from 'lodash';
import * as vscode from 'vscode'; // todo: invert dependency
import { IConfiguration } from '../../common/configuration/configuration';
import { SNYK_OPEN_ISSUE_COMMAND } from '../../common/constants/commands';
import { IssueSeverity } from '../../common/languageServer/types';
import { messages as commonMessages } from '../../common/messages/analysisMessages';
import { IContextService } from '../../common/services/contextService';
import { AnalysisTreeNodeProvder } from '../../common/views/analysisTreeNodeProvider';
import { INodeIcon, InternalType, NODE_ICONS, TreeNode } from '../../common/views/treeNode';
import { Command } from '../../common/vscode/types';
import { ISnykCodeService } from '../codeService';
import { messages } from '../messages/analysis';

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
    // TODO: if single workspace folder, don't create a parent node

    const nodes: TreeNode[] = [];
    let totalVulnCount = 0;

    for (const result of this.codeService.result.entries()) {
      const folderPath = result[0];
      const folderResult = result[1];
      let folderVulnCount = 0;
      if (folderResult instanceof Error) {
        nodes.push(this.getErrorEncounteredTreeNode(folderPath));
        continue;
      }

      const folderSeverityCounts = this.initSeverityCounts();
      const fileNodes: TreeNode[] = [];

      const fileVulns = _.groupBy(folderResult, v => v.filePath);

      for (const file in fileVulns) {
        const fileIssues = fileVulns[file];
        const filePath = file.split('/');
        const filename = filePath.pop() || file;
        const dir = filePath.pop();

        const fileSeverityCounts = this.initSeverityCounts();

        const issueNodes = fileIssues.map(issue => {
          fileSeverityCounts[issue.severity] += 1;
          totalVulnCount++;
          folderVulnCount++;

          const issueRange = new vscode.Range(
            issue.additionalData.rows[0],
            issue.additionalData.cols[0],
            issue.additionalData.rows[1],
            issue.additionalData.cols[1],
          );
          const params: {
            text: string;
            icon: INodeIcon;
            issue: { filePath: string; range?: vscode.Range }; // todo: where is Uri & Range used?
            internal: InternalType;
            command: Command;
            children?: TreeNode[];
          } = {
            text: issue.additionalData.message,
            icon: IssueTreeProvider.getSeverityIcon(issue.severity),
            issue: {
              filePath: issue.filePath,
              range: issueRange,
            },
            internal: {
              severity: IssueTreeProvider.getSeverityComparatorIndex(issue.severity),
            },
            command: {
              command: SNYK_OPEN_ISSUE_COMMAND,
              title: '',
              arguments: [
                // TODO: update to pass necessary args to open issue command
                // {
                //   issueType: OpenCommandIssueType.CodeIssue,
                //   issue: {
                //     message: issue.additionalData.message,
                //     filePath,
                //     range: issueRange,
                //     diagnostic: issue,
                //   } as CodeIssueCommandArg,
                // } as OpenIssueCommandArg,
              ],
            },
          };
          return new TreeNode(params);
        });

        issueNodes.sort(this.compareNodes);

        const fileSeverity = IssueTreeProvider.getHighestSeverity(fileSeverityCounts);
        folderSeverityCounts[fileSeverity] += 1;

        // append file node
        const fileNode = new TreeNode({
          text: filename,
          description: this.getIssueDescriptionText(dir, fileIssues.length),
          icon: IssueTreeProvider.getSeverityIcon(fileSeverity),
          children: issueNodes,
          internal: {
            nIssues: fileIssues.length,
            severity: IssueTreeProvider.getSeverityComparatorIndex(fileSeverity),
          },
        });
        fileNodes.push(fileNode);
      }

      fileNodes.sort(this.compareNodes);

      const folderSeverity = IssueTreeProvider.getHighestSeverity(folderSeverityCounts);

      const folderNode = new TreeNode({
        text: folderPath,
        description: this.getIssueDescriptionText(folderPath, folderVulnCount),
        icon: IssueTreeProvider.getSeverityIcon(folderSeverity),
        children: fileNodes,
        internal: {
          nIssues: folderVulnCount,
          // severity: OssVulnerabilityTreeProvider.getSeverityComparatorIndex(fileSeverity), // todo: is it used to sort folder nodes?
        },
      });

      nodes.push(folderNode);
    }

    return [nodes, totalVulnCount];
  }

  protected getIssueFoundText(nIssues: number): string {
    return `Snyk found ${!nIssues ? 'no issues! ✅' : `${nIssues} issue${nIssues === 1 ? '' : 's'}`}`;
  }

  protected getIssueDescriptionText(dir: string | undefined, issueCount: number): string | undefined {
    return `${dir} - ${issueCount} issue${issueCount === 1 ? '' : 's'}`;
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

  /** Returns severity significance index. The higher, the more significant severity is. */
  static getSeverityComparatorIndex(severity: IssueSeverity): number {
    return Object.values(IssueSeverity).indexOf(severity);
  }
}
