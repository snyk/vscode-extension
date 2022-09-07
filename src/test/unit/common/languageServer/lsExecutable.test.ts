import { strictEqual } from 'assert';
import path from 'path';
import sinon from 'sinon';
import { LsExecutable } from '../../../../snyk/common/languageServer/lsExecutable';
import { Platform } from '../../../../snyk/common/platform';

suite.only('CliExecutable', () => {
  teardown(() => {
    sinon.restore();
  });

  test('Returns correct filename for different platforms', () => {
    strictEqual(LsExecutable.getFilename('linux'), 'snyk-ls-linux');
    strictEqual(LsExecutable.getFilename('darwin'), 'snyk-ls-macos');
    strictEqual(LsExecutable.getFilename('win32'), 'snyk-ls-win.exe');
  });

  test('Returns correct extension paths', () => {
    const unixExtensionDir = '/Users/user/.vscode/extensions/snyk-security.snyk-vulnerability-scanner-1.1.0';

    const stub = sinon.stub(Platform, 'getCurrent').returns('darwin');
    let expectedCliPath = path.join(unixExtensionDir, 'snyk-ls-macos');
    strictEqual(LsExecutable.getPath(unixExtensionDir), expectedCliPath);

    stub.returns('linux');
    expectedCliPath = path.join(unixExtensionDir, 'snyk-ls-linux');
    strictEqual(LsExecutable.getPath(unixExtensionDir), expectedCliPath);

    const winExtensionDir = `C:\\Users\\user\\.vscode\\extensions`;
    stub.returns('win32');
    expectedCliPath = path.join(winExtensionDir, 'snyk-ls-win.exe');
    strictEqual(LsExecutable.getPath(winExtensionDir), expectedCliPath);
  });

  test('Return custom path, if provided', () => {
    const customPath = '/path/to/cli';
    strictEqual(LsExecutable.getPath('', customPath), customPath);
  });
});
