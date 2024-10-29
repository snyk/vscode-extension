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
    strictEqual(CliExecutable.getFileName('linux'), 'snyk-linux');
    strictEqual(CliExecutable.getFileName('linux_alpine'), 'snyk-alpine');
    strictEqual(CliExecutable.getFileName('macos'), 'snyk-macos');
    strictEqual(CliExecutable.getFileName('macos_arm64'), 'snyk-macos-arm64');
    strictEqual(CliExecutable.getFileName('windows'), 'snyk-win.exe');
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
