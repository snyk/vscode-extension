export class CliVersion {
  private readonly identifiers: string[];

  constructor(version: string) {
    this.identifiers = version.split('.');
    if (this.identifiers.length != 3) {
      throw new Error('CLI version must have dot separation.');
    }
  }

  isLatest(version: CliVersion): boolean {
    return !this.isNewVersionAvailable(this.identifiers, version.identifiers);
  }

  private isNewVersionAvailable(currentVersion: string[], latestVersion: string[]): boolean {
    if (latestVersion[0] > currentVersion[0]) {
      return true;
    } else if (currentVersion.length == 1) {
      return false;
    }

    return this.isNewVersionAvailable(currentVersion.slice(1), latestVersion.slice(1));
  }
}
