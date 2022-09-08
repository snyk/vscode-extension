import path from 'path';
import { Checksum } from '../../cli/checksum';
import { SupportedPlatform } from '../../cli/supportedPlatforms';
import { Platform } from '../../common/platform';

export class LsExecutable {
  // If values updated, `.vscodeignore` to be changed.
  public static filenameSuffixes: Record<SupportedPlatform, string> = {
    linux: 'snyk-ls-linux',
    win32: 'snyk-ls-win.exe',
    darwin: 'snyk-ls-macos',
  };

  constructor(public readonly version: string, public readonly checksum: Checksum) {}

  static getFilename(platform: SupportedPlatform): string {
    return this.filenameSuffixes[platform];
  }

  static getPath(extensionDir: string, customPath?: string): string {
    if (customPath) {
      return customPath;
    }

    const platform = Platform.getCurrent();
    const fileName = LsExecutable.getFilename(platform as SupportedPlatform);
    const lsPath = path.join(extensionDir, fileName);

    return lsPath;
  }
}
