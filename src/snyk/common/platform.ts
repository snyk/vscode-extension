import * as os from 'os';
import { LsSupportedPlatform, SupportedLsPlatformsList } from './languageServer/supportedPlatforms';

export class Platform {
  static getCurrent(): NodeJS.Platform {
    return os.platform();
  }

  static getVersion(): string {
    return `${os.release()}-${os.arch}`;
  }

  static getHomeDir(): string {
    return os.homedir();
  }
}
