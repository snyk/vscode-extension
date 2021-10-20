/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable no-param-reassign */
/* eslint-disable @typescript-eslint/ban-types */
import * as vscode from 'vscode';
import { analytics } from '../../common/analytics/analytics';
import { SNYK_IGNORE_ISSUE_COMMAND, SNYK_OPEN_ISSUE_COMMAND } from '../../common/constants/commands';
import { IDE_NAME } from '../../common/constants/general';
import { FILE_IGNORE_ACTION_NAME, IGNORE_ISSUE_ACTION_NAME, SHOW_ISSUE_ACTION_NAME } from '../constants/analysis';
import { findIssueWithRange } from '../utils/analysisUtils';

export class SnykIssuesActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  private issuesList: vscode.DiagnosticCollection | undefined;
  private findSuggestion: Function;
  private trackIgnoreSuggestion: Function;

  constructor(issuesList: vscode.DiagnosticCollection | undefined, callbacks: { [key: string]: Function }) {
    this.issuesList = issuesList;
    this.findSuggestion = callbacks.findSuggestion;
    this.trackIgnoreSuggestion = callbacks.trackIgnoreSuggestion;
  }

  private createIgnoreIssueAction({
    document,
    matchedIssue,
    isFileIgnore,
  }: {
    document: vscode.TextDocument;
    matchedIssue: vscode.Diagnostic;
    isFileIgnore?: boolean;
  }): vscode.CodeAction {
    const ignoreIssueAction = new vscode.CodeAction(
      isFileIgnore ? FILE_IGNORE_ACTION_NAME : IGNORE_ISSUE_ACTION_NAME,
      SnykIssuesActionProvider.providedCodeActionKinds[0],
    );

    const suggestion = this.findSuggestion(matchedIssue.message);
    if (suggestion)
      ignoreIssueAction.command = {
        command: SNYK_IGNORE_ISSUE_COMMAND,
        title: SNYK_IGNORE_ISSUE_COMMAND,
        arguments: [{ uri: document.uri, matchedIssue, issueId: suggestion.id, ruleId: suggestion.rule, isFileIgnore }],
      };

    return ignoreIssueAction;
  }

  private createShowIssueAction({
    document,
    matchedIssue,
  }: {
    document: vscode.TextDocument;
    matchedIssue: vscode.Diagnostic;
  }): vscode.CodeAction {
    const showIssueAction = new vscode.CodeAction(
      SHOW_ISSUE_ACTION_NAME,
      SnykIssuesActionProvider.providedCodeActionKinds[0],
    );

    const suggestion = this.findSuggestion(matchedIssue.message);
    if (suggestion)
      showIssueAction.command = {
        command: SNYK_OPEN_ISSUE_COMMAND,
        title: SNYK_OPEN_ISSUE_COMMAND,
        arguments: [matchedIssue.message, document.uri, matchedIssue.range, null],
      };

    return showIssueAction;
  }

  public provideCodeActions(
    document: vscode.TextDocument,
    clickedRange: vscode.Range,
  ): vscode.CodeAction[] | undefined {
    if (!this.issuesList || !this.issuesList.has(document.uri)) {
      return undefined;
    }
    const fileIssues = this.issuesList && this.issuesList.get(document.uri);
    const matchedIssue = findIssueWithRange(clickedRange, fileIssues);
    if (matchedIssue) {
      const codeActionParams = { document, matchedIssue };
      const showIssueAction = this.createShowIssueAction(codeActionParams);
      const ignoreIssueAction = this.createIgnoreIssueAction(codeActionParams);
      const fileIgnoreIssueAction = this.createIgnoreIssueAction({
        ...codeActionParams,
        isFileIgnore: true,
      });

      analytics.logQuickFixIsDisplayed({
        quickFixType: ['Show Suggestion', 'Ignore Suggestion In Line', 'Ignore Suggestion In File'],
        ide: IDE_NAME,
      });

      // returns list of actions, all new actions should be added to this list
      return [showIssueAction, ignoreIssueAction, fileIgnoreIssueAction];
    }

    return undefined;
  }
}

// disposable provider
export class DisposableCodeActionsProvider implements vscode.Disposable {
  private disposableProvider: vscode.Disposable | undefined;
  constructor(snykReview: vscode.DiagnosticCollection | undefined, callbacks: { [key: string]: Function }) {
    this.registerProvider(snykReview, callbacks);
  }

  private registerProvider(
    snykReview: vscode.DiagnosticCollection | undefined,
    callbacks: { [key: string]: Function },
  ) {
    this.disposableProvider = vscode.languages.registerCodeActionsProvider(
      { scheme: 'file', language: '*' },
      new SnykIssuesActionProvider(snykReview, callbacks),
      {
        providedCodeActionKinds: SnykIssuesActionProvider.providedCodeActionKinds,
      },
    );
  }

  dispose(): void {
    if (this.disposableProvider) {
      this.disposableProvider.dispose();
    }
  }
}
