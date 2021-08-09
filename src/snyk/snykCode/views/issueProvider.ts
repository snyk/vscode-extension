import { Command, Diagnostic, DiagnosticCollection, Range, Uri } from 'vscode';
import { SNYK_SEVERITIES } from '../constants/analysis';
import { SNYK_OPEN_ISSUE_COMMAND } from '../../common/constants/commands';
import { ISnykCode } from '../code';
import { IContextService } from '../../common/services/contextService';
import { getSnykSeverity } from '../utils/analysisUtils';
import { INodeIcon, TreeNode, NODE_ICONS } from '../../common/views/treeNode';
import { TreeNodeProvider } from '../../common/views/treeNodeProvider';

interface ISeverityCounts {
  [severity: number]: number;
}

export class IssueProvider extends TreeNodeProvider {
  constructor(
    protected contextService: IContextService,
    protected snykCode: ISnykCode,
    protected diagnosticCollection: DiagnosticCollection | undefined,
  ) {
    super();
  }

  compareNodes = (n1: TreeNode, n2: TreeNode): number => {
    if (n2.internal.severity - n1.internal.severity) return n2.internal.severity - n1.internal.severity;
    if (n2.internal.nIssues - n1.internal.nIssues) return n2.internal.nIssues - n1.internal.nIssues;
    if (n1.label && n2.label) {
      if (n1.label < n2.label) return -1;
      if (n1.label > n2.label) return 1;
    }
    if (n1.description && n2.description) {
      if (n1.description < n2.description) return -1;
      if (n1.description > n2.description) return 1;
    }
    return 0;
  };

  static getSeverityIcon(severity: number): INodeIcon {
    return (
      {
        [SNYK_SEVERITIES.error]: NODE_ICONS.critical,
        [SNYK_SEVERITIES.warning]: NODE_ICONS.warning,
        [SNYK_SEVERITIES.information]: NODE_ICONS.info,
      }[severity] || NODE_ICONS.info
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
    if (!this.contextService.shouldShowAnalysis) return review;
    if (this.diagnosticCollection)
      this.diagnosticCollection.forEach((uri: Uri, diagnostics: readonly Diagnostic[]): void => {
        const counts: ISeverityCounts = {
          [SNYK_SEVERITIES.information]: 0,
          [SNYK_SEVERITIES.warning]: 0,
          [SNYK_SEVERITIES.error]: 0,
        };
        const filePath = uri.path.split('/');
        const filename = filePath.pop() || uri.path;
        const dir = filePath.pop();
        const issues: TreeNode[] = diagnostics.map(d => {
          const severity = getSnykSeverity(d.severity);
          counts[severity] += 1;
          nIssues += 1;
          const params: {
            text: string;
            icon: INodeIcon;
            issue: { uri: Uri; range?: Range };
            internal: { severity: number };
            command: Command;
            children?: TreeNode[];
          } = {
            text: d.message,
            icon: IssueProvider.getSeverityIcon(severity),
            issue: {
              uri,
              range: d.range,
            },
            internal: {
              severity,
            },
            command: {
              command: SNYK_OPEN_ISSUE_COMMAND,
              title: '',
              arguments: [d.message, uri, d.range],
            },
          };

          // // No need for markers in the node tree while having the suggestion view
          // if (d.relatedInformation && d.relatedInformation.length) {
          //   params.children = d.relatedInformation.map((h) =>
          //     new Node({
          //       text: h.message,
          //       issue: {
          //         uri: h.location.uri,
          //         range: h.location.range,
          //       },
          //       command: {
          //         command: SNYK_OPEN_ISSUE_COMMAND,
          //         title: '',
          //         arguments: [d.message, severity, uri, d.range, h.location.uri, h.location.range],
          //       }
          //     })
          //   );
          // }

          return new TreeNode(params);
        });
        issues.sort(this.compareNodes);
        const fileSeverity = IssueProvider.getFileSeverity(counts);
        const file = new TreeNode({
          text: filename,
          description: this.getIssueDescriptionText(dir, diagnostics),
          icon: IssueProvider.getSeverityIcon(fileSeverity),
          children: issues,
          internal: {
            nIssues: diagnostics.length,
            severity: fileSeverity,
          },
        });
        review.push(file);
      });
    review.sort(this.compareNodes);
    if (this.snykCode.isAnalysisRunning) {
      review.unshift(
        new TreeNode({
          text: this.snykCode.analysisStatus,
          description: this.snykCode.analysisProgress,
        }),
      );
    } else {
      review.unshift(
        new TreeNode({
          text: this.getNoIssueFoundText(nIssues),
        }),
      );
      const sDuration = Math.round((this.snykCode.lastAnalysisDuration / 1000 + Number.EPSILON) * 100) / 100;
      const ts = new Date(this.snykCode.lastAnalysisTimestamp);
      const time = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const day = ts.toLocaleDateString([], { year: '2-digit', month: '2-digit', day: '2-digit' });
      review.unshift(
        new TreeNode({
          text: `Analysis took ${sDuration}s, finished at ${time}, ${day}`,
        }),
      );
    }
    return review;
  }

  protected getNoIssueFoundText(nIssues: number): string {
    return `Snyk found ${!nIssues ? 'no issues! ✅' : `${nIssues} issue${nIssues === 1 ? '' : 's'}`}`;
  }

  protected getIssueDescriptionText(dir: string | undefined, diagnostics: readonly Diagnostic[]): string | undefined {
    return `${dir} - ${diagnostics.length} issue${diagnostics.length === 1 ? '' : 's'}`;
  }
}
