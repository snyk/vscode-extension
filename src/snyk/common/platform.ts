import * as os from 'os';

export class Platform {
  static getCurrent(): NodeJS.Platform {
    return os.platform();
  }
}
