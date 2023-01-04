import { IConfiguration } from '../../common/configuration/configuration';
import { messages as commonMessages } from '../../common/messages/analysisMessages';
import { IContextService } from '../../common/services/contextService';
import { AnalysisTreeNodeProvder } from '../../common/views/analysisTreeNodeProvider';
import { INodeIcon, NODE_ICONS, TreeNode } from '../../common/views/treeNode';
import { ISnykCodeService } from '../codeService';
import { SNYK_SEVERITIES } from '../constants/analysis';
import { messages } from '../messages/analysis';

interface ISeverityCounts {
  [severity: number]: number;
}

export class IssueTreeProvider extends AnalysisTreeNodeProvder {
  constructor(
    protected readonly contextService: IContextService,
    protected readonly codeService: ISnykCodeService,
    protected readonly configuration: IConfiguration,
  ) {
    super(configuration, codeService);
  }

  static getSeverityIcon(severity: number): INodeIcon {
    return (
      {
        [SNYK_SEVERITIES.error]: NODE_ICONS.high,
        [SNYK_SEVERITIES.warning]: NODE_ICONS.medium,
        [SNYK_SEVERITIES.information]: NODE_ICONS.low,
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
    const review: TreeNode[] = [];
    let nIssues = 0;

    if (!this.contextService.shouldShowCodeAnalysis) return review;
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

    review.sort(this.compareNodes);
    const topNodes = [
      new TreeNode({
        text: this.getIssueFoundText(nIssues),
      }),
      this.getDurationTreeNode(),
      this.getNoSeverityFiltersSelectedTreeNode(),
    ];
    review.unshift(...topNodes.filter((n): n is TreeNode => n !== null));
    return review;
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
}
