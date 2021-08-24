import * as crypto from 'crypto';
import * as fs from 'fs';

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

  static getChecksumOf(filePath: string, expectedChecksum: string): Promise<Checksum> {
    return new Promise((resolve, reject) => {
      const checksum = new Checksum(expectedChecksum);
      const fileStream = fs.createReadStream(filePath);

      fileStream.on('error', err => {
        reject(err);
      });

      fileStream.on('data', (chunk: Buffer) => {
        checksum.update(chunk);
      });

      fileStream.on('end', function () {
        checksum.digest();
        return resolve(checksum);
      });
    });
  }

  static fromDigest(digest: string, expected: string): Checksum {
    const d = new Checksum(expected);
    d.hexDigest = digest;

    return d;
  }
}
