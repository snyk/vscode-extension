import sinon from 'sinon';
import { IVSCodeClipboard } from '../../../snyk/common/vscode/clipboard';

export class ClipboardMock implements IVSCodeClipboard {
  writeText = sinon.stub();
}
