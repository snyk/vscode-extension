import sinon from 'sinon';
import { IVSCodeWindow } from '../../../snyk/common/vscode/window';

export const windowMock = {
  withProgress: sinon.fake(),
  registerWebviewPanelSerializer: sinon.fake(),
  showErrorMessage: sinon.fake(),
  showInformationMessage: sinon.fake(),
} as IVSCodeWindow;
