import * as os from 'os';
import { LsSupportedPlatform } from '../cli/supportedPlatforms';

export class Platform {
  static getCurrent(): NodeJS.Platform {
    return os.platform();
  }

  static getCurrentWithArch(): LsSupportedPlatform {
    let opSys = os.platform().toString();
    if (opSys === 'win32') {
      opSys = 'windows';
    }
    let opArch = os.arch().toString();
    if (opArch === 'x64') {
      opArch = 'amd64';
    }

    return `${opSys}${opArch.charAt(0).toUpperCase()}${opArch.slice(1)}` as LsSupportedPlatform;
  }

  static getVersion(): string {
    return `${os.release()}-${os.arch}`;
  }

  static getHomeDir(): string {
    return os.homedir();
  }
}
