import path from 'path';
import os from 'os';
import { Checksum } from '../../cli/checksum';
import { LsSupportedPlatform } from './supportedPlatforms';

export class LsExecutable {
  public static filenameSuffixes: Record<LsSupportedPlatform, string> = {
    linux386: 'linux_386',
    linuxAmd64: 'linux_amd64',
    linuxArm64: 'linux_arm64',
    windows386: `windows_386.exe`,
    windowsAmd64: 'windows_amd64.exe',
    darwinAmd64: 'darwin_amd64',
    darwinArm64: 'darwin_arm64',
  };

  constructor(public readonly version: string, public readonly checksum: Checksum) {}

  static getFilename(platform: LsSupportedPlatform): string {
    return this.filenameSuffixes[platform];
  }

  static getPath(extensionDir: string, customPath?: string): string {
    if (customPath) {
      return customPath;
    }

    const platform = this.getCurrentWithArch();
    const fileName = LsExecutable.getFilename(platform);
    const lsPath = path.join(extensionDir, fileName);

    return lsPath;
  }

  static getCurrentWithArch(): LsSupportedPlatform {
    let opSys = os.platform().toString();
    if (opSys === 'win32') {
      opSys = 'windows';
    }
    let opArch = os.arch();
    if (opArch === 'x64') {
      opArch = 'amd64';
    }
    if (opArch === 'ia32') {
      opArch = '386';
    }

    return `${opSys}${opArch.charAt(0).toUpperCase()}${opArch.slice(1)}` as LsSupportedPlatform;
  }
}
