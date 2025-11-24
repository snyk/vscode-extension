import sinon from 'sinon';
import { IVSCodeEnv } from '../../../snyk/common/vscode/env';
import { clipboardMock } from './clipboard.mock';

export const envMock = {
  getRemoteName: sinon.fake(),
  getAppHost: sinon.fake(),
  getAppName: sinon.fake(),
  getUiKind: sinon.fake(),
  getClipboard: sinon.fake.returns(clipboardMock),
} as IVSCodeEnv;
