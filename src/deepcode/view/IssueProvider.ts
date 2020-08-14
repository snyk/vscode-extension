import DeepCode from "../../interfaces/DeepCodeInterfaces";
import { Uri, Range, Diagnostic } from 'vscode';
import { NodeProvider } from './NodeProvider'
import { Node } from './Node'
import { getDeepCodeSeverity } from "../utils/analysisUtils";
import { DEEPCODE_SEVERITIES } from "../constants/analysis";

interface ISeverityCounts {
  [severity: number]: number,
}

export class IssueProvider extends NodeProvider {
  getIssueText(text: string, severity: number): string {
    return "(" + severity + ") " + text;
  }

  getFileText(text: string, counts: ISeverityCounts ): string {
    return "[" + counts[DEEPCODE_SEVERITIES.error]
      + "|" + counts[DEEPCODE_SEVERITIES.warning]
      + "|" + counts[DEEPCODE_SEVERITIES.information]
      + "] " + text;
  }

  getRootChildren(): Node[] {
    const review: Node[] = [];
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
            text: string, issue: { uri: Uri, range?: Range }, children?: Node[]
          } = {
            text: this.getIssueText(d.message, severity),
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
          text: this.getFileText(filename, counts),
          description: dir,
          issue: { uri },
          children: issues,
        });
        review.push(file);
      }
    );
    return review;
  }
}