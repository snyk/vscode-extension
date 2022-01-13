import sinon from 'sinon';
import { IVSCodeEnv } from '../../../snyk/common/vscode/env';

export const envMock = {
  getRemoteName: sinon.fake(),
  getAppHost: sinon.fake(),
  getAppName: sinon.fake(),
  getUiKind: sinon.fake(),
} as IVSCodeEnv;
