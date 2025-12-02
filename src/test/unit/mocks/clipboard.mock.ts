import sinon from 'sinon';
import { IVSCodeClipboard } from '../../../snyk/common/vscode/clipboard';

export const clipboardMock = {
  writeText: sinon.fake(),
} as IVSCodeClipboard;
