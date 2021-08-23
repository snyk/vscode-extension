import path from 'path';
import { Platform } from '../common/platform';
import * as fs from 'fs/promises';
import { Checksum } from './checksum';
import { CliSupportedPlatform } from './supportedPlatforms';

export class CliExecutable {
  public static filenameSuffixes: Record<CliSupportedPlatform, string> = {
    linux: 'snyk-linux',
    win32: 'snyk-win.exe',
    darwin: 'snyk-macos',
  };

  constructor(public readonly version: string, public readonly checksum: Checksum) {}

  static getFilename(platform: CliSupportedPlatform): string {
    return this.filenameSuffixes[platform];
  }

  static getPath(extensionDir: string): string {
    const platform = Platform.getCurrent();
    const fileName = CliExecutable.getFilename(platform as CliSupportedPlatform);
    const cliPath = path.join(extensionDir, fileName);

    return cliPath;
  }

  static exists(extensionDir: string): Promise<boolean> {
    return fs
      .access(CliExecutable.getPath(extensionDir))
      .then(() => true)
      .catch(() => false);
  }
}
