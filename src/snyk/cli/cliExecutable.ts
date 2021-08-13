import path from 'path';
import { Platform } from '../common/platform';
import { SupportedPlatformsType } from './downloader';
import * as fs from 'fs/promises';
import { Checksum } from './checksum';

export class CliExecutable {
  public static filenameSuffixes: Record<SupportedPlatformsType, string> = {
    linux: 'snyk-linux',
    win32: 'snyk-win.exe',
    darwin: 'snyk-macos',
  };

  constructor(public readonly version: string, public readonly checksum: Checksum) {}

  static getFilename(platform: SupportedPlatformsType): string {
    return this.filenameSuffixes[platform];
  }

  static getPath(extensionDir: string): string {
    const platform = Platform.getCurrent();
    const fileName = CliExecutable.getFilename(platform as SupportedPlatformsType);
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
