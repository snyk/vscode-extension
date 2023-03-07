import _ from 'lodash';
import * as vscode from 'vscode'; // todo: invert dependency
import { OpenCommandIssueType, OpenIssueCommandArg } from '../../common/commands/types';
import { IConfiguration } from '../../common/configuration/configuration';
import { SNYK_OPEN_ISSUE_COMMAND } from '../../common/constants/commands';
import { IssueSeverity } from '../../common/languageServer/types';
import { messages as commonMessages } from '../../common/messages/analysisMessages';
import { IContextService } from '../../common/services/contextService';
import { AnalysisTreeNodeProvider } from '../../common/views/analysisTreeNodeProvider';
import { INodeIcon, InternalType, NODE_ICONS, TreeNode } from '../../common/views/treeNode';
import { IVSCodeLanguages } from '../../common/vscode/languages';
import { Command } from '../../common/vscode/types';
import { ISnykIacService } from '../iacService';
import { messages } from '../messages/analysis';
import { IacIssueCommandArg } from './interfaces';
interface ISeverityCounts {
  [severity: string]: number;
}

export class IssueTreeProvider extends AnalysisTreeNodeProvider {
  constructor(
    protected readonly contextService: IContextService,
    protected readonly iacService: ISnykIacService,
    protected readonly configuration: IConfiguration,
    protected readonly languages: IVSCodeLanguages,
    protected readonly isSecurityType: boolean,
  ) {
    super(configuration, iacService);
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

    if (!this.contextService.shouldShowIacAnalysis) return nodes;
    if (!this.iacService.isLsDownloadSuccessful) {
      return [this.getErrorEncounteredTreeNode()];
    }
    if (!this.iacService.isAnyWorkspaceFolderTrusted) {
      return [this.getNoWorkspaceTrustTreeNode()];
    }
    if (this.iacService.isAnalysisRunning) {
      return [
        new TreeNode({
          text: commonMessages.scanRunning,
        }),
      ];
    }

    if (!this.iacService.isAnyResultAvailable()) {
      return [
        new TreeNode({
          text: messages.runTest,
        }),
      ];
    }

    const [resultNodes, nIssues] = this.getResultNodes();
    nodes.push(...resultNodes);

    const folderResults = Array.from(this.iacService.result.values());
    const allFailed = folderResults.every(folderResult => folderResult instanceof Error);
    if (allFailed) {
      return nodes;
    }

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
    const nodes: TreeNode[] = [];
    let totalVulnCount = 0;

    for (const result of this.iacService.result.entries()) {
      const folderPath = result[0];
      const folderResult = result[1];

      const uri = vscode.Uri.file(folderPath);
      const shortFolderPath = uri.path.split('/');
      const folderName = shortFolderPath.pop() || uri.path;

      let folderVulnCount = 0;
      if (folderResult instanceof Error) {
        nodes.push(this.getErrorEncounteredTreeNode(folderName));
        continue;
      }

      const folderSeverityCounts = this.initSeverityCounts();
      const fileNodes: TreeNode[] = [];

      const fileVulns = _.groupBy(folderResult, v => v.filePath);

      for (const file in fileVulns) {
        const fileIssues = fileVulns[file];
        const uri = vscode.Uri.file(file);
        const filePath = uri.path.split('/');
        const filename = filePath.pop() || uri.path;
        const dir = filePath.pop();

        const fileSeverityCounts = this.initSeverityCounts();

        const issueNodes = fileIssues.map(issue => {
          fileSeverityCounts[issue.severity] += 1;
          totalVulnCount++;
          folderVulnCount++;

          const params: {
            text: string;
            icon: INodeIcon;
            issue: { filePath: string; uri: vscode.Uri; range?: vscode.Range };
            internal: InternalType;
            command: Command;
            children?: TreeNode[];
          } = {
            text: issue.title, //IS THIS RIGHT?
            icon: IssueTreeProvider.getSeverityIcon(issue.severity),
            issue: {
              uri,
              filePath: file,
            },
            internal: {
              severity: IssueTreeProvider.getSeverityComparatorIndex(issue.severity),
            },
            command: {
              command: SNYK_OPEN_ISSUE_COMMAND,
              title: '',
              arguments: [
                {
                  issueType: OpenCommandIssueType.CodeIssue,
                  issue: {
                    id: issue.id,
                    folderPath,
                    filePath: file,
                  } as IacIssueCommandArg,
                } as OpenIssueCommandArg,
              ],
            },
          };
          return new TreeNode(params);
        });

        if (issueNodes.length === 0) {
          continue;
        }

        issueNodes.sort(this.compareNodes);

        const fileSeverity = IssueTreeProvider.getHighestSeverity(fileSeverityCounts);
        folderSeverityCounts[fileSeverity] += 1;

        // append file node
        const fileNode = new TreeNode({
          text: filename,
          description: this.getIssueDescriptionText(dir, issueNodes.length),
          icon: IssueTreeProvider.getSeverityIcon(fileSeverity),
          children: issueNodes,
          internal: {
            nIssues: issueNodes.length,
            severity: IssueTreeProvider.getSeverityComparatorIndex(fileSeverity),
          },
        });
        fileNodes.push(fileNode);
      }

      fileNodes.sort(this.compareNodes);

      const folderSeverity = IssueTreeProvider.getHighestSeverity(folderSeverityCounts);

      if (folderVulnCount == 0) {
        continue;
      }

      // flatten results if single workspace folder
      if (this.iacService.result.size == 1) {
        nodes.push(...fileNodes);
      } else {
        const folderNode = new TreeNode({
          text: folderName,
          description: this.getIssueDescriptionText(folderName, folderVulnCount),
          icon: IssueTreeProvider.getSeverityIcon(folderSeverity),
          children: fileNodes,
          internal: {
            nIssues: folderVulnCount,
            severity: IssueTreeProvider.getSeverityComparatorIndex(folderSeverity),
          },
        });
        nodes.push(folderNode);
      }
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
