import { strictEqual } from 'assert';
import path from 'path';
import fs from 'fs/promises';
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
    const winExtensionDir = `C:\\Users\\user\\.vscode\\extensions`;

    const osStub = sinon.stub(Platform, 'getCurrent').returns('darwin');
    const archStub = sinon.stub(Platform, 'getArch').returns('x64');

    let expectedCliPath = path.join(unixExtensionDir, 'snyk-macos');
    strictEqual(await CliExecutable.getPath(unixExtensionDir), expectedCliPath);

    osStub.returns('linux');
    expectedCliPath = path.join(unixExtensionDir, 'snyk-linux');
    strictEqual(await CliExecutable.getPath(unixExtensionDir), expectedCliPath);

    sinon.stub(fs, 'access').returns(Promise.resolve());
    expectedCliPath = path.join(unixExtensionDir, 'snyk-linux-alpine');
    strictEqual(await CliExecutable.getPath(unixExtensionDir), expectedCliPath);
    sinon.stub(fs, 'access').returns(Promise.reject());

    osStub.returns('win32');
    expectedCliPath = path.join(winExtensionDir, 'snyk-win.exe');
    strictEqual(await CliExecutable.getPath(winExtensionDir), expectedCliPath);

    // test arm64
    archStub.returns('arm64');

    osStub.returns('darwin');
    expectedCliPath = path.join(unixExtensionDir, 'snyk-macos-arm64');
    strictEqual(await CliExecutable.getPath(unixExtensionDir), expectedCliPath);

    osStub.returns('linux');
    expectedCliPath = path.join(unixExtensionDir, 'snyk-linux-arm64');
    strictEqual(await CliExecutable.getPath(unixExtensionDir), expectedCliPath);

    sinon.stub(fs, 'access').returns(Promise.resolve());
    expectedCliPath = path.join(unixExtensionDir, 'snyk-linux-alpine-arm64');
    strictEqual(await CliExecutable.getPath(unixExtensionDir), expectedCliPath);
    sinon.stub(fs, 'access').returns(Promise.reject());

    osStub.returns('win32');
    expectedCliPath = path.join(winExtensionDir, 'snyk-win.exe');
    strictEqual(await CliExecutable.getPath(winExtensionDir), expectedCliPath);
  });

  test('Return custom path, if provided', async () => {
    const customPath = '/path/to/cli';
    strictEqual(await CliExecutable.getPath('', customPath), customPath);
  });
});
