import * as vscode from 'vscode';
import { glob } from 'glob';
import Mocha from 'mocha';
import path from 'path';
// @ts-expect-error - Internal Mocha module without TypeScript declarations
import { loadOptions } from 'mocha/lib/cli/cli';
import { getExtension } from '../../extension';
import { isStringArray } from '../../snyk/common/tsUtil';
import { ADVANCED_CUSTOM_ENDPOINT } from '../../snyk/common/constants/settings';
import { TestEnvVars } from '../testConstants';
import { Logger } from '../../snyk/common/logger/logger';

export async function run(): Promise<void> {
  // Our set Mocha options
  const baseOptions: Mocha.MochaOptions = {
    ui: 'tdd',
    color: true,
    slow: 150,
    timeout: process.env[TestEnvVars.DEVELOPMENT] ? 60000 : undefined,
    rootHooks: {
      async beforeAll() {
        // Clear any stale customEndpoint left in Global settings by previous test runs
        // (e.g. integration tests writing api.dev.snyk.io)
        await vscode.workspace
          .getConfiguration()
          .update(ADVANCED_CUSTOM_ENDPOINT, undefined, vscode.ConfigurationTarget.Global);
      },
      beforeEach() {
        Logger.info('vvv About to run next test vvv');
      },
      afterEach() {
        Logger.info('^^^ Test finished ^^^');
      },
      afterAll() {
        Logger.info('--- All tests finished ---');
        console.info('--- All tests finished ---');
        try {
          console.log(`Exthost directory: ${path.dirname(getExtension().context['acquireContext']().logUri.fsPath)}`);
        } catch {
          console.log(`Could not get exthost directory.`);
        }
      },
    },
  };

  // Parse additional Mocha options forwarded from runTest.ts via the environment variable.
  // E.g. if you ran: `npm run test:e2e -- --grep 'my test name'`,
  // then the environment variable would contain "--grep 'my test name'".
  const mochaCliArgsJSONStringified = process.env[TestEnvVars.MOCHA_CLI_ARGS];
  let additionalOptions: Mocha.MochaOptions = {};
  if (mochaCliArgsJSONStringified) {
    try {
      const mochaCliArgsArray = JSON.parse(mochaCliArgsJSONStringified) as unknown;
      if (!isStringArray(mochaCliArgsArray)) {
        throw new Error(`${TestEnvVars.MOCHA_CLI_ARGS} must be a valid JSON array of strings`);
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      additionalOptions = loadOptions(mochaCliArgsArray) as Mocha.MochaOptions;
    } catch (error) {
      console.error(`Failed to parse ${TestEnvVars.MOCHA_CLI_ARGS}:`, error);
      throw error;
    }
  }

  // If --grep was provided, wrap it so tests prefixed with "CORE: " always run.
  // These are setup tests (auth, trust) that later tests depend on.
  // Mocha matches grep against the full title (suite + test name), so "CORE: "
  // appears mid-string — no ^ anchor.
  if (additionalOptions.grep) {
    const userGrep =
      typeof additionalOptions.grep === 'string' ? additionalOptions.grep : additionalOptions.grep.source;
    additionalOptions.grep = new RegExp(`((CORE: )|(${userGrep}))`);
    console.log(`[e2e] Wrapped --grep to always include CORE tests: ${additionalOptions.grep}`);
  }

  const mocha = new Mocha({
    ...additionalOptions,
    ...baseOptions, // Base options take priority (loadOptions returns defaults too)
  });

  try {
    console.log(`Exthost directory: ${path.dirname(getExtension().context['acquireContext']().logUri.fsPath)}`);
  } catch {
    console.log(`Could not get exthost directory yet.`);
  }

  const testsRoot = path.resolve(__dirname, '.');

  try {
    const files = (await glob('./**/**.test.js', { cwd: testsRoot })).sort();

    files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

    return new Promise((resolve, reject) => {
      mocha.run(failures => {
        if (failures > 0) {
          reject(new Error(`${failures} E2E tests failed.`));
        } else {
          resolve();
        }
      });
    });
  } catch (err) {
    console.error(err);
    throw err;
  }
}
