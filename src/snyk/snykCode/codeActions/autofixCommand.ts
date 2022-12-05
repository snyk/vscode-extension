import _ from 'lodash';
import * as vscode from 'vscode';
import { configuration } from '../../common/configuration/instance';
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

    const editorText = editor.document.getText();

    console.log('Autofix issue', { uri, apiUrl: configuration.autofixBaseURL, matchedIssue, ruleId });

    // Replace editor content.
    // TODO: get content from API
    const replaceContent = '<sample autofix file contents>';
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
