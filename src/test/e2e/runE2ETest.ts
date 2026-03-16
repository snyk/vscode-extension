/**
 * E2E test runner — launches VS Code via @vscode/test-electron with a real LS.
 *
 * Requires SNYK_TOKEN to be set.
 *
 * Usage:
 *   SNYK_TOKEN="..." npm run test:e2e                                   # run all
 *   SNYK_TOKEN="..." npm run test:e2e -- --grep 'my test or suite name' # filter by name
 *
 * Any args after `--` are forwarded to Mocha inside the VS Code host process.
 * No need to manually rebuild, `npm run test:e2e` includes it.
 * Regardless of `--grep` passed, all "CORE: " prefixed tests will always run.
 */
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { runTests } from '@vscode/test-electron';
import { TestEnvVars } from '../testConstants';

// The folder containing the Extension Manifest package.json
// Passed to `--extensionDevelopmentPath`.
const extensionDevelopmentPath = path.resolve(__dirname, '../../../');
// The path to the test runner.
// Passed to `--extensionTestsPath`.
const extensionTestsPath = path.resolve(__dirname, './index');
const mockedDataSourcePath = path.resolve(__dirname, '../../../src/test/integration/mocked_data');

async function main() {
  try {
    console.log('STARTING E2E TESTS');

    // E2E auth: The caller sets SNYK_TOKEN (the standard env var). We move it
    // to SNYK_VSCE_TEST_TOKEN so the LS starts unauthenticated and the auth
    // test can exercise the full login flow.
    const snykToken = process.env.SNYK_TOKEN;
    if (!snykToken) {
      console.error('ERROR: SNYK_TOKEN env var must be set to run E2E tests.');
      process.exit(1);
    }
    process.env[TestEnvVars.TOKEN] = snykToken;
    delete process.env.SNYK_TOKEN;

    // Forward CLI args (after `--`) to Mocha inside the VS Code host.
    // Example: npm run test:e2e -- --grep 'my test name'
    const additionalArgs = process.argv.slice(2); // Skip 'node' and script name
    if (additionalArgs.length > 0) {
      process.env[TestEnvVars.MOCHA_CLI_ARGS] = JSON.stringify(additionalArgs);
    }

    // Create an isolated temp copy of the workspace folder
    const tempDirPath = fs.mkdtempSync(path.join(os.tmpdir(), 'vscode-e2e-test-run-'));
    const tempMockedData = path.join(tempDirPath, 'mocked_data');
    fs.cpSync(mockedDataSourcePath, tempMockedData, { recursive: true });
    console.log(`  Temp mocked data folder: ${tempMockedData}`);

    // Remove stale user-data settings from previous runs, then optionally
    // write back a single CLI override requested via env var.
    // Only one of CLI_PATH or CLI_RELEASE_CHANNEL may be set.
    const userSettingsPath = path.resolve(
      extensionDevelopmentPath,
      '.vscode-test',
      'user-data',
      'User',
      'settings.json',
    );
    const cliPath = process.env[TestEnvVars.CLI_PATH];
    const cliReleaseChannel = process.env[TestEnvVars.CLI_RELEASE_CHANNEL];
    if (cliPath && cliReleaseChannel) {
      console.error('ERROR: Set either `SNYK_VSCE_TEST_CLI_PATH` or `SNYK_VSCE_TEST_CLI_RELEASE_CHANNEL`, not both.');
      process.exit(1);
    }
    if (cliPath) {
      const settings = { 'snyk.advanced.cliPath': cliPath, 'snyk.advanced.automaticDependencyManagement': false };
      fs.mkdirSync(path.dirname(userSettingsPath), { recursive: true });
      fs.writeFileSync(userSettingsPath, JSON.stringify(settings, null, 2) + '\n');
      console.log(`  CLI path override: ${cliPath} (automatic dependency management disabled)`);
      console.log(`  Setting overrides saved to: ${userSettingsPath}`);
    } else if (cliReleaseChannel) {
      const settings = { 'snyk.advanced.cliReleaseChannel': cliReleaseChannel };
      fs.mkdirSync(path.dirname(userSettingsPath), { recursive: true });
      fs.writeFileSync(userSettingsPath, JSON.stringify(settings, null, 2) + '\n');
      console.log(`  CLI release channel override: ${cliReleaseChannel}`);
      console.log(`  Setting overrides saved to: ${userSettingsPath}`);
    } else if (fs.existsSync(userSettingsPath)) {
      fs.unlinkSync(userSettingsPath);
      console.log(`  Removed stale user settings: ${userSettingsPath}`);
    }

    console.log(`  Log level: ${process.env.SNYK_LOG_LEVEL ?? '(unset, will default to info)'}`);
    if (!process.env.SNYK_LOG_LEVEL) {
      process.env.SNYK_LOG_LEVEL = 'info';
    }

    // E2E tests launch VS Code as close to normal as possible — no hacks, no
    // disabled built-in extensions, no skipping of LS initialization. The only
    // concessions are headless-friendly flags and in-memory secret storage.
    const launchArgs = [
      '--new-window',
      '--use-inmemory-secretstorage', // Prevent OS keychain pop-ups
      '--skip-add-to-recently-opened',
      '--disable-workspace-trust',
      tempMockedData,
    ];

    // Download VS Code, unzip it and run the E2E tests.
    await runTests({ extensionDevelopmentPath, extensionTestsPath, launchArgs });

    // Cleanup.
    fs.rmSync(tempDirPath, { recursive: true, force: true });

    console.log('E2E TESTS COMPLETED SUCCESSFULLY');
  } catch (err) {
    console.error('Failed to run E2E tests', err);
    process.exit(1);
  }
}

void main();
