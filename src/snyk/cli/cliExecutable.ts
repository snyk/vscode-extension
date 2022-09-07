import * as fs from 'fs/promises';
import path from 'path';
import { Platform } from '../common/platform';
import { Checksum } from './checksum';
import { SupportedPlatform } from './supportedPlatforms';

export class CliExecutable {
  // If values updated, `.vscodeignore` to be changed.
  public static filenameSuffixes: Record<SupportedPlatform, string> = {
    linux: 'snyk-linux',
    win32: 'snyk-win.exe',
    darwin: 'snyk-macos',
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
    const fileName = CliExecutable.getFilename(platform as SupportedPlatform);
    const cliPath = path.join(extensionDir, fileName);

    return cliPath;
  }

  static exists(extensionDir: string, customPath?: string): Promise<boolean> {
    return fs
      .access(CliExecutable.getPath(extensionDir, customPath))
      .then(() => true)
      .catch(() => false);
  }
}
