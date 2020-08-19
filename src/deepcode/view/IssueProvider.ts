import { Uri, Range, Diagnostic } from 'vscode';
import { NodeProvider } from './NodeProvider';
import { Node, INodeIcon, NODE_ICONS } from './Node';
import { getDeepCodeSeverity } from "../utils/analysisUtils";
import { DEEPCODE_SEVERITIES } from "../constants/analysis";

interface ISeverityCounts {
  [severity: number]: number;
}

export class IssueProvider extends NodeProvider {
  processProgress(progress: number) {
    return `${Math.round(100*progress)}%`;
  }

  getSeverityIcon(severity: number): INodeIcon {
    return {
      [DEEPCODE_SEVERITIES.error]: NODE_ICONS.critical,
      [DEEPCODE_SEVERITIES.warning]: NODE_ICONS.warning,
      [DEEPCODE_SEVERITIES.information]: NODE_ICONS.info,
    }[severity] || NODE_ICONS.info;
  }

  getFileSeverityIcon(counts: ISeverityCounts): INodeIcon {
    for (const s of [
      DEEPCODE_SEVERITIES.error,
      DEEPCODE_SEVERITIES.warning,
      DEEPCODE_SEVERITIES.information,
    ]) {
      if (counts[s]) return this.getSeverityIcon(s);
    }
    return this.getSeverityIcon(DEEPCODE_SEVERITIES.information);
  }

  getRootChildren(): Node[] {
    const review: Node[] = [];
    if (this.extension.runningAnalysis) return [
      new Node({
        text: this.extension.analysisStatus,
        description: this.processProgress(this.extension.analysisProgress),
      })
    ];
    if (!this.extension.analyzer.deepcodeReview) return review;
    this.extension.analyzer.deepcodeReview.forEach(
      (uri: Uri, diagnostics: readonly Diagnostic[]): void => {
        const counts: ISeverityCounts = {
          [DEEPCODE_SEVERITIES.information]: 0,
          [DEEPCODE_SEVERITIES.warning]: 0,
          [DEEPCODE_SEVERITIES.error]: 0,
        };
        const filePath = uri.path.split('/');
        const filename = filePath.pop() || uri.path;
        const dir = filePath.pop();
        const issues: Node[] = diagnostics.map((d) => {
          const severity = getDeepCodeSeverity(d.severity);
          ++counts[severity];
          const params: {
            text: string, icon: INodeIcon, issue: { uri: Uri, range?: Range }, children?: Node[]
          } = {
            text: d.message,
            icon: this.getSeverityIcon(severity),
            issue: {
              uri,
              range: d.range
            }
          };
          if (d.relatedInformation && d.relatedInformation.length) {
            params.children = d.relatedInformation.map((h) =>
              new Node({
                text: h.message,
                issue: {
                  uri: h.location.uri,
                  range: h.location.range,
                }
              })
            );
          }
          return new Node(params);
        });
        const file = new Node({
          text: filename,
          description: `${dir} - ${diagnostics.length} issue${diagnostics.length > 1 ? 's' : ''}`,
          icon: this.getFileSeverityIcon(counts),
          issue: { uri },
          children: issues,
        });
        review.push(file);
      }
    );
    return review;
  }
}