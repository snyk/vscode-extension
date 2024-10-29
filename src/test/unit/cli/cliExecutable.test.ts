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

  test('Returns correct extension paths', async () => {
    const unixExtensionDir = '/Users/user/.vscode/extensions/snyk-security.snyk-vulnerability-scanner-1.1.0';

    const stub = sinon.stub(Platform, 'getCurrent').returns('darwin');
    let expectedCliPath = path.join(unixExtensionDir, 'snyk-macos');
    strictEqual(await CliExecutable.getPath(unixExtensionDir), expectedCliPath);

    sinon.stub(Platform, 'getArch').returns('arm64');
    expectedCliPath = path.join(unixExtensionDir, 'snyk-macos-arm64');
    strictEqual(await CliExecutable.getPath(unixExtensionDir), expectedCliPath);

    stub.returns('linux');
    expectedCliPath = path.join(unixExtensionDir, 'snyk-linux');
    strictEqual(await CliExecutable.getPath(unixExtensionDir), expectedCliPath);

    const winExtensionDir = `C:\\Users\\user\\.vscode\\extensions`;
    stub.returns('win32');
    expectedCliPath = path.join(winExtensionDir, 'snyk-win.exe');
    strictEqual(await CliExecutable.getPath(winExtensionDir), expectedCliPath);
  });

  test('Return custom path, if provided', async () => {
    const customPath = '/path/to/cli';
    strictEqual(await CliExecutable.getPath('', customPath), customPath);
  });
});
