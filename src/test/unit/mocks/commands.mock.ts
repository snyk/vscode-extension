import sinon from 'sinon';
import { IVSCodeCommands } from '../../../snyk/common/vscode/commands';

export class CommandsMock implements IVSCodeCommands {
  executeCommand = sinon.stub();
}
