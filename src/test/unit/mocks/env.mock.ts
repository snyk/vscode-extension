import sinon from 'sinon';
import { IVSCodeEnv } from '../../../snyk/common/vscode/env';
import { ClipboardMock } from './clipboard.mock';

export class EnvMock implements IVSCodeEnv {
  private clipboardMock = new ClipboardMock();

  getRemoteName = sinon.stub();
  getAppHost = sinon.stub();
  getAppName = sinon.stub();
  getUiKind = sinon.stub();

  getClipboard() {
    return this.clipboardMock;
  }
}
