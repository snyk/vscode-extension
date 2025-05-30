import { strictEqual } from 'assert';
import { User } from '../../../snyk/common/user';

suite('User', () => {
  test('Returns authenticated id in SHA-256', () => {
    const user = new User(undefined, '185958e2-6317-4543-b9bc-960d94890353');

    strictEqual(
      user.hashedAuthenticatedId?.toLowerCase(),
      '40bd8b947f75ab4fe3f8e557761856a00a3ce421229f6cf55636b63b94a35b64',
    );
  });
});
