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

    const apiUrl = configuration.autofixBaseURL;

    // Replace editor content.
    const payload = {
      input_code: editor.document.getText(),
      rule_id: ruleId,
      line_num: matchedIssue.range.start.line,
    };
    // Make gRPC call
    const response = {
      fixes: [
        'define([], function() {\n\n  var NUM_ELEMENTS = 2;\n  var ELEMENT_BYTES = 4;\n\n  function Vec2Array(n) {\n    this.bufStorage = new ArrayBuffer(NUM_ELEMENTS * n * ELEMENT_BYTES);\n    this.buf = new Float32Array(this.bufStorage, 0, NUM_ELEMENTS * n);\n    for(var i=0; i\u003cn; i++) {\n      this[i] = new Float32Array(this.bufStorage, i * NUM_ELEMENTS * 4, NUM_ELEMENTS);\n    }\n  }\n\n  Vec2Array.prototype = Object.create(Array.prototype);\n\n  return Vec2Array;\n});',
        'define([], function() {\n\n  var NUM_ELEMENTS = 2;\n  var ELEMENT_BYTES = 4;\n\n  function Vec2Array(n) {\n    this.bufStorage = new ArrayBuffer(NUM_ELEMENTS * n * ELEMENT_BYTES);\n    this.buf = new Float32Array(this.bufStorage, 0, NUM_ELEMENTS * n);\n    for(var i=0; i\u003cn; i++) {\n      this[i] = new Float32Array(this.bufStorage, i * NUM_ELEMENTS * 4, NUM_ELEMENTS);\n    }\n  }\n\n  Vec2Array.prototype = Object.create(Array.prototype);\n\n\n  return Vec2Array;\n});',
      ],
    };

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
