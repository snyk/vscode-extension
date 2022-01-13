import { strictEqual } from 'assert';
import { OnUncaughtException } from '../../../../../snyk/common/error/integrations/onUncaughtException';

suite('ErrorReporter OnUncaughtException Integration', () => {
  let uncaughtExceptionIntegration: OnUncaughtException;

  setup(() => {
    uncaughtExceptionIntegration = new OnUncaughtException({
      extensionPath: '/Users/snyk/.vscode/extensions/snyk-security.snyk-vulnerability-scanner-1.2.4',
    });
  });

  test('Is extension origin error', () => {
    const error = new Error();
    error.stack = `Error: test error
    at Test.Runnable.run (/Users/snyk/.vscode/extensions/snyk-security.snyk-vulnerability-scanner-1.2.4/out/extension.js:100:5)`;

    const res = uncaughtExceptionIntegration.isExtensionOriginError(error);

    strictEqual(res, true);
  });

  test('Is not extension origin error - another extension stacktrace', () => {
    const posixError = new Error();
    posixError.stack = `Error: test error
    at Test.Runnable.run (/Users/snyk/.vscode/extensions/microsoft.sample-extension-1.2.4/out/extension.js:100:5)`;

    const winError = new Error();
    winError.stack = `Error: test error
    at Test.Runnable.run (C:\\Users\\snyk\\.vscode\\extensions\\microsoft.sample-extension-1.2.4\\out\\extension.js:100:5)`;

    const posixRes = uncaughtExceptionIntegration.isExtensionOriginError(posixError);
    const winRes = uncaughtExceptionIntegration.isExtensionOriginError(winError);

    strictEqual(posixRes, false);
    strictEqual(winRes, false);
  });

  test('Is not extension origin error - extension name within path', () => {
    const error = new Error();
    error.stack = `/Users/snyk/Git/vscode-extension/snyk-security.snyk-vulnerability-scanner`;

    const res = uncaughtExceptionIntegration.isExtensionOriginError(error);

    strictEqual(res, false);
  });

  test('Is not extension origin error - no stacktrace', () => {
    const error = new Error();
    error.stack = undefined;

    const res = uncaughtExceptionIntegration.isExtensionOriginError(error);

    strictEqual(res, false);
  });
});
