import { OpenCommandIssueType, OpenIssueCommandArg } from '../../common/commands/types';
import { IConfiguration } from '../../common/configuration/configuration';
import { SNYK_OPEN_ISSUE_COMMAND } from '../../common/constants/commands';
import { SNYK_ANALYSIS_STATUS } from '../../common/constants/views';
import { IContextService } from '../../common/services/contextService';
import { IViewManagerService } from '../../common/services/viewManagerService';
import { AnalysisTreeNodeProvder } from '../../common/views/analysisTreeNodeProvider';
import { INodeIcon, NODE_ICONS, TreeNode } from '../../common/views/treeNode';
import { messages } from '../messages/treeView';
import { isResultCliError, OssFileResult, OssSeverity, OssVulnerability } from '../ossResult';
import { OssService } from '../services/ossService';

type ISeverityCounts = {
  [key in OssSeverity]: number;
};

export type OssIssueCommandArg = OssVulnerability & {
  matchingIdVulnerabilities: OssVulnerability[];
  overviewHtml: string;
};

export class OssVulnerabilityTreeProvider extends AnalysisTreeNodeProvder {
  constructor(
    protected readonly viewManagerService: IViewManagerService,
    protected readonly contextService: IContextService,
    protected readonly ossService: OssService,
    protected readonly configuration: IConfiguration,
  ) {
    super(configuration, ossService);
  }

  async getRootChildren(): Promise<TreeNode[]> {
    if (!this.configuration.getFeaturesConfiguration()?.ossEnabled) {
      return [
        new TreeNode({
          text: SNYK_ANALYSIS_STATUS.OSS_DISABLED,
        }),
      ];
    }

    if (!this.contextService.shouldShowOssAnalysis) return [];

    if (!this.ossService.isLsDownloadSuccessful) {
      return [this.getErrorEncounteredTreeNode()];
    }

    if (!this.ossService.isCliReady) {
      return [
        new TreeNode({
          text: messages.cookingDependencies,
        }),
      ];
    } else if (!this.ossService.isAnyWorkspaceFolderTrusted) {
      return [this.getNoWorkspaceTrustTreeNode()];
    }

    if (this.ossService.isAnalysisRunning) {
      return [
        new TreeNode({
          text: messages.testRunning,
        }),
      ];
    }

    const ossResults = this.ossService.getResultArray();
    if (!ossResults) {
      return [
        new TreeNode({
          text: messages.runTest,
        }),
      ];
    }

    const nodes: TreeNode[] = [];
    const [resultNodes, totalVulnCount] = await this.getResultNodes(ossResults);
    nodes.push(...resultNodes);

    if (ossResults.length == 1 && isResultCliError(ossResults[0])) {
      return nodes;
    }

    nodes.sort(this.compareNodes);

    const topNodes = [
      new TreeNode({
        text: this.getIssueFoundText(totalVulnCount),
      }),
      this.getDurationTreeNode(),
      this.getNoSeverityFiltersSelectedTreeNode(),
    ];
    nodes.unshift(...topNodes.filter((n): n is TreeNode => n !== null));

    return nodes;
  }

  protected getIssueFoundText(nIssues: number): string {
    switch (nIssues) {
      case 0:
        return messages.noVulnerabilitiesFound;
      case 1:
        return messages.singleVulnerabilityFound;
      default:
        return messages.multipleVulnerabilitiesFound(nIssues);
    }
  }

  protected getIssueDescriptionText(
    dir: string | undefined,
    vulnerabilities: readonly OssVulnerability[],
  ): string | undefined {
    return `${dir} - ${vulnerabilities.length} ${
      vulnerabilities.length === 1 ? messages.vulnerability : messages.vulnerabilities
    }`;
  }

  static getSeverityIcon(severity: OssSeverity | string): INodeIcon {
    return (
      {
        [OssSeverity.Critical]: NODE_ICONS.critical,
        [OssSeverity.High]: NODE_ICONS.high,
        [OssSeverity.Medium]: NODE_ICONS.medium,
        [OssSeverity.Low]: NODE_ICONS.low,
      }[severity] || NODE_ICONS.low
    );
  }

  static getFileSeverity(counts: ISeverityCounts): OssSeverity {
    for (const s of [OssSeverity.Critical, OssSeverity.High, OssSeverity.Medium, OssSeverity.Low]) {
      if (counts[s]) return s;
    }

    return OssSeverity.Low;
  }

  /** Returns severity significance index. The higher, the more significant severity is. */
  static getSeverityComparatorIndex(severity: OssSeverity): number {
    return Object.values(OssSeverity).indexOf(severity);
  }

  onDidChangeTreeData = this.viewManagerService.refreshOssViewEmitter.event;

  private initFileSeverityCounts(): ISeverityCounts {
    return {
      [OssSeverity.Critical]: 0,
      [OssSeverity.High]: 0,
      [OssSeverity.Medium]: 0,
      [OssSeverity.Low]: 0,
    };
  }

  protected getFilteredIssues(uniqueVulnerabilities: OssVulnerability[]): OssVulnerability[] {
    return uniqueVulnerabilities.filter(vuln => {
      switch (vuln.severity.toLowerCase()) {
        case OssSeverity.Critical:
          return this.configuration.severityFilter.critical;
        case OssSeverity.High:
          return this.configuration.severityFilter.high;
        case OssSeverity.Medium:
          return this.configuration.severityFilter.medium;
        case OssSeverity.Low:
          return this.configuration.severityFilter.low;
        default:
          return true;
      }
    });
  }

  private async getResultNodes(ossResults: ReadonlyArray<OssFileResult>): Promise<[TreeNode[], number]> {
    const nodes: TreeNode[] = [];
    let totalVulnCount = 0;

    for (const fileResult of ossResults) {
      if (isResultCliError(fileResult)) {
        nodes.push(this.getErrorEncounteredTreeNode(fileResult.path));
        continue;
      }

      const counts: ISeverityCounts = this.initFileSeverityCounts();
      const vulnerabilityNodes: TreeNode[] = [];

      const uniqueVulns = this.ossService.getUniqueVulnerabilities(fileResult.vulnerabilities);
      totalVulnCount += uniqueVulns.length;

      const fileVulnerabilities = this.getFilteredIssues(uniqueVulns);
      if (fileVulnerabilities.length == 0) continue;

      for (const vuln of fileVulnerabilities) {
        counts[vuln.severity]++;
        vulnerabilityNodes.push(
          new TreeNode({
            text: `${vuln.packageName}@${vuln.version} - ${vuln.title}`,
            icon: OssVulnerabilityTreeProvider.getSeverityIcon(vuln.severity),
            internal: {
              severity: OssVulnerabilityTreeProvider.getSeverityComparatorIndex(vuln.severity),
            },
            command: {
              command: SNYK_OPEN_ISSUE_COMMAND,
              title: '',
              arguments: [
                {
                  issueType: OpenCommandIssueType.OssVulnerability,
                  // eslint-disable-next-line no-await-in-loop
                  issue: await this.ossService.getOssIssueCommandArg(vuln, fileResult.vulnerabilities),
                } as OpenIssueCommandArg,
              ],
            },
          }),
        );
      }

      vulnerabilityNodes.sort(this.compareNodes);
      const fileSeverity = OssVulnerabilityTreeProvider.getFileSeverity(counts);

      const fileNode = new TreeNode({
        text: fileResult.displayTargetFile,
        description: this.getIssueDescriptionText(fileResult.projectName, fileVulnerabilities),
        icon: OssVulnerabilityTreeProvider.getSeverityIcon(fileSeverity),
        children: vulnerabilityNodes,
        internal: {
          nIssues: vulnerabilityNodes.length,
          severity: OssVulnerabilityTreeProvider.getSeverityComparatorIndex(fileSeverity),
        },
      });
      nodes.push(fileNode);
    }

    return [nodes, totalVulnCount];
  }
}
