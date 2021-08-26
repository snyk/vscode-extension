import { Command, Diagnostic, DiagnosticCollection, Range, Uri } from 'vscode';
import { SNYK_SEVERITIES } from '../constants/analysis';
import { SNYK_OPEN_ISSUE_COMMAND } from '../../common/constants/commands';
import { ISnykCodeService } from '../codeService';
import { IContextService } from '../../common/services/contextService';
import { getSnykSeverity } from '../utils/analysisUtils';
import { INodeIcon, TreeNode, NODE_ICONS } from '../../common/views/treeNode';
import { AnalysisTreeNodeProvder } from '../../common/views/analysisTreeNodeProvider';

interface ISeverityCounts {
  [severity: number]: number;
}

export class IssueProvider extends AnalysisTreeNodeProvder {
  constructor(
    protected contextService: IContextService,
    protected snykCode: ISnykCodeService,
    protected diagnosticCollection: DiagnosticCollection | undefined,
  ) {
    super(snykCode);
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
          text: this.getIssueFoundText(nIssues),
        }),
        this.getDurationTreeNode(),
      );
    }
    return review;
  }

  protected getIssueFoundText(nIssues: number): string {
    return `Snyk found ${!nIssues ? 'no issues! ✅' : `${nIssues} issue${nIssues === 1 ? '' : 's'}`}`;
  }

  protected getIssueDescriptionText(dir: string | undefined, diagnostics: readonly Diagnostic[]): string | undefined {
    return `${dir} - ${diagnostics.length} issue${diagnostics.length === 1 ? '' : 's'}`;
  }
}
