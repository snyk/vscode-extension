import path from 'path';
import fs from 'fs/promises';
import { CliSupportedPlatform } from './supportedPlatforms';
import { Checksum } from './checksum';
import { Platform } from '../common/platform';

export class CliExecutable {
  public static filenameSuffixes: Record<CliSupportedPlatform, string> = {
    linux: 'snyk-linux',
    linux_arm64: 'snyk-linux-arm64',
    linux_alpine: 'snyk-alpine',
    linux_alpine_arm64: 'snyk-alpine-arm64',
    macos: 'snyk-macos',
    macos_arm64: 'snyk-macos-arm64',
    windows: 'snyk-win.exe',
    windows_arm64: 'snyk-win.exe',
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
    const osName = Platform.getCurrent().toString().toLowerCase();
    const archSuffix = Platform.getArch().toLowerCase();
    const platform = await this.getPlatformName(osName);

    let cliName = platform;
    if (archSuffix === 'arm64') {
      cliName = `${platform}_${archSuffix}`;
    }
    return cliName as CliSupportedPlatform;
  }

  static async getPlatformName(osName: string): Promise<string> {
    let platform = '';
    if (osName === 'linux') {
      if (await this.isAlpine()) {
        platform = 'linux_alpine';
      } else {
        platform = 'linux';
      }
    } else if (osName === 'darwin') {
      platform = 'macos';
    } else if (osName === 'win32') {
      platform = 'windows';
    }
    if (!platform) {
      throw new Error(`${osName} is unsupported.`);
    }
    return platform;
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
