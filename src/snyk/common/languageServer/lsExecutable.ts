import path from 'path';
import { Checksum } from '../../cli/checksum';
import { Platform } from '../../common/platform';
import { LsSupportedPlatform } from './supportedPlatforms';

export class LsExecutable {
  // If values updated, `.vscodeignore` to be changed.
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

    const platform = Platform.getCurrentWithArch();
    const fileName = LsExecutable.getFilename(platform as LsSupportedPlatform);
    const lsPath = path.join(extensionDir, fileName);

    return lsPath;
  }
}
