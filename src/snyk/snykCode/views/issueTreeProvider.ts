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
import { SNYK_SEVERITIES } from '../constants/analysis';
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

  static getFileSeverity(counts: ISeverityCounts): number {
    for (const s of [SNYK_SEVERITIES.error, SNYK_SEVERITIES.warning, SNYK_SEVERITIES.information]) {
      if (counts[s]) return s;
    }
    return SNYK_SEVERITIES.information;
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
      let folderPath = result[0];
      let folderResult = result[1];
      if (folderResult instanceof Error) {
        nodes.push(this.getErrorEncounteredTreeNode(folderPath));
        continue;
      }

      const counts: ISeverityCounts = this.initFileSeverityCounts();
      const vulnerabilityNodes: TreeNode[] = [];

      const nodes = folderResult.map(issue => {
        counts[issue.severity] += 1;
        const params: {
          text: string;
          icon: INodeIcon;
          issue: { uri: Uri; range?: Range }; // todo: where is Uri & Range used?
          internal: { severity: string };
          command: Command;
          children?: TreeNode[];
        } = {
          text: issue.additionalData.message,
          icon: IssueTreeProvider.getSeverityIcon(issue.severity),
          issue: {
            uri, // todo: where is Uri & Range used?
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
      });

      const folderSeverity = IssueTreeProvider.getFolderSeverity(counts);

      const fileNode = new TreeNode({
        text: folderPath,
        description: this.getIssueDescriptionText(folderPath, vulnerabilityNodes),
        icon: IssueTreeProvider.getSeverityIcon(folderSeverity),
        children: vulnerabilityNodes,
        internal: {
          nIssues: vulnerabilityNodes.length,
          // severity: OssVulnerabilityTreeProvider.getSeverityComparatorIndex(fileSeverity), // todo: is it used to sort folder nodes?
        },
      });
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

  static getFolderSeverity(counts: ISeverityCounts): IssueSeverity {
    for (const s of [IssueSeverity.Critical, IssueSeverity.High, IssueSeverity.Medium, IssueSeverity.Low]) {
      if (counts[s]) return s;
    }

    return IssueSeverity.Low;
  }

  private initFileSeverityCounts(): ISeverityCounts {
    return {
      [IssueSeverity.Critical]: 0,
      [IssueSeverity.High]: 0,
      [IssueSeverity.Medium]: 0,
      [IssueSeverity.Low]: 0,
    };
  }
}
