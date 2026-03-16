/**
 * Integration test runner — launches VS Code via @vscode/test-electron.
 *
 * Usage:
 *   npm run test:integration                                      # run all tests in all workspace modes
 *   npm run test:integration -- --grep 'my test name'             # filter by name
 *   npm run test:integration -- --grep 'Simultaneous'             # filter by suite
 *   npm run test:integration -- --grep 'changing org' --timeout 0 # with extra mocha args
 *
 * Any args after `--` are forwarded to Mocha inside the VS Code host process.
 * No need to manually rebuild, `npm run test:integration` includes it.
 */
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { runTests } from '@vscode/test-electron';
import { TestEnvVars } from '../testConstants';

async function main() {
  try {
    console.log('STARTING INTEGRATION TESTS');

    // Forward CLI args (after `--`) to Mocha inside the VS Code host.
    // Example: npm run test:integration -- --grep 'my test name'
    const additionalArgs = process.argv.slice(2); // Skip 'node' and script name
    if (additionalArgs.length > 0) {
      process.env[TestEnvVars.MOCHA_CLI_ARGS] = JSON.stringify(additionalArgs);
    }

    // The folder containing the extension manifest ('package.json').
    // Passed to `--extensionDevelopmentPath`.
    const extensionDevelopmentPath = path.resolve(__dirname, '../../../');
    // The path to the test runner.
    // Passed to `--extensionTestsPath`.
    const extensionTestsPath = path.resolve(__dirname, './index');
    const mockedDataSourcePath = path.resolve(__dirname, '../../../src/test/integration/mocked_data');

    // Create an isolated temp copy of the workspace folder
    const tempDirPath = fs.mkdtempSync(path.join(os.tmpdir(), 'vscode-integration-test-run-'));
    const tempMockedData = path.join(tempDirPath, 'mocked_data');
    fs.cpSync(mockedDataSourcePath, tempMockedData, { recursive: true });
    console.log(`  Temp mocked data folder: ${tempMockedData}`);

    // Remove stale user-data settings from previous runs.
    // Changed machine-scoped settings persist in '.vscode-test/user-data/User/settings.json' across runs.
    const userSettingsPath = path.resolve(
      extensionDevelopmentPath,
      '.vscode-test',
      'user-data',
      'User',
      'settings.json',
    );
    if (fs.existsSync(userSettingsPath)) {
      fs.unlinkSync(userSettingsPath);
      console.log(`  Removed stale user settings: ${userSettingsPath}`);
    }

    console.log(`  Log level: ${process.env.SNYK_LOG_LEVEL ?? '(unset, will default to info)'}`);
    if (!process.env.SNYK_LOG_LEVEL) {
      process.env.SNYK_LOG_LEVEL = 'info';
    }

    const launchArgs = [
      '--new-window',
      '--use-inmemory-secretstorage', // Prevent OS keychain pop-ups
      '--skip-add-to-recently-opened',
      '--skip-welcome',
      '--skip-release-notes',
      '--disable-workspace-trust',
      '--disable-extensions', // Doesn't disable our extension
      '--disable-telemetry',
      '--disable-experiments',
      '--disable-updates',
      tempMockedData,
    ];

    // Skip the prelaunch setup that compiles and prepares built-in extensions
    process.env.VSCODE_SKIP_PRELAUNCH = '1';

    // Set integration test mode to prevent LS initialization during tests
    process.env[TestEnvVars.INTEGRATION_MODE] = 'true';

    // Download VS Code, unzip it and run the integration tests.
    await runTests({ extensionDevelopmentPath, extensionTestsPath, launchArgs });

    // Cleanup.
    fs.rmSync(tempDirPath, { recursive: true, force: true });

    console.log('INTEGRATION TESTS COMPLETED SUCCESSFULLY');
  } catch (err) {
    console.error('Failed to run tests', err);
    process.exit(1);
  }
}

void main();
