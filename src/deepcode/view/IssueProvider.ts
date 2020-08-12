import DeepCode from "../../interfaces/DeepCodeInterfaces";
import { Uri, Range, Diagnostic } from 'vscode';
import { NodeProvider } from './NodeProvider'
import { Node } from './Node'

export class IssueProvider extends NodeProvider {
  getRootChildren(): Node[] {
    const review: Node[] = [];
    if (!this.extension.analyzer.deepcodeReview) return review;
    this.extension.analyzer.deepcodeReview.forEach(
      (uri: Uri, diagnostics: readonly Diagnostic[]): void => {
        const issues: Node[] = diagnostics.map((d) => {
          const params: {
            text: string, issue: { uri: Uri, range?: Range }, children?: Node[]
          } = {
            text: d.message,
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
        const filePath = uri.path.split('/');
        const text = filePath.pop() || uri.path;
        const dir = filePath.pop();
        const file = new Node({
          text,
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