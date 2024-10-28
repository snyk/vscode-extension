import { strictEqual } from 'assert';
import os from 'os';
import path from 'path';
import sinon from 'sinon';
import { CliExecutable } from '../../../../snyk/cli/cliExecutable';
import { LsSupportedPlatform } from '../../../../snyk/cli/supportedPlatforms';

suite('LsExecutable', () => {
  teardown(() => {
    sinon.restore();
  });

  test('Returns correct filename for different platforms', () => {
    strictEqual(CliExecutable.getFileName('darwinAmd64'), 'snyk-ls_darwin_amd64');
    strictEqual(CliExecutable.getFileName('darwinArm64'), 'snyk-ls_darwin_arm64');
    strictEqual(CliExecutable.getFileName('linux386'), 'snyk-ls_linux_386');
    strictEqual(CliExecutable.getFileName('linuxAmd64'), 'snyk-ls_linux_amd64');
    strictEqual(CliExecutable.getFileName('linuxArm64'), 'snyk-ls_linux_arm64');
    strictEqual(CliExecutable.getFileName('windows386'), 'snyk-ls_windows_386.exe');
    strictEqual(CliExecutable.getFileName('windowsAmd64'), 'snyk-ls_windows_amd64.exe');
  });

  test('Returns correct paths', () => {
    const homedirStub = sinon.stub(os, 'homedir');
    const getCurrentWithArchStub = sinon.stub(CliExecutable, 'getCurrentWithArch');

    // DarwinAmd64
    let macOSPlatform: LsSupportedPlatform = 'darwinAmd64';
    let homedir = '/Users/user';
    getCurrentWithArchStub.returns(macOSPlatform);
    homedirStub.returns(homedir);

    let expectedFilename = CliExecutable.getFileName(macOSPlatform);
    let expectedCliPath = path.join(homedir, '/Library/Application Support/', 'snyk-ls', expectedFilename);
    strictEqual(CliExecutable.getPath(), expectedCliPath);

    // DarwinArm64
    macOSPlatform = 'darwinArm64';
    getCurrentWithArchStub.returns(macOSPlatform);

    expectedFilename = CliExecutable.getFileName(macOSPlatform);
    expectedCliPath = path.join(homedir, '/Library/Application Support/', 'snyk-ls', expectedFilename);
    strictEqual(CliExecutable.getPath(), expectedCliPath);

    // Linux386
    let linuxPlatform: LsSupportedPlatform = 'linux386';
    homedir = '/home/user';
    getCurrentWithArchStub.returns(linuxPlatform);
    homedirStub.returns(homedir);

    expectedFilename = CliExecutable.getFileName(linuxPlatform);
    expectedCliPath = path.join(homedir, '/.local/share/', 'snyk-ls', expectedFilename);
    strictEqual(CliExecutable.getPath(), expectedCliPath);

    // LinuxAmd64
    linuxPlatform = 'linuxAmd64';
    getCurrentWithArchStub.returns(linuxPlatform);

    expectedFilename = CliExecutable.getFileName(linuxPlatform);
    expectedCliPath = path.join(homedir, '/.local/share/', 'snyk-ls', expectedFilename);
    strictEqual(CliExecutable.getPath(), expectedCliPath);

    // LinuxArm64
    linuxPlatform = 'linuxArm64';
    getCurrentWithArchStub.returns(linuxPlatform);

    expectedFilename = CliExecutable.getFileName(linuxPlatform);
    expectedCliPath = path.join(homedir, '/.local/share/', 'snyk-ls', expectedFilename);
    strictEqual(CliExecutable.getPath(), expectedCliPath);

    // Windows386
    let windowsPlatform: LsSupportedPlatform = 'windows386';
    homedir = 'C:\\Users\\user';
    getCurrentWithArchStub.returns(windowsPlatform);
    homedirStub.returns(homedir);

    expectedFilename = CliExecutable.getFileName(windowsPlatform);
    expectedCliPath = path.join(homedir, '\\AppData\\Local\\', 'snyk-ls', expectedFilename);
    strictEqual(CliExecutable.getPath(), expectedCliPath);

    // WindowsAmd64
    windowsPlatform = 'windowsAmd64';
    getCurrentWithArchStub.returns(windowsPlatform);

    expectedFilename = CliExecutable.getFileName(windowsPlatform);
    expectedCliPath = path.join(homedir, '\\AppData\\Local\\', 'snyk-ls', expectedFilename);
    strictEqual(CliExecutable.getPath(), expectedCliPath);
  });

  test('Return custom path, if provided', () => {
    const customPath = '/path/to/cli';
    strictEqual(CliExecutable.getPath(customPath), customPath);
  });

  test('Returns correct platform architecture', () => {
    const platformStub = sinon.stub(os, 'platform');
    const archStub = sinon.stub(os, 'arch');

    // OSX
    platformStub.returns('darwin');
    archStub.returns('x64');
    strictEqual(CliExecutable.getCurrentWithArch(), 'darwinAmd64');

    archStub.returns('arm64');
    strictEqual(CliExecutable.getCurrentWithArch(), 'darwinArm64');

    // Linux
    platformStub.returns('linux');
    archStub.returns('x64');
    strictEqual(CliExecutable.getCurrentWithArch(), 'linuxAmd64');

    archStub.returns('arm64');
    strictEqual(CliExecutable.getCurrentWithArch(), 'linuxArm64');

    archStub.returns('ia32');
    strictEqual(CliExecutable.getCurrentWithArch(), 'linux386');

    // Windows
    platformStub.returns('win32');
    archStub.returns('x64');
    strictEqual(CliExecutable.getCurrentWithArch(), 'windowsAmd64');

    archStub.returns('ia32');
    strictEqual(CliExecutable.getCurrentWithArch(), 'windows386');
  });
});
