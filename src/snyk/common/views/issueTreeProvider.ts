import _, { flatten } from 'lodash';
import * as vscode from 'vscode'; // todo: invert dependency
import { IConfiguration } from '../configuration/configuration';
import { Issue, IssueSeverity, LsErrorMessage } from '../languageServer/types';
import { messages as commonMessages } from '../../common/messages/analysisMessages';
import { IContextService } from '../services/contextService';
import { IProductService } from '../services/productService';
import { AnalysisTreeNodeProvider } from './analysisTreeNodeProvider';
import { INodeIcon, INodeOptions, NODE_ICONS, TreeNode } from './treeNode';
import { IVSCodeLanguages } from '../vscode/languages';
import { Command, Range } from '../vscode/types';
import { IFolderConfigs } from '../configuration/folderConfigs';
import { SNYK_SET_DELTA_REFERENCE_COMMAND } from '../constants/commands';
import path from 'path';
import { ILog } from '../logger/interfaces';
import { ErrorHandler } from '../error/errorHandler';
import { FEATURE_FLAGS } from '../constants/featureFlags';

interface ISeverityCounts {
  [severity: string]: number;
}

export abstract class ProductIssueTreeProvider<T> extends AnalysisTreeNodeProvider {
  protected allIssueNodes: TreeNode[] = [];

  protected constructor(
    protected readonly logger: ILog,
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

    // totalIssueCount is the number of issues returned by LS, which pre-filters on Issue View Options and Severity Filters.
    const totalIssueCount = this.getTotalIssueCount();
    const ignoredIssueCount = this.getIgnoredCount();
    // Depending on Issue View Options, ignored issues might be pre-filtered by the LS and so ignoredIssueCount may be 0.
    // In this case, openIssueCount is the total issue count returned by the LS.
    const openIssueCount = totalIssueCount - ignoredIssueCount;

    const topNodes: (TreeNode | null)[] = [
      new TreeNode({
        text: this.getIssueFoundText(totalIssueCount, openIssueCount, ignoredIssueCount),
      }),
    ];

    const noSeverityFiltersSelectedWarning = this.getNoSeverityFiltersSelectedTreeNode();
    if (noSeverityFiltersSelectedWarning !== null) {
      topNodes.push(noSeverityFiltersSelectedWarning);
    } else if (totalIssueCount === 0) {
      const noIssueViewOptionSelectedWarning = this.getNoIssueViewOptionsSelectedTreeNode();
      topNodes.push(noIssueViewOptionSelectedWarning);
    } else {
      const fixableIssueText = this.getFixableIssuesText(this.getFixableCount());
      if (fixableIssueText !== null) {
        topNodes.push(new TreeNode({ text: fixableIssueText }));
      }
    }
    const validTopNodes = topNodes.filter((n): n is TreeNode => n !== null);

    const referenceNodeIndex = nodes.findIndex(node => {
      const label = node.label as string;
      const lowerCaseLabel = label?.toLowerCase();
      return lowerCaseLabel?.indexOf('reference') !== -1;
    });

    if (referenceNodeIndex > -1) {
      nodes.splice(referenceNodeIndex + 1, 0, ...validTopNodes);
    } else {
      nodes.unshift(...validTopNodes);
    }
    return nodes;
  }

  getFixableIssuesText(_fixableIssueCount: number): string | null {
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

  getReference(folderPath: string): TreeNode | undefined {
    const deltaFindingsEnabled = this.configuration.getDeltaFindingsEnabled();
    const config = this.folderConfigs.getFolderConfig(this.configuration, folderPath);
    let reference = config?.referenceFolderPath ?? '';
    if (reference === undefined || reference === '') {
      reference = config?.baseBranch ?? '';
    } else {
      reference = path.basename(reference);
    }
    if (deltaFindingsEnabled && config) {
      return new TreeNode({
        text: 'Click here to choose reference [ current: ' + reference + ' ]',
        icon: NODE_ICONS.branch,
        command: {
          command: SNYK_SET_DELTA_REFERENCE_COMMAND,
          title: 'Choose reference for delta findings',
          arguments: [folderPath],
        },
      });
    }
  }

  getResultNodes(): TreeNode[] {
    this.allIssueNodes = [];
    const nodes: TreeNode[] = [];

    for (const result of this.productService.result.entries()) {
      const folderPath = result[0];
      const folderResult = result[1];

      const uri = vscode.Uri.file(folderPath);
      const shortFolderPath = uri.path.split('/');
      // TODO: this might need to be changed to uri.fspath
      const folderName = shortFolderPath.pop() || uri.path;

      let folderVulnCount = 0;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
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

        const issueNodes = filteredIssues.map(issue => {
          fileSeverityCounts[issue.severity] += 1;
          folderVulnCount++;

          const issueRange = this.getIssueRange(issue);
          const params: INodeOptions = {
            text: this.getIssueTitle(issue),
            icon: ProductIssueTreeProvider.getSeverityIcon(issue.severity),
            issue: {
              id: issue.id,
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
        this.allIssueNodes.push(...issueNodes);

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

      const baseBranchNode = this.getReference(uri.fsPath);
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

  protected getIssueFoundText(totalIssueCount: number, _openIssueCount: number, _ignoredIssueCount: number): string {
    const isIgnoresEnabled = this.configuration.getFeatureFlag(FEATURE_FLAGS.consistentIgnores);
    const showingOpen = this.configuration.issueViewOptions.openIssues;

    if (isIgnoresEnabled && !showingOpen) {
      return commonMessages.openIssuesAreDisabled;
    }
    if (totalIssueCount === 0) {
      return commonMessages.congratsNoIssuesFound;
    } else {
      return `✋ ${totalIssueCount} issue${totalIssueCount === 1 ? '' : 's'}`;
    }
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

  private findIssueNodeByIssueId(issueId: string): TreeNode | undefined {
    return this.allIssueNodes.find(issueNode => issueNode.issue?.id === issueId);
  }

  revealIssueById(treeView: vscode.TreeView<TreeNode>, issueId: string): Promise<boolean> {
    return new Promise<boolean>((resolve, _reject) => {
      const issueNode = this.findIssueNodeByIssueId(issueId);
      if (issueNode === undefined) {
        this.logger.error(`Cannot find issue by id ${issueId} to reveal`);
        resolve(false);
        return;
      }
      treeView
        .reveal(issueNode, {
          select: true,
          focus: true,
          expand: 3 /*maximum allowed depth*/,
        })
        .then(
          () => resolve(true),
          err => {
            this.logger.error(ErrorHandler.stringifyError(err));
            resolve(false);
          },
        );
    });
  }
}
