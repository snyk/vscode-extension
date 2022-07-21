import { strictEqual } from 'assert';
import path from 'path';
import sinon from 'sinon';
import { CliExecutable } from '../../../snyk/cli/cliExecutable';
import { Platform } from '../../../snyk/common/platform';

suite('CliExecutable', () => {
  teardown(() => {
    sinon.restore();
  });

  test('Returns correct filename for different platforms', () => {
    strictEqual(CliExecutable.getFilename('linux'), 'snyk-linux');
    strictEqual(CliExecutable.getFilename('darwin'), 'snyk-macos');
    strictEqual(CliExecutable.getFilename('win32'), 'snyk-win.exe');
  });

  test('Returns correct extension paths', () => {
    const unixExtensionDir = '/Users/user/.vscode/extensions/snyk-security.snyk-vulnerability-scanner-1.1.0';

    const stub = sinon.stub(Platform, 'getCurrent').returns('darwin');
    let expectedCliPath = path.join(unixExtensionDir, 'snyk-macos');
    strictEqual(CliExecutable.getPath(unixExtensionDir), expectedCliPath);

    stub.returns('linux');
    expectedCliPath = path.join(unixExtensionDir, 'snyk-linux');
    strictEqual(CliExecutable.getPath(unixExtensionDir), expectedCliPath);

    const winExtensionDir = `C:\\Users\\user\\.vscode\\extensions`;
    stub.returns('win32');
    expectedCliPath = path.join(winExtensionDir, 'snyk-win.exe');
    strictEqual(CliExecutable.getPath(winExtensionDir), expectedCliPath);
  });

  test('Return custom path, if provided', () => {
    const customPath = '/path/to/cli';
    strictEqual(CliExecutable.getPath('', customPath), customPath);
  });
});
