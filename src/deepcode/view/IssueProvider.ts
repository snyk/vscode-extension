import { Uri, Range, Diagnostic } from 'vscode';
import { NodeProvider } from './NodeProvider';
import { Node } from './Node';
import { getDeepCodeSeverity } from "../utils/analysisUtils";
import { DEEPCODE_SEVERITIES } from "../constants/analysis";

interface ISeverityCounts {
  [severity: number]: number;
}

export class IssueProvider extends NodeProvider {
  getSymbolTextSpacing(): string {
    return "   ";
  }
  
  getSuperscriptNumber(n: number): string {
    let res = "";
    const nDigits = Math.round(n).toString().split('');
    const digitMap: { [digit: string]: string } = {
      '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
      '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    };
    for (const d of nDigits) res += digitMap[d] || "";
    return res;
  }

  getSeveritySymbol(severity: number): string {
    return {
      [DEEPCODE_SEVERITIES.error]: "❌",
      [DEEPCODE_SEVERITIES.warning]: "⚠️",
      [DEEPCODE_SEVERITIES.information]: "ℹ️",
    }[severity] || "💡";
  }

  getIssueText(text: string, severity: number): string {
    return `${this.getSeveritySymbol(severity)}${this.getSymbolTextSpacing()}${text}`;
  }

  getFileText(text: string, counts: ISeverityCounts ): string {
    let res = "";
    for (const s of [
      DEEPCODE_SEVERITIES.error,
      DEEPCODE_SEVERITIES.warning,
      DEEPCODE_SEVERITIES.information,
    ]) {
      if (counts[s]) res += `${this.getSeveritySymbol(s)}${this.getSuperscriptNumber(counts[s])} `;
    }
    res += `${this.getSymbolTextSpacing()}${text}`;
    return res;
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