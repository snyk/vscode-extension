import * as crypto from 'crypto';

export class Checksum {
  private readonly hash: crypto.Hash;
  private hexDigest: string;

  constructor(private expected: string) {
    this.hash = crypto.createHash('sha256');
  }

  get checksum(): string {
    return this.hexDigest;
  }

  verify(): boolean {
    return this.checksum === this.expected;
  }

  update(buffer: Buffer): void {
    this.hash.update(buffer);
  }

  digest(): Checksum {
    this.hexDigest = this.hash.digest('hex');
    return this;
  }
}
