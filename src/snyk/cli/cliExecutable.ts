import * as fs from 'fs/promises';
import path from 'path';
import { Platform } from '../common/platform';
import { Checksum } from './checksum';
import { CliSupportedPlatform } from './supportedPlatforms';

// TODO: This file is to be removed in VS Code + Language Server feature cleanup. We need to ensure all users have migrated to use CLI path that's set by the language server.
export class CliExecutable {
  // If values updated, `.vscodeignore` to be changed.
  public static filenameSuffixes: Record<CliSupportedPlatform, string> = {
    linux: 'snyk-linux',
    win32: 'snyk-win.exe',
    darwin: 'snyk-macos',
  };

  constructor(public readonly version: string, public readonly checksum: Checksum) {}

  static getFilename(platform: CliSupportedPlatform): string {
    return this.filenameSuffixes[platform];
  }

  static getPath(extensionDir: string, customPath?: string): string {
    if (customPath) {
      return customPath;
    }

    const platform = Platform.getCurrent();
    const fileName = CliExecutable.getFilename(platform as CliSupportedPlatform);
    return path.join(extensionDir, fileName);
  }

  static exists(extensionDir: string, customPath?: string): Promise<boolean> {
    return fs
      .access(CliExecutable.getPath(extensionDir, customPath))
      .then(() => true)
      .catch(() => false);
  }
}
