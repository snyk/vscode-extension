import * as os from 'os';

export class Platform {
  static getCurrent(): NodeJS.Platform {
    return os.platform();
  }

  static getArch(): string {
    return os.arch();
  }

  static getVersion(): string {
    return `${os.release()}-${os.arch}`;
  }

  static getHomeDir(): string {
    return os.homedir();
  }
}
