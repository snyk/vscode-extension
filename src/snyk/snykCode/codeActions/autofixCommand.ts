import _ from 'lodash';
import * as vscode from 'vscode';
import { GetFixSuggestions } from '../../../api/grpc_autofix';

import { COMMAND_DEBOUNCE_INTERVAL } from '../../common/constants/general';

export const autofixIssue = _.debounce(
  async ({
    uri,
    matchedIssue,
    ruleId,
  }: {
    uri?: vscode.Uri;
    matchedIssue: {
      severity: number;
      message: string;
      range: vscode.Range;
      source: string;
    };
    ruleId: string;
  }): Promise<void> => {
    const editor: vscode.TextEditor | undefined =
      (uri &&
        (await vscode.window.showTextDocument(uri, {
          viewColumn: vscode.ViewColumn.One,
          selection: matchedIssue.range,
        }))) ||
      vscode.window.activeTextEditor;
    if (!editor || !matchedIssue) {
      return;
    }

    // Replace editor content.
    const payload = {
      inputCode: editor.document.getText(),
      ruleId,
      lineNum: matchedIssue.range.start.line,
    };
    const response = await GetFixSuggestions(payload);

    if (response.fixes.length === 0) {
      void vscode.window.showWarningMessage('Autofix not available for this issue');
      return;
    }

    const replaceContent = response.fixes[0];
    const replaceStart = editor.document.lineAt(0).range.start;
    const replaceEnd = editor.document.lineAt(editor.document.lineCount - 1).range.end;
    const replaceRange = new vscode.Range(replaceStart, replaceEnd);

    void editor.edit((e: vscode.TextEditorEdit) => {
      e.replace(replaceRange, replaceContent);
    });

    void vscode.window.showInformationMessage(`Autofix applied for ${matchedIssue.source} issue`);

    await editor.document.save();
  },
  COMMAND_DEBOUNCE_INTERVAL,
  { leading: true, trailing: false },
);
