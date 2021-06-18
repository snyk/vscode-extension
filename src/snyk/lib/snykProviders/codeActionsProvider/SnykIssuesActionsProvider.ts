/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable no-param-reassign */
/* eslint-disable @typescript-eslint/ban-types */
import * as _ from 'lodash';
import * as vscode from 'vscode';
import {
  FILE_IGNORE_ACTION_NAME,
  FILE_IGNORE_ISSUE_BASE_COMMENT_TEXT,
  IGNORE_ISSUE_ACTION_NAME,
  IGNORE_ISSUE_BASE_COMMENT_TEXT,
  SHOW_ISSUE_ACTION_NAME,
} from '../../../constants/analysis';
import {
  SNYK_IGNORE_ISSUE_COMMAND,
  SNYK_OPEN_ISSUE_COMMAND,
  VSCODE_ADD_COMMENT_COMMAND,
} from '../../../constants/commands';
import { COMMAND_DEBOUNCE_INTERVAL } from '../../../constants/general';
import { findIssueWithRange, ignoreIssueCommentText } from '../../../utils/analysisUtils';

export class SnykIssuesActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  private issuesList: vscode.DiagnosticCollection | undefined;
  private findSuggestion: Function;
  private trackIgnoreSuggestion: Function;

  constructor(issuesList: vscode.DiagnosticCollection | undefined, callbacks: { [key: string]: Function }) {
    this.issuesList = issuesList;
    this.registerIgnoreIssuesCommand();
    this.findSuggestion = callbacks.findSuggestion;
    this.trackIgnoreSuggestion = callbacks.trackIgnoreSuggestion;
  }

  private registerIgnoreIssuesCommand() {
    vscode.commands.registerCommand(SNYK_IGNORE_ISSUE_COMMAND, this.ignoreIssues.bind(this));
  }

  private ignoreIssues = _.debounce(
    async ({
      uri,
      matchedIssue,
      issueId,
      ruleId,
      isFileIgnore,
    }: {
      uri?: vscode.Uri;
      matchedIssue: {
        severity: number;
        message: string;
        range: vscode.Range;
      };
      issueId: string;
      ruleId: string;
      isFileIgnore?: boolean;
    }): Promise<void> => {
      this.trackIgnoreSuggestion(matchedIssue.severity, {
        message: matchedIssue.message,
        data: {
          issueId,
          isFileIgnore: !!isFileIgnore,
        },
      });
      const issueText: string = ignoreIssueCommentText(ruleId, isFileIgnore);
      const editor: vscode.TextEditor | undefined =
        (uri &&
          (await vscode.window.showTextDocument(uri, {
            viewColumn: vscode.ViewColumn.One,
            selection: matchedIssue.range,
          }))) ||
        vscode.window.activeTextEditor;
      if (!editor || !issueText || !matchedIssue) {
        return;
      }
      const symbolIndexToInsert = editor.document.lineAt(matchedIssue.range.start.line)
        .firstNonWhitespaceCharacterIndex;
      let issuePosition = new vscode.Position(matchedIssue.range.start.line, symbolIndexToInsert);

      let snykCommentPostition: vscode.Position | undefined;
      if (issuePosition.line > 0) {
        const prevLineRange = new vscode.Range(
          new vscode.Position(issuePosition.line - 1, 0),
          new vscode.Position(issuePosition.line, 0),
        );
        const prevLine = editor.document.getText(prevLineRange).split('\n').shift() || '';
        // We have 3 cases:
        // 1) prevLine doesn't include any dcignore line
        // 2) prevLine is a dcignore comment
        // 3) prevLine is a file dcignore comment
        if (prevLine.includes(IGNORE_ISSUE_BASE_COMMENT_TEXT)) {
          if (prevLine.includes(FILE_IGNORE_ISSUE_BASE_COMMENT_TEXT)) {
            // case number 3
            if (isFileIgnore) snykCommentPostition = new vscode.Position(prevLineRange.start.line, prevLine.length);
            // if !isFileIgnore we want to write a new comment instead of adding to the previous one
          } else if (!isFileIgnore) {
            // case number 2
            snykCommentPostition = new vscode.Position(prevLineRange.start.line, prevLine.length);
          } else {
            // we want to write a new comment 2 lines above the issue
            issuePosition = issuePosition.with(issuePosition.line - 1);
          }
        }
      }
      if (snykCommentPostition) {
        const position = snykCommentPostition;
        // if deepcode ignore of issue already exists, paste next comment in same line after existing comment
        void editor.edit((e: vscode.TextEditorEdit) => e.insert(position, `, ${issueText}`));
      } else {
        void editor.edit((e: vscode.TextEditorEdit) =>
          e.insert(issuePosition, this.addSpacesToText(`${issueText}\n`, symbolIndexToInsert)),
        );
      }
      editor.selections = [new vscode.Selection(issuePosition, issuePosition)];
      if (!snykCommentPostition) {
        await vscode.commands.executeCommand(VSCODE_ADD_COMMENT_COMMAND);
      }
      await editor.document.save();
    },
    COMMAND_DEBOUNCE_INTERVAL,
    { leading: true, trailing: false },
  );

  private addSpacesToText(text = '', spacesCount = 0): string {
    if (!spacesCount) {
      return text;
    }
    while (spacesCount) {
      text += ` `;
      spacesCount -= 1;
    }
    return text;
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

  public dispose() {
    if (this.disposableProvider) {
      this.disposableProvider.dispose();
    }
  }
}
