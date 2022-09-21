import { strictEqual, throws } from 'assert';
import os from 'os';
import path from 'path';
import sinon from 'sinon';
import { LsExecutable } from '../../../../snyk/common/languageServer/lsExecutable';
import { LsSupportedPlatform } from '../../../../snyk/common/languageServer/supportedPlatforms';

suite('LsExecutable', () => {
  teardown(() => {
    sinon.restore();
  });

  test('Returns correct filename for different platforms', () => {
    strictEqual(LsExecutable.getFilename('darwinAmd64'), 'snyk-ls_darwin_amd64');
    strictEqual(LsExecutable.getFilename('darwinArm64'), 'snyk-ls_darwin_arm64');
    strictEqual(LsExecutable.getFilename('linux386'), 'snyk-ls_linux_386');
    strictEqual(LsExecutable.getFilename('linuxAmd64'), 'snyk-ls_linux_amd64');
    strictEqual(LsExecutable.getFilename('linuxArm64'), 'snyk-ls_linux_arm64');
    strictEqual(LsExecutable.getFilename('windows386'), 'snyk-ls_windows_386.exe');
    strictEqual(LsExecutable.getFilename('windowsAmd64'), 'snyk-ls_windows_amd64.exe');
  });
  test('Returns correct extension paths', () => {
    const homedirStub = sinon.stub(os, 'homedir');
    const getCurrentWithArchStub = sinon.stub(LsExecutable, 'getCurrentWithArch');

    // DarwinAmd64
    let osxPlatform: LsSupportedPlatform = 'darwinAmd64';
    let homedir = '/Users/user';
    getCurrentWithArchStub.returns(osxPlatform);
    homedirStub.returns(homedir);

    let expectedFilename = LsExecutable.getFilename(osxPlatform);
    let expectedCliPath = path.join(homedir, '/Library/Application Support/', expectedFilename);
    strictEqual(LsExecutable.getPath(), expectedCliPath);

    // DarwinArm64
    osxPlatform = 'darwinArm64';
    getCurrentWithArchStub.returns(osxPlatform);

    expectedFilename = LsExecutable.getFilename(osxPlatform);
    expectedCliPath = path.join(homedir, '/Library/Application Support/', expectedFilename);
    strictEqual(LsExecutable.getPath(), expectedCliPath);

    // Linux386
    let linuxPlatform: LsSupportedPlatform = 'linux386';
    homedir = '/home/user';
    getCurrentWithArchStub.returns(linuxPlatform);
    homedirStub.returns(homedir);

    expectedFilename = LsExecutable.getFilename(linuxPlatform);
    expectedCliPath = path.join(homedir, '/.local/share/', expectedFilename);
    strictEqual(LsExecutable.getPath(), expectedCliPath);

    // LinuxAmd64
    linuxPlatform = 'linuxAmd64';
    getCurrentWithArchStub.returns(linuxPlatform);

    expectedFilename = LsExecutable.getFilename(linuxPlatform);
    expectedCliPath = path.join(homedir, '/.local/share/', expectedFilename);
    strictEqual(LsExecutable.getPath(), expectedCliPath);

    // LinuxArm64
    linuxPlatform = 'linuxArm64';
    getCurrentWithArchStub.returns(linuxPlatform);

    expectedFilename = LsExecutable.getFilename(linuxPlatform);
    expectedCliPath = path.join(homedir, '/.local/share/', expectedFilename);
    strictEqual(LsExecutable.getPath(), expectedCliPath);

    // Windows386
    let windowsPlatform: LsSupportedPlatform = 'windows386';
    homedir = 'C:\\Users\\user';
    getCurrentWithArchStub.returns(windowsPlatform);
    homedirStub.returns(homedir);

    expectedFilename = LsExecutable.getFilename(windowsPlatform);
    expectedCliPath = path.join(homedir, '\\AppData\\Local\\snyk\\', expectedFilename);
    strictEqual(LsExecutable.getPath(), expectedCliPath);

    // WindowsAmd64
    windowsPlatform = 'windowsAmd64';
    getCurrentWithArchStub.returns(windowsPlatform);

    expectedFilename = LsExecutable.getFilename(windowsPlatform);
    expectedCliPath = path.join(homedir, '\\AppData\\Local\\snyk\\', expectedFilename);
    strictEqual(LsExecutable.getPath(), expectedCliPath);
  });

  test('Return custom path, if provided', () => {
    const customPath = '/path/to/cli';
    strictEqual(LsExecutable.getPath(customPath), customPath);
  });

  test('Returns correct platform architecture', () => {
    const platformStub = sinon.stub(os, 'platform');
    const archStub = sinon.stub(os, 'arch');

    // OSX
    platformStub.returns('darwin');
    archStub.returns('x64');
    strictEqual(LsExecutable.getCurrentWithArch(), 'darwinAmd64');

    archStub.returns('arm64');
    strictEqual(LsExecutable.getCurrentWithArch(), 'darwinArm64');

    // Linux
    platformStub.returns('linux');
    archStub.returns('x64');
    strictEqual(LsExecutable.getCurrentWithArch(), 'linuxAmd64');

    archStub.returns('arm64');
    strictEqual(LsExecutable.getCurrentWithArch(), 'linuxArm64');

    archStub.returns('ia32');
    strictEqual(LsExecutable.getCurrentWithArch(), 'linux386');

    // Windows
    platformStub.returns('win32');
    archStub.returns('x64');
    strictEqual(LsExecutable.getCurrentWithArch(), 'windowsAmd64');

    archStub.returns('ia32');
    strictEqual(LsExecutable.getCurrentWithArch(), 'windows386');
  });
});
