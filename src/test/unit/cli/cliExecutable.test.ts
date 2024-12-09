import { strictEqual } from 'assert';
import path from 'path';
import os from 'os';
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
    const homedirStub = sinon.stub(os, 'homedir');
    const unixExtensionDir = '/.local/share/snyk/vscode-cli';
    const macOsExtensionDir = '/Library/Application Support/snyk/vscode-cli';

    const osStub = sinon.stub(Platform, 'getCurrent').returns('darwin');
    const archStub = sinon.stub(Platform, 'getArch').returns('x64');
    const fsStub = sinon.stub(fs, 'access').returns(Promise.reject());
    let homedir = '/home/user';
    homedirStub.returns(homedir);

    let expectedCliPath = path.join(Platform.getHomeDir(), macOsExtensionDir, 'snyk-macos');
    strictEqual(await CliExecutable.getPath(), expectedCliPath);

    osStub.returns('linux');
    expectedCliPath = path.join(Platform.getHomeDir(), unixExtensionDir, 'snyk-linux');
    strictEqual(await CliExecutable.getPath(), expectedCliPath);

    fsStub.returns(Promise.resolve());
    expectedCliPath = path.join(Platform.getHomeDir(), unixExtensionDir, 'snyk-alpine');
    strictEqual(await CliExecutable.getPath(), expectedCliPath);
    fsStub.returns(Promise.reject());

    osStub.returns('win32');
    homedir = 'C:\\Users\\user';
    homedirStub.returns(homedir);
    expectedCliPath = path.join(Platform.getHomeDir(), '\\AppData\\Local\\', 'snyk', 'vscode-cli', 'snyk-win.exe');
    const actualPath = await CliExecutable.getPath();
    strictEqual(actualPath, expectedCliPath);

    // test arm64
    archStub.returns('arm64');

    osStub.returns('darwin');
    homedir = '/home/user';
    homedirStub.returns(homedir);
    expectedCliPath = path.join(Platform.getHomeDir(), macOsExtensionDir, 'snyk-macos-arm64');
    strictEqual(await CliExecutable.getPath(), expectedCliPath);

    osStub.returns('linux');
    expectedCliPath = path.join(Platform.getHomeDir(), unixExtensionDir, 'snyk-linux-arm64');
    strictEqual(await CliExecutable.getPath(), expectedCliPath);

    fsStub.returns(Promise.resolve());
    expectedCliPath = path.join(Platform.getHomeDir(), unixExtensionDir, 'snyk-alpine-arm64');
    strictEqual(await CliExecutable.getPath(), expectedCliPath);
    fsStub.returns(Promise.reject());

    osStub.returns('win32');
    homedir = 'C:\\Users\\user';
    homedirStub.returns(homedir);
    expectedCliPath = path.join(Platform.getHomeDir(), '\\AppData\\Local\\', 'snyk', 'vscode-cli', 'snyk-win.exe');
    strictEqual(await CliExecutable.getPath(), expectedCliPath);
  });

  test('Return custom path, if provided', async () => {
    const customPath = '/path/to/cli';
    strictEqual(await CliExecutable.getPath(customPath), customPath);
  });
});
