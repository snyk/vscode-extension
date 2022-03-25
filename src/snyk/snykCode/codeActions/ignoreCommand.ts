import _ from 'lodash';
import * as vscode from 'vscode';
import { VSCODE_ADD_COMMENT_COMMAND } from '../../common/constants/commands';
import { COMMAND_DEBOUNCE_INTERVAL } from '../../common/constants/general';
import { IGNORE_ISSUE_BASE_COMMENT_TEXT, FILE_IGNORE_ISSUE_BASE_COMMENT_TEXT } from '../constants/analysis';
import { ignoreIssueCommentText, getSnykSeverity } from '../utils/analysisUtils';

export class IgnoreCommand {
  static ignoreIssues = _.debounce(
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
      IgnoreCommand.trackIgnoreSuggestion(matchedIssue.severity, {
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
      const symbolIndexToInsert = editor.document.lineAt(
        matchedIssue.range.start.line,
      ).firstNonWhitespaceCharacterIndex;
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
          e.insert(issuePosition, IgnoreCommand.addSpacesToText(`${issueText}\n`, symbolIndexToInsert)),
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

  static addSpacesToText(text = '', spacesCount = 0): string {
    if (!spacesCount) {
      return text;
    }
    while (spacesCount) {
      text += ` `;
      spacesCount -= 1;
    }
    return text;
  }

  static trackIgnoreSuggestion(vscodeSeverity: number, options: { [key: string]: any }): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    options.data = {
      severity: getSnykSeverity(vscodeSeverity),
      ...options.data,
    };
  }
}
