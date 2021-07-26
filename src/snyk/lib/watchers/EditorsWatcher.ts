import * as vscode from 'vscode';
import { ExtensionInterface, openedTextEditorType, SnykWatcherInterface } from '../../../interfaces/SnykInterfaces';

class SnykEditorsWatcher implements SnykWatcherInterface {
  private currentTextEditors: {
    [key: string]: openedTextEditorType;
  } = {};

  private createEditorInfo(editor: vscode.TextEditor): void {
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
    vscode.window.onDidChangeActiveTextEditor((editor: vscode.TextEditor | undefined) => {
      if (editor && !this.currentTextEditors[editor.document.fileName]) {
        this.createEditorInfo(editor);
      }
    });
  }

  private watchClosingEditor() {
    vscode.workspace.onDidCloseTextDocument((document: vscode.TextDocument) => {
      delete this.currentTextEditors[document.fileName];
    });
  }

  private watchEditorCodeChanges(extension: ExtensionInterface) {
    vscode.workspace.onDidChangeTextDocument((event: vscode.TextDocumentChangeEvent) => {
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
        void extension.analyzer.updateReviewResultsPositions(extension, this.currentTextEditors[currentEditorFileName]);
      }
    });
  }

  private async prepareWatchers(extension: ExtensionInterface): Promise<void> {
    for await (const editor of vscode.window.visibleTextEditors) {
      this.createEditorInfo(editor);
    }
    this.watchEditorsNavChange();
    this.watchClosingEditor();
    this.watchEditorCodeChanges(extension);
  }

  public activate(extension: ExtensionInterface): void {
    void this.prepareWatchers(extension);
  }
}

export default SnykEditorsWatcher;
