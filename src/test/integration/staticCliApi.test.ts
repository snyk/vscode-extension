import { strictEqual, ok, rejects } from 'assert';
import { StaticCliApi } from '../../snyk/cli/staticCliApi';
import { Configuration } from '../../snyk/common/configuration/configuration';
import { VSCodeWorkspace } from '../../snyk/common/vscode/workspace';
import { ILog, LogLevel } from '../../snyk/common/logger/interfaces';
import { CliSupportedPlatform } from '../../snyk/cli/supportedPlatforms';
import { Readable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

suite('StaticCliApi - Integration Tests', function () {
  // Set a longer timeout for network operations
  this.timeout(30000); // 30 seconds

  let api: StaticCliApi;
  let workspace: VSCodeWorkspace;
  let configuration: Configuration;
  let logger: ILog;

  setup(() => {
    workspace = new VSCodeWorkspace();
    configuration = new Configuration(process.env, workspace);

    // Create a simple logger implementation
    logger = {
      info: (message: string | unknown) => console.log(`[INFO] ${message}`),
      warn: (message: string | Error | unknown) => console.warn(`[WARN] ${message}`),
      error: (message: string | Error | unknown) => console.error(`[ERROR] ${message}`),
      debug: (message: string | unknown) => console.log(`[DEBUG] ${message}`),
      log: (level: LogLevel, message: string | Error | unknown) => console.log(`[${level}] ${message}`),
      showOutput: () => {}, // No-op for tests
    };

    api = new StaticCliApi(workspace, configuration, logger);
  });

  test('getLatestCliVersion returns a valid version string', async () => {
    const version = await api.getLatestCliVersion('stable');

    // Version should be in format like "1.1234.0" or "v1.1234.0"
    ok(version, 'Version should not be empty');
    ok(/^v?\d+\.\d+\.\d+/.test(version), `Version "${version}" should match semantic version pattern`);
  });

  test('getLatestCliVersion with preview channel returns a version', async () => {
    const version = await api.getLatestCliVersion('preview');

    ok(version, 'Preview version should not be empty');
    ok(/^v?\d+\.\d+\.\d+/.test(version), `Preview version "${version}" should match semantic version pattern`);
  });

  test('downloadBinary downloads actual CLI binary stream', async () => {
    // Test with Linux platform as it's smaller than other binaries
    const platform: CliSupportedPlatform = 'linux';
    const [downloadPromise, cancelToken] = await api.downloadBinary(platform);

    ok(downloadPromise, 'Download promise should exist');
    ok(cancelToken, 'Cancel token should exist');
    ok(cancelToken.cancel, 'Cancel token should have cancel method');

    const response = await downloadPromise;

    ok(response, 'Response should exist');
    ok(response.data, 'Response should have data stream');
    ok(response.data instanceof Readable, 'Data should be a readable stream');
    ok(response.headers, 'Response should have headers');

    // Read a few bytes to verify it's actual binary data
    const firstChunk = await new Promise<Buffer>((resolve, reject) => {
      response.data.once('data', (chunk: Buffer) => {
        resolve(chunk);
      });
      response.data.once('error', reject);
    });

    ok(firstChunk, 'Should receive data from stream');
    ok(firstChunk.length > 0, 'First chunk should have content');

    // Clean up - consume the rest of the stream
    response.data.resume();
    await new Promise(resolve => response.data.once('end', resolve));
  });

  test('downloadBinary can be cancelled', async () => {
    const platform: CliSupportedPlatform = 'linux';
    const [downloadPromise, cancelToken] = await api.downloadBinary(platform);

    // Cancel immediately
    cancelToken.cancel();

    // The download should fail with a cancellation error
    await rejects(downloadPromise, /cancelled|aborted/i, 'Download should fail when cancelled');
  });

  test('getSha256Checksum returns valid checksum', async () => {
    // Get a version first
    const version = await api.getLatestCliVersion('stable');
    const platform: CliSupportedPlatform = 'linux';

    const checksum = await api.getSha256Checksum(version, platform);

    ok(checksum, 'Checksum should not be empty');
    // SHA256 checksums are 64 characters in hex format
    strictEqual(checksum.length, 64, 'Checksum should be 64 characters long');
    ok(/^[a-f0-9]{64}$/.test(checksum), 'Checksum should be valid hex string');
  });

  test('getSha256Checksum handles version with and without v prefix', async () => {
    const version = await api.getLatestCliVersion('stable');
    const platform: CliSupportedPlatform = 'linux';

    // Remove 'v' prefix if present for testing
    const versionWithoutV = version.startsWith('v') ? version.substring(1) : version;
    const versionWithV = version.startsWith('v') ? version : `v${version}`;

    const checksum1 = await api.getSha256Checksum(versionWithoutV, platform);
    const checksum2 = await api.getSha256Checksum(versionWithV, platform);

    strictEqual(checksum1, checksum2, 'Checksums should be the same regardless of v prefix');
  });

  test('end-to-end: download and verify checksum', async () => {
    const platform: CliSupportedPlatform = 'linux';

    // Get latest version
    const version = await api.getLatestCliVersion('stable');
    console.log(`Testing with CLI version: ${version}`);

    // Get the expected checksum
    const expectedChecksum = await api.getSha256Checksum(version, platform);
    console.log(`Expected checksum: ${expectedChecksum}`);

    // Download the binary
    const [downloadPromise] = await api.downloadBinary(platform);
    const response = await downloadPromise;

    // Write to temporary file to calculate checksum
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'snyk-cli-test-'));
    const tempFile = path.join(tempDir, 'snyk-cli');

    try {
      // Write stream to file
      const writeStream = fs.createWriteStream(tempFile);
      await new Promise((resolve, reject) => {
        response.data.pipe(writeStream);
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
        response.data.on('error', reject);
      });

      // Calculate SHA256 of downloaded file
      const fileStream = fs.createReadStream(tempFile);
      const hash = crypto.createHash('sha256');

      for await (const chunk of fileStream) {
        hash.update(chunk);
      }
      const actualChecksum = hash.digest('hex');

      console.log(`Actual checksum: ${actualChecksum}`);
      strictEqual(actualChecksum, expectedChecksum, 'Downloaded file checksum should match expected checksum');

      // Verify file size is reasonable (CLI should be at least 10MB)
      const stats = await fs.promises.stat(tempFile);
      ok(stats.size > 10 * 1024 * 1024, `CLI binary should be larger than 10MB, got ${stats.size} bytes`);
    } finally {
      // Clean up
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  });

  test('handles network errors gracefully', async () => {
    // Create an API instance with invalid configuration
    const invalidConfig = new Configuration(process.env, workspace);

    // Override the base URL to an invalid one
    const originalGetUrl = invalidConfig.getCliBaseDownloadUrl.bind(invalidConfig);
    invalidConfig.getCliBaseDownloadUrl = () => 'https://invalid-domain-that-does-not-exist.example.com';

    const invalidApi = new StaticCliApi(workspace, invalidConfig, logger);

    // This should throw an error
    try {
      await invalidApi.getLatestCliVersion('stable');
      throw new Error('Expected getLatestCliVersion to throw an error');
    } catch (err) {
      // Accept any error since we're using an invalid domain
      ok(err, 'Should throw an error with invalid domain');
      console.log('Error caught as expected:', err);
    }

    // Restore original method
    invalidConfig.getCliBaseDownloadUrl = originalGetUrl;
  });
});
