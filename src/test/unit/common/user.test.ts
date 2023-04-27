/* eslint-disable @typescript-eslint/no-unused-vars */
import { strictEqual } from 'assert';
import sinon from 'sinon';
import { IAnalytics } from '../../../snyk/common/analytics/itly';
import { User, UserDto } from '../../../snyk/common/user';
import { IVSCodeCommands } from '../../../snyk/common/vscode/commands';

suite('User', () => {
  test('Identification calls analytics identify', async () => {
    const identifyFake = sinon.fake();
    const analytics = {
      identify: identifyFake,
    } as unknown as IAnalytics;
    const commandExecutor = {
      executeCommand(_command, ..._rest) {
        return Promise.resolve({ id: 'test', username: 't' } as UserDto);
      },
    } as IVSCodeCommands;

    const user = new User();
    await user.identify(commandExecutor, analytics);

    strictEqual(identifyFake.called, true);
  });

  test('Returns authenticated id in SHA-256', () => {
    const user = new User(undefined, '185958e2-6317-4543-b9bc-960d94890353');

    strictEqual(
      user.hashedAuthenticatedId?.toLowerCase(),
      '40bd8b947f75ab4fe3f8e557761856a00a3ce421229f6cf55636b63b94a35b64',
    );
  });
});
