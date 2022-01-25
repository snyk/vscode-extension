import sinon from 'sinon';
import { IVSCodeWindow } from '../../../snyk/common/vscode/window';

export const windowMock = {
  getActiveTextEditor: sinon.fake(),
  withProgress: sinon.fake(),
  registerWebviewPanelSerializer: sinon.fake(),
  showErrorMessage: sinon.fake(),
  showInformationMessage: sinon.fake(),
  onDidChangeActiveTextEditor: sinon.fake(),
  createTextEditorDecorationType: sinon.fake(),
  getVisibleTextEditors: sinon.fake(),
  showTextDocument: sinon.fake(),
} as IVSCodeWindow;
