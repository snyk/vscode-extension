import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { CliSupportedPlatform } from './supportedPlatforms';
import { Checksum } from './checksum';

export class CliExecutable {
  public static filenameSuffixes: Record<CliSupportedPlatform, string> = {
    linux: 'snyk-linux',
    linux_alpine: 'snyk-alpine',
    macos: 'snyk-macos',
    macos_arm64: 'snyk-macos-arm64',
    windows: 'snyk-win.exe',
  };
  constructor(public readonly version: string, public readonly checksum: Checksum) {}

  static async getPath(extensionDir: string, customPath?: string): Promise<string> {
    if (customPath) {
      return customPath;
    }

    const platform = await this.getCurrentWithArch();
    const fileName = this.getFileName(platform);
    return path.join(extensionDir, fileName);
  }

  static getFileName(platform: CliSupportedPlatform): string {
    return this.filenameSuffixes[platform];
  }

  static async getCurrentWithArch(): Promise<CliSupportedPlatform> {
    let platform = '';
    const osName = os.platform().toString().toLowerCase();
    const archName = os.arch().toLowerCase();
    if (osName === 'linux') {
      if (await this.isAlpine()) {
        platform = 'linux_alpine';
      } else {
        platform = 'linux';
      }
    } else if (osName === 'darwin') {
      if (archName === 'arm64') {
        platform = 'macos_arm64';
      } else {
        platform = 'macos';
      }
    } else if (osName.includes('win')) {
      platform = 'windows';
    }
    if (!platform) {
      throw new Error(`${osName} is unsupported.`);
    }

    return platform as CliSupportedPlatform;
  }

  static async exists(extensionDir: string, customPath?: string): Promise<boolean> {
    return fs
      .access(await CliExecutable.getPath(extensionDir, customPath))
      .then(() => true)
      .catch(() => false);
  }

  static isAlpine(): Promise<boolean> {
    return fs
      .access('/etc/alpine-release')
      .then(() => true)
      .catch(() => false);
  }
}
