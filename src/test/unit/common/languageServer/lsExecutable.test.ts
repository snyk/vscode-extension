import { strictEqual } from 'assert';
import path from 'path';
import sinon from 'sinon';
import { LsExecutable } from '../../../../snyk/common/languageServer/lsExecutable';
import { Platform } from '../../../../snyk/common/platform';

suite('LsExecutable', () => {
  teardown(() => {
    sinon.restore();
  });

  test('Returns correct filename for different platforms', () => {
    strictEqual(LsExecutable.getFilename('darwinAmd64'), 'darwin_amd64');
    strictEqual(LsExecutable.getFilename('darwinArm64'), 'darwin_arm64');
    strictEqual(LsExecutable.getFilename('linux386'), 'linux_386');
    strictEqual(LsExecutable.getFilename('linuxAmd64'), 'linux_amd64');
    strictEqual(LsExecutable.getFilename('linuxArm64'), 'linux_arm64');
    strictEqual(LsExecutable.getFilename('windows386'), 'windows_386.exe');
    strictEqual(LsExecutable.getFilename('windowsAmd64'), 'windows_amd64.exe');
  });
  test('Returns correct extension paths', () => {
    const unixExtensionDir = '/Users/user/.vscode/extensions/snyk-security.snyk-vulnerability-scanner-1.1.0';
    const getCurrentWithArchStub = sinon.stub(Platform, 'getCurrentWithArch');

    // OSX
    getCurrentWithArchStub.returns('darwinAmd64');
    let expectedCliPath = path.join(unixExtensionDir, 'darwin_amd64');
    strictEqual(LsExecutable.getPath(unixExtensionDir), expectedCliPath);

    getCurrentWithArchStub.returns('darwinArm64');
    expectedCliPath = path.join(unixExtensionDir, 'darwin_arm64');
    strictEqual(LsExecutable.getPath(unixExtensionDir), expectedCliPath);

    // Linux
    getCurrentWithArchStub.returns('linux386');
    expectedCliPath = path.join(unixExtensionDir, 'linux_386');
    strictEqual(LsExecutable.getPath(unixExtensionDir), expectedCliPath);

    getCurrentWithArchStub.returns('linuxAmd64');
    expectedCliPath = path.join(unixExtensionDir, 'linux_amd64');
    strictEqual(LsExecutable.getPath(unixExtensionDir), expectedCliPath);

    getCurrentWithArchStub.returns('linuxArm64');
    expectedCliPath = path.join(unixExtensionDir, 'linux_arm64');
    strictEqual(LsExecutable.getPath(unixExtensionDir), expectedCliPath);

    // Windows
    const winExtensionDir = `C:\\Users\\user\\.vscode\\extensions`;

    getCurrentWithArchStub.returns('windows386');
    expectedCliPath = path.join(winExtensionDir, 'windows_386.exe');
    strictEqual(LsExecutable.getPath(winExtensionDir), expectedCliPath);

    getCurrentWithArchStub.returns('windowsAmd64');
    expectedCliPath = path.join(winExtensionDir, 'windows_amd64.exe');
    strictEqual(LsExecutable.getPath(winExtensionDir), expectedCliPath);
  });

  test('Return custom path, if provided', () => {
    const customPath = '/path/to/cli';
    strictEqual(LsExecutable.getPath('', customPath), customPath);
  });
});
