import * as vscode from 'vscode';
import { IGNORE_TIP_FOR_USER } from '../../../constants/analysis';
import { findIssueWithRange } from '../../../utils/analysisUtils';

export class DisposableHoverProvider implements vscode.Disposable {
  private hoverProvider: vscode.Disposable | undefined;

  constructor(snykReview: vscode.DiagnosticCollection | undefined) {
    this.registerDisposableProvider(snykReview);
  }

  private registerDisposableProvider(snykReview: vscode.DiagnosticCollection | undefined) {
    this.hoverProvider = vscode.languages.registerHoverProvider(
      { scheme: 'file', language: '*' },
      {
        provideHover(document, position) {
          if (!snykReview || !snykReview.has(document.uri)) {
            return;
          }
          const currentFileReviewIssues = snykReview.get(document.uri);
          if (findIssueWithRange(position, currentFileReviewIssues)) {
            return new vscode.Hover(IGNORE_TIP_FOR_USER);
          }
        },
      },
    );
  }

  public dispose() {
    if (this.hoverProvider) {
      this.hoverProvider.dispose();
    }
  }
}
