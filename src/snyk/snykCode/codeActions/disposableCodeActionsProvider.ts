/* eslint-disable @typescript-eslint/ban-types */
import * as vscode from 'vscode';
import { IAnalytics } from '../../common/analytics/itly';
import { CodeActionAdapter, CodeActionKindAdapter } from '../../common/vscode/codeAction';
import { SnykIssuesActionProvider } from './issuesActionsProvider';

export class DisposableCodeActionsProvider implements vscode.Disposable {
  private disposableProvider: vscode.Disposable | undefined;
  constructor(
    snykReview: vscode.DiagnosticCollection | undefined,
    callbacks: { [key: string]: Function },
    readonly analytics: IAnalytics,
  ) {
    this.registerProvider(snykReview, callbacks);
  }

  private registerProvider(
    snykReview: vscode.DiagnosticCollection | undefined,
    callbacks: { [key: string]: Function },
  ) {
    const provider = new SnykIssuesActionProvider(
      snykReview,
      callbacks,
      new CodeActionAdapter(),
      new CodeActionKindAdapter(),
      this.analytics,
    );
    this.disposableProvider = vscode.languages.registerCodeActionsProvider(
      { scheme: 'file', language: '*' },
      provider,
      {
        providedCodeActionKinds: provider.getProvidedCodeActionKinds(),
      },
    );
  }

  dispose(): void {
    if (this.disposableProvider) {
      this.disposableProvider.dispose();
    }
  }
}
