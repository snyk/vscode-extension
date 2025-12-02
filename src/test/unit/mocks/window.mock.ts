import sinon from 'sinon';
import { IVSCodeWindow } from '../../../snyk/common/vscode/window';

export class WindowMock implements IVSCodeWindow {
  getActiveTextEditor = sinon.stub();
  createOutputChannel = sinon.stub();
  withProgress = sinon.stub();
  registerWebviewPanelSerializer = sinon.stub();
  showErrorMessage = sinon.stub();
  showInformationMessage = sinon.stub();
  onDidChangeActiveTextEditor = sinon.stub();
  createTextEditorDecorationType = sinon.stub();
  getVisibleTextEditors = sinon.stub();
  showTextDocument = sinon.stub();
  showTextDocumentViaUri = sinon.stub();
  showTextDocumentViaFilepath = sinon.stub();
  showInputBox = sinon.stub();
  showOpenDialog = sinon.stub();
  showQuickPick = sinon.stub();
}
