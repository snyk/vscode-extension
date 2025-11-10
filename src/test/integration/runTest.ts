import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { runTests } from '@vscode/test-electron';

async function main() {
  try {
    console.log('STARTING TESTS');

    // Capture additional command line arguments for Mocha
    const additionalArgs = process.argv.slice(2); // Skip 'node' and script name
    if (additionalArgs.length > 0) {
      process.env.TEST_MOCHA_CLI_ARGS = JSON.stringify(additionalArgs);
    }

    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname, '../../../');

    // The path to test runner
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(__dirname, './index');

    // Create a fresh workspace file in a temp directory for each test run to help ensure clean state
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vscode-test-'));
    const workspaceFilePath = path.join(tempDir, 'test.code-workspace');
    const workspaceConfig = {
      folders: [
        {
          path: path.resolve(__dirname, '../../../src/test/integration/mocked_data'),
        },
      ],
      settings: {
        'window.restoreWindows': 'none',
      },
    };
    fs.writeFileSync(workspaceFilePath, JSON.stringify(workspaceConfig, null, 2));
    console.log('Created temporary workspace file:', workspaceFilePath);

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
      workspaceFilePath,
    ];

    // Skip the prelaunch setup that compiles and prepares built-in extensions
    process.env.VSCODE_SKIP_PRELAUNCH = '1';

    // Download VS Code, unzip it and run the integration test
    await runTests({ extensionDevelopmentPath, extensionTestsPath, launchArgs });
  } catch (err) {
    console.error('Failed to run tests');
    process.exit(1);
  }
}

void main();
