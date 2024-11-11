import _, { flatten } from 'lodash';
import * as vscode from 'vscode'; // todo: invert dependency
import { IConfiguration, IssueViewOptions } from '../../common/configuration/configuration';
import { Issue, IssueSeverity, LsErrorMessage } from '../../common/languageServer/types';
import { messages as commonMessages } from '../../common/messages/analysisMessages';
import { IContextService } from '../../common/services/contextService';
import { IProductService } from '../../common/services/productService';
import { AnalysisTreeNodeProvider } from '../../common/views/analysisTreeNodeProvider';
import { INodeIcon, InternalType, NODE_ICONS, TreeNode } from '../../common/views/treeNode';
import { IVSCodeLanguages } from '../../common/vscode/languages';
import { Command, Range } from '../../common/vscode/types';
import { IFolderConfigs } from '../configuration/folderConfigs';
import { SNYK_SET_BASE_BRANCH_COMMAND } from '../constants/commands';

interface ISeverityCounts {
  [severity: string]: number;
}

export abstract class ProductIssueTreeProvider<T> extends AnalysisTreeNodeProvider {
  constructor(
    protected readonly contextService: IContextService,
    protected readonly productService: IProductService<T>,
    protected readonly configuration: IConfiguration,
    protected readonly languages: IVSCodeLanguages,
    protected readonly folderConfigs: IFolderConfigs,
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

  abstract shouldShowTree(): boolean;

  abstract filterIssues(issues: Issue<T>[]): Issue<T>[];

  abstract getRunTestMessage(): string;

  abstract getIssueTitle(issue: Issue<T>): string;

  abstract getIssueRange(issue?: Issue<T>): Range | undefined;

  abstract getOpenIssueCommand(
    issue: Issue<T>,
    folderPath: string,
    filePath: string,
    filteredIssues?: Issue<T>[],
  ): Command;

  getRootChildren(): TreeNode[] {
    const nodes: TreeNode[] = [];

    if (!this.shouldShowTree()) return nodes;
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

    nodes.push(...this.getResultNodes());

    const folderResults = Array.from(this.productService.result.values());
    const allFailed = folderResults.every(folderResult => folderResult instanceof Error);
    if (allFailed) {
      return nodes;
    }
    nodes.sort(this.compareNodes);

    const totalIssueCount = this.getTotalIssueCount();
    const ignoredIssueCount = this.getIgnoredCount();

    const topNodes: (TreeNode | null)[] = [
      new TreeNode({
        text: this.getIssueFoundText(totalIssueCount, ignoredIssueCount),
      }),
    ];

    if (totalIssueCount > 0) {
      topNodes.push(this.getFixableIssuesNode(this.getFixableCount()));
    }

    const noSeverityFiltersSelectedWarning = this.getNoSeverityFiltersSelectedTreeNode();
    if (noSeverityFiltersSelectedWarning !== null) {
      topNodes.push(noSeverityFiltersSelectedWarning);
    } else {
      const noIssueViewOptionSelectedWarning = this.getNoIssueViewOptionsSelectedTreeNode(
        totalIssueCount,
        ignoredIssueCount,
      );
      topNodes.push(noIssueViewOptionSelectedWarning);
    }
    const validTopNodes = topNodes.filter((n): n is TreeNode => n !== null);

    const baseBranchNodeIndex = nodes.findIndex(node => {
      const label = node.label as string;
      return label?.toLowerCase().indexOf('base branch') !== -1;
    });

    if (baseBranchNodeIndex > -1) {
      nodes.splice(baseBranchNodeIndex + 1, 0, ...validTopNodes);
    } else {
      nodes.unshift(...validTopNodes);
    }
    return nodes;
  }

  getFixableIssuesNode(_fixableIssueCount: number): TreeNode | null {
    return null; // optionally overridden by products
  }

  getFilteredIssues(): Issue<T>[] {
    const folderResults = Array.from(this.productService.result.values());
    const successfulResults = flatten<Issue<T>>(
      folderResults.filter((result): result is Issue<T>[] => Array.isArray(result)),
    );
    return this.filterIssues(successfulResults);
  }

  getTotalIssueCount(): number {
    return this.getFilteredIssues().length;
  }

  getFixableCount(): number {
    return this.getFilteredIssues().filter(issue => this.isFixableIssue(issue)).length;
  }

  getIgnoredCount(): number {
    const ignoredIssues = this.getFilteredIssues().filter(issue => issue.isIgnored);
    return ignoredIssues.length;
  }

  isFixableIssue(_issue: Issue<T>) {
    return false; // optionally overridden by products
  }

  filterVisibleIssues(issues: Issue<T>[]): Issue<T>[] {
    return issues.filter(issue => this.isVisibleIssue(issue, this.configuration.issueViewOptions));
  }

  protected isVisibleIssue(issue: Issue<T>, issueViewOptions: IssueViewOptions) {
    const { ignoredIssues: includeIgnoredIssues, openIssues: includeOpenIssues } = issueViewOptions;

    // Show all issues
    if (includeIgnoredIssues && includeOpenIssues) {
      return true;
    }

    // Show issues based on options
    if (includeIgnoredIssues) {
      return issue.isIgnored;
    }
    if (includeOpenIssues) {
      return !issue.isIgnored;
    }
    return false;
  }

  getBaseBranch(folderPath: string): TreeNode | undefined {
    const deltaFindingsEnabled = this.configuration.getDeltaFindingsEnabled();
    const config = this.folderConfigs.getFolderConfig(this.configuration, folderPath);

    if (deltaFindingsEnabled && config) {
      return new TreeNode({
        text: 'Base branch: ' + config.baseBranch,
        icon: NODE_ICONS.branch,
        command: {
          command: SNYK_SET_BASE_BRANCH_COMMAND,
          title: 'Choose Base Branch',
          arguments: [folderPath],
        },
      });
    }
  }

  getResultNodes(): TreeNode[] {
    const nodes: TreeNode[] = [];

    for (const result of this.productService.result.entries()) {
      const folderPath = result[0];
      const folderResult = result[1];

      const uri = vscode.Uri.file(folderPath);
      const shortFolderPath = uri.path.split('/');
      // TODO: this might need to be changed to uri.fspath
      const folderName = shortFolderPath.pop() || uri.path;

      let folderVulnCount = 0;
      if (folderResult instanceof Error && folderResult.message === LsErrorMessage.repositoryInvalidError) {
        nodes.push(this.getFaultyRepositoryErrorTreeNode(folderName, folderResult.toString()));
        continue;
      }

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
        const visibleIssues = this.filterVisibleIssues(filteredIssues);

        const issueNodes = visibleIssues.map(issue => {
          fileSeverityCounts[issue.severity] += 1;
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

      const baseBranchNode = this.getBaseBranch(uri.fsPath);
      if (folderVulnCount == 0) {
        this.addBaseBranchNode(baseBranchNode, nodes);
        continue;
      }
      // flatten results if single workspace folder
      if (this.productService.result.size === 1) {
        this.addBaseBranchNode(baseBranchNode, nodes);
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
        this.addBaseBranchNode(baseBranchNode, fileNodes);
        nodes.push(folderNode);
      }
    }

    return nodes;
  }

  addBaseBranchNode(baseBranchNode: TreeNode | undefined, nodes: TreeNode[]) {
    if (!baseBranchNode) {
      return;
    }
    nodes.unshift(baseBranchNode);
  }

  protected getIssueFoundText(nIssues: number, _: number): string {
    if (!nIssues) {
      return '✅ Congrats! No issues found!';
    }
    return `Snyk found ${nIssues} issue${nIssues === 1 ? '' : 's'}`;
  }

  protected getIssueDescriptionText(dir: string | undefined, issueCount: number): string | undefined {
    return `${dir} - ${issueCount} issue${issueCount === 1 ? '' : 's'}`;
  }

  static getHighestSeverity(counts: ISeverityCounts): IssueSeverity {
    for (const s of [IssueSeverity.Critical, IssueSeverity.High, IssueSeverity.Medium, IssueSeverity.Low]) {
      if (counts[s]) return s;
    }

    return IssueSeverity.Low;
  }

  protected initSeverityCounts(): ISeverityCounts {
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
