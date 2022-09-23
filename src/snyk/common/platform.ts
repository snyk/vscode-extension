import * as os from 'os';
import { LsSupportedPlatform, SupportedLsPlatformsList } from './languageServer/supportedPlatforms';

export class Platform {
  static getCurrent(): NodeJS.Platform {
    return os.platform();
  }

  static getCurrentWithArch(): LsSupportedPlatform | null {
    let opSys = os.platform().toString();
    if (opSys === 'win32') {
      opSys = 'windows';
    }
    let opArch = os.arch().toString();
    if (opArch === 'x64') {
      opArch = 'amd64';
    }
    let supportPlatform = `${opSys}${opArch.charAt(0).toUpperCase()}${opArch.slice(1)}`;
    if (SupportedLsPlatformsList[supportPlatform] === undefined) {
      return null;
    }
    return supportPlatform as LsSupportedPlatform;
  }

  static getVersion(): string {
    return `${os.release()}-${os.arch}`;
  }

  static getHomeDir(): string {
    return os.homedir();
  }
}
