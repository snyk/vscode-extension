import path from 'path';
import fs from 'fs/promises';
import { CliSupportedPlatform } from './supportedPlatforms';
import { Checksum } from './checksum';
import { Platform } from '../common/platform';

export class CliExecutable {
  public static defaultPaths: Record<CliSupportedPlatform, string> = {
    linux: process.env.XDG_DATA_HOME ?? '/.local/share/',
    // eslint-disable-next-line camelcase
    linux_arm64: process.env.XDG_DATA_HOME ?? '/.local/share/',
    // eslint-disable-next-line camelcase
    linux_alpine: process.env.XDG_DATA_HOME ?? '/.local/share/',
    // eslint-disable-next-line camelcase
    linux_alpine_arm64: process.env.XDG_DATA_HOME ?? '/.local/share/',
    macos: process.env.XDG_DATA_HOME ?? '/Library/Application Support/',
    // eslint-disable-next-line camelcase
    macos_arm64: process.env.XDG_DATA_HOME ?? '/Library/Application Support/',
    windows: process.env.XDG_DATA_HOME ?? '\\AppData\\Local\\',
    // eslint-disable-next-line camelcase
    windows_arm64: process.env.XDG_DATA_HOME ?? '\\AppData\\Local\\',
  };

  public static filenameSuffixes: Record<CliSupportedPlatform, string> = {
    linux: 'snyk-linux',
    // eslint-disable-next-line camelcase
    linux_arm64: 'snyk-linux-arm64',
    // eslint-disable-next-line camelcase
    linux_alpine: 'snyk-alpine',
    // eslint-disable-next-line camelcase
    linux_alpine_arm64: 'snyk-alpine-arm64',
    macos: 'snyk-macos',
    // eslint-disable-next-line camelcase
    macos_arm64: 'snyk-macos-arm64',
    windows: 'snyk-win.exe',
    // eslint-disable-next-line camelcase
    windows_arm64: 'snyk-win.exe',
  };

  constructor(public readonly version: string, public readonly checksum: Checksum) {}

  static async getPath(customPath?: string): Promise<string> {
    if (customPath) {
      return customPath;
    }
    const platform = await CliExecutable.getCurrentWithArch();
    const homeDir = Platform.getHomeDir();
    const defaultPath = this.defaultPaths[platform];
    const fileName = CliExecutable.getFileName(platform);
    const cliDir = path.join(homeDir, defaultPath, 'snyk', 'vscode-cli');
    return path.join(cliDir, fileName);
  }

  static getFileName(platform: CliSupportedPlatform): string {
    return this.filenameSuffixes[platform];
  }

  static async getCurrentWithArch(): Promise<CliSupportedPlatform> {
    const osName = Platform.getCurrent().toString().toLowerCase();
    const archSuffix = Platform.getArch().toLowerCase();
    const platform = await CliExecutable.getPlatformName(osName);

    let cliName = platform;
    if (archSuffix === 'arm64') {
      cliName = `${platform}_${archSuffix}`;
    }
    return cliName as CliSupportedPlatform;
  }

  static async getPlatformName(osName: string): Promise<string> {
    let platform = '';
    if (osName === 'linux') {
      if (await CliExecutable.isAlpine()) {
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

  public static isPathInExtensionDirectory(dirPath: string, filePath: string): boolean {
    const normalizedDir = path.resolve(dirPath) + path.sep;
    const normalizedFile = path.resolve(filePath);

    return normalizedFile.toLowerCase().startsWith(normalizedDir.toLowerCase());
  }

  static async exists(customPath?: string): Promise<boolean> {
    return fs
      .access(await CliExecutable.getPath(customPath))
      .then(() => true)
      .catch(() => false);
  }

  static async isAlpine(): Promise<boolean> {
    try {
      await fs.access('/etc/alpine-release');
      return true;
    } catch (e) {
      return false;
    }
  }
}
