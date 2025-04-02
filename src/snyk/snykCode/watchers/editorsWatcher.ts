import * as vscode from 'vscode';
import { TextDocument, TextDocumentChangeEvent, TextEditor } from '../../common/vscode/types';
import { IWatcher } from '../../common/watchers/interfaces';
import { openedTextEditorType } from '../interfaces';

class SnykEditorsWatcher implements IWatcher {
  private currentTextEditors: {
    [key: string]: openedTextEditorType;
  } = {};

  private createEditorInfo(editor: TextEditor): void {
    const path = editor.document.fileName;

    const workspacePath = (vscode.workspace.workspaceFolders || [])
      .map(f => f.uri.fsPath)
      .find(p => editor.document.fileName.includes(p));

    this.currentTextEditors[editor.document.fileName] = {
      fullPath: path,
      workspace: workspacePath || '',
      lineCount: {
        current: editor.document.lineCount,
        prevOffset: 0,
      },
      contentChanges: [],
      document: editor.document,
    };
  }

  private watchEditorsNavChange() {
    vscode.window.onDidChangeActiveTextEditor((editor: TextEditor | undefined) => {
      if (editor && !this.currentTextEditors[editor.document.fileName]) {
        this.createEditorInfo(editor);
      }
    });
  }

  private watchClosingEditor() {
    vscode.workspace.onDidCloseTextDocument((document: TextDocument) => {
      delete this.currentTextEditors[document.fileName];
    });
  }

  private watchEditorCodeChanges() {
    vscode.workspace.onDidChangeTextDocument((event: TextDocumentChangeEvent) => {
      const currentEditorFileName = event.document.fileName;
      if (this.currentTextEditors[currentEditorFileName] && event.contentChanges && event.contentChanges.length) {
        const curentLineCount = this.currentTextEditors[currentEditorFileName].lineCount.current;
        this.currentTextEditors[currentEditorFileName] = {
          ...this.currentTextEditors[currentEditorFileName],
          lineCount: {
            current: event.document.lineCount,
            prevOffset: event.document.lineCount - curentLineCount,
          },
          contentChanges: [...event.contentChanges],
          document: event.document,
        };
      }
    });
  }

  private async prepareWatchers(): Promise<void> {
    for await (const editor of vscode.window.visibleTextEditors) {
      this.createEditorInfo(editor);
    }
    this.watchEditorsNavChange();
    this.watchClosingEditor();
    this.watchEditorCodeChanges();
  }

  public activate(): void {
    void this.prepareWatchers();
  }
}

export default SnykEditorsWatcher;
