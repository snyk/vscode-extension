/* eslint-disable @typescript-eslint/ban-types */
import * as vscode from 'vscode';
import { IAnalytics } from '../../common/analytics/itly';
import { CodeActionAdapter, CodeActionKindAdapter } from '../../common/vscode/codeAction';
import { Disposable } from '../../common/vscode/types';
import { SnykIssuesActionProvider } from './issuesActionsProvider';

export type CodeActionsCallbackFunctions = { [key: string]: (x: unknown) => any };

export class DisposableCodeActionsProvider implements Disposable {
  private disposableProvider: vscode.Disposable | undefined;
  constructor(
    snykReview: vscode.DiagnosticCollection | undefined,
    callbacks: CodeActionsCallbackFunctions,
    readonly analytics: IAnalytics,
  ) {
    this.registerProvider(snykReview, callbacks);
  }

  private registerProvider(
    snykReview: vscode.DiagnosticCollection | undefined,
    callbacks: CodeActionsCallbackFunctions,
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
