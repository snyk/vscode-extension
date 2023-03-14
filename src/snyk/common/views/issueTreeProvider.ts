import _ from 'lodash';
import * as vscode from 'vscode'; // todo: invert dependency
import { IConfiguration } from '../../common/configuration/configuration';
import { Issue, IssueSeverity } from '../../common/languageServer/types';
import { messages as commonMessages } from '../../common/messages/analysisMessages';
import { IContextService } from '../../common/services/contextService';
import { IProductService } from '../../common/services/productService';
import { AnalysisTreeNodeProvider } from '../../common/views/analysisTreeNodeProvider';
import { INodeIcon, InternalType, NODE_ICONS, TreeNode } from '../../common/views/treeNode';
import { IVSCodeLanguages } from '../../common/vscode/languages';
import { Command, Range } from '../../common/vscode/types';

interface ISeverityCounts {
  [severity: string]: number;
}

export abstract class ProductIssueTreeProvider<T> extends AnalysisTreeNodeProvider {
  constructor(
    protected readonly contextService: IContextService,
    protected readonly productService: IProductService<T>,
    protected readonly configuration: IConfiguration,
    protected readonly languages: IVSCodeLanguages,
  ) {
    super(configuration, productService);
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

  abstract filterIssues(issues: Issue<T>[]): Issue<T>[];

  abstract getRunTestMessage(): string;
  abstract getIssueTitle(issue: Issue<T>): string;

  abstract getIssueRange(issue: Issue<T>): Range;
  abstract getOpenIssueCommand(issue: Issue<T>, folderPath: string, filePath: string): Command;

  getRootChildren(): TreeNode[] {
    const nodes: TreeNode[] = [];

    if (!this.contextService.shouldShowCodeAnalysis) return nodes;
    if (!this.productService.isLsDownloadSuccessful) {
      return [this.getErrorEncounteredTreeNode()];
    }
    if (!this.productService.isAnyWorkspaceFolderTrusted) {
      return [this.getNoWorkspaceTrustTreeNode()];
    }
    if (this.productService.isAnalysisRunning) {
      return [
        new TreeNode({
          text: commonMessages.scanRunning,
        }),
      ];
    }

    if (!this.productService.isAnyResultAvailable()) {
      return [
        new TreeNode({
          text: this.getRunTestMessage(),
        }),
      ];
    }

    const [resultNodes, nIssues] = this.getResultNodes();
    nodes.push(...resultNodes);

    const folderResults = Array.from(this.productService.result.values());
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

    for (const result of this.productService.result.entries()) {
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

        const filteredIssues = this.filterIssues(fileIssues);

        const issueNodes = filteredIssues.map(issue => {
          fileSeverityCounts[issue.severity] += 1;
          totalVulnCount++;
          folderVulnCount++;

          const issueRange = this.getIssueRange(issue);
          const params: {
            text: string;
            icon: INodeIcon;
            issue: { filePath: string; uri: vscode.Uri; range?: vscode.Range };
            internal: InternalType;
            command: Command;
            children?: TreeNode[];
          } = {
            text: this.getIssueTitle(issue),
            icon: ProductIssueTreeProvider.getSeverityIcon(issue.severity),
            issue: {
              uri,
              filePath: file,
              range: issueRange,
            },
            internal: {
              severity: ProductIssueTreeProvider.getSeverityComparatorIndex(issue.severity),
            },
            command: this.getOpenIssueCommand(issue, folderPath, file),
          };
          return new TreeNode(params);
        });

        if (issueNodes.length === 0) {
          continue;
        }

        issueNodes.sort(this.compareNodes);

        const fileSeverity = ProductIssueTreeProvider.getHighestSeverity(fileSeverityCounts);
        folderSeverityCounts[fileSeverity] += 1;

        // append file node
        const fileNode = new TreeNode({
          text: filename,
          description: this.getIssueDescriptionText(dir, issueNodes.length),
          icon: ProductIssueTreeProvider.getSeverityIcon(fileSeverity),
          children: issueNodes,
          internal: {
            nIssues: issueNodes.length,
            severity: ProductIssueTreeProvider.getSeverityComparatorIndex(fileSeverity),
          },
        });
        fileNodes.push(fileNode);
      }

      fileNodes.sort(this.compareNodes);

      const folderSeverity = ProductIssueTreeProvider.getHighestSeverity(folderSeverityCounts);

      if (folderVulnCount == 0) {
        continue;
      }

      // flatten results if single workspace folder
      if (this.productService.result.size == 1) {
        nodes.push(...fileNodes);
      } else {
        const folderNode = new TreeNode({
          text: folderName,
          description: this.getIssueDescriptionText(folderName, folderVulnCount),
          icon: ProductIssueTreeProvider.getSeverityIcon(folderSeverity),
          children: fileNodes,
          internal: {
            nIssues: folderVulnCount,
            severity: ProductIssueTreeProvider.getSeverityComparatorIndex(folderSeverity),
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

  // todo: Obsolete. Remove after OSS scans migration to LS
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
