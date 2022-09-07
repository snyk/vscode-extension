import path from 'path';
import { Platform } from '../../common/platform';
import { SupportedPlatform } from '../../cli/supportedPlatforms';

export class LsExecutable {
  // If values updated, `.vscodeignore` to be changed.
  public static filenameSuffixes: Record<SupportedPlatform, string> = {
    linux: 'snyk-ls-linux',
    win32: 'snyk-ls-win.exe',
    darwin: 'snyk-ls-macos',
  };

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
