import { Command, Diagnostic, Range, Uri } from 'vscode';
import { SNYK_SEVERITIES } from '../constants/analysis';
import { SNYK_OPEN_ISSUE_COMMAND } from '../constants/commands';
import { getSnykSeverity } from '../utils/analysisUtils';
import { INodeIcon, Node, NODE_ICONS } from './Node';
import { NodeProvider } from './NodeProvider';

interface ISeverityCounts {
  [severity: number]: number;
}

export class IssueProvider extends NodeProvider {
  compareNodes = (n1: Node, n2: Node): number => {
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

  getRootChildren(): Node[] {
    this.extension.emitViewInitialized();
    const review: Node[] = [];
    let nIssues = 0;
    if (!this.extension.shouldShowAnalysis) return review;
    if (this.extension.analyzer.snykReview)
      this.extension.analyzer.snykReview.forEach((uri: Uri, diagnostics: readonly Diagnostic[]): void => {
        const counts: ISeverityCounts = {
          [SNYK_SEVERITIES.information]: 0,
          [SNYK_SEVERITIES.warning]: 0,
          [SNYK_SEVERITIES.error]: 0,
        };
        const filePath = uri.path.split('/');
        const filename = filePath.pop() || uri.path;
        const dir = filePath.pop();
        const issues: Node[] = diagnostics.map(d => {
          const severity = getSnykSeverity(d.severity);
          counts[severity] += 1;
          nIssues += 1;
          const params: {
            text: string;
            icon: INodeIcon;
            issue: { uri: Uri; range?: Range };
            internal: { severity: number };
            command: Command;
            children?: Node[];
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

          return new Node(params);
        });
        issues.sort(this.compareNodes);
        const fileSeverity = IssueProvider.getFileSeverity(counts);
        const file = new Node({
          text: filename,
          description: `${dir} - ${diagnostics.length} issue${diagnostics.length === 1 ? '' : 's'}`,
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
    if (this.extension.runningAnalysis) {
      review.unshift(
        new Node({
          text: this.extension.analysisStatus,
          description: this.extension.analysisProgress,
        }),
      );
    } else {
      review.unshift(
        new Node({
          text: `Snyk found ${!nIssues ? 'no issues! ✅' : `${nIssues} issue${nIssues === 1 ? '' : 's'}`}`,
        }),
      );
      const sDuration = Math.round((this.extension.lastAnalysisDuration / 1000 + Number.EPSILON) * 100) / 100;
      const ts = new Date(this.extension.lastAnalysisTimestamp);
      const time = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const day = ts.toLocaleDateString([], { year: '2-digit', month: '2-digit', day: '2-digit' });
      review.unshift(
        new Node({
          text: `Analysis took ${sDuration}s, finished at ${time}, ${day}`,
        }),
      );
    }
    return review;
  }
}
