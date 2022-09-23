import os from 'os';
import path from 'path';
import { Checksum } from '../../cli/checksum';
import { Platform } from '../platform';
import { LsSupportedPlatform } from './supportedPlatforms';

export class LsExecutable {
  private static filenamePrefix = 'snyk-ls';
  public static filenameSuffixes: Record<LsSupportedPlatform, string> = {
    linux386: 'linux_386',
    linuxAmd64: 'linux_amd64',
    linuxArm64: 'linux_arm64',
    windows386: 'windows_386.exe',
    windowsAmd64: 'windows_amd64.exe',
    darwinAmd64: 'darwin_amd64',
    darwinArm64: 'darwin_arm64',
  };

  public static defaultPaths: Record<LsSupportedPlatform, string> = {
    linux386: process.env.XDG_DATA_HOME ?? '/.local/share/',
    linuxAmd64: process.env.XDG_DATA_HOME ?? '/.local/share/',
    linuxArm64: process.env.XDG_DATA_HOME ?? '/.local/share/',
    windows386: process.env.XDG_DATA_HOME ?? '\\AppData\\Local\\snyk\\',
    windowsAmd64: process.env.XDG_DATA_HOME ?? '\\AppData\\Local\\snyk\\',
    darwinAmd64: process.env.XDG_DATA_HOME ?? '/Library/Application Support/',
    darwinArm64: process.env.XDG_DATA_HOME ?? '/Library/Application Support/',
  };

  constructor(public readonly version: string, public readonly checksum: Checksum) {}

  static getFilename(platform: LsSupportedPlatform): string {
    return `${this.filenamePrefix}_${this.filenameSuffixes[platform]}`;
  }

  static getVersionedFilename(platform: LsSupportedPlatform, version: string) {
    return `${this.filenamePrefix}_${version}_${this.filenameSuffixes[platform]}`;
  }

  static getPath(customPath?: string): string {
    if (customPath) {
      return customPath;
    }

    const platform = this.getCurrentWithArch();
    const homeDir = Platform.getHomeDir();
    const lsFilename = this.filenameSuffixes[platform];
    const defaultPath = this.defaultPaths[platform];

    return path.join(homeDir, defaultPath, lsFilename);
  }

  static getCurrentWithArch(): LsSupportedPlatform {
    let opSys = os.platform().toString();
    if (opSys === 'win32') {
      opSys = 'windows';
    }
    let opArch = os.arch();
    if (opArch === 'x64') {
      opArch = 'amd64';
    }
    if (opArch === 'ia32') {
      opArch = '386';
    }

    return `${opSys}${opArch.charAt(0).toUpperCase()}${opArch.slice(1)}` as LsSupportedPlatform;
  }
}
