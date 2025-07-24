import { glob } from 'glob';
import Mocha from 'mocha';
import path from 'path';
import { isStringArray } from '../../snyk/common/tsUtil';
// @ts-expect-error - Internal Mocha module without TypeScript declarations
import { loadOptions } from 'mocha/lib/cli/cli';

export async function run(): Promise<void> {
  // Our set Mocha options
  const baseOptions: Mocha.MochaOptions = {
    ui: 'tdd',
    color: true,
    slow: 150, // double the default, as integration tests are slow
    timeout: process.env.SNYK_VSCE_DEVELOPMENT ? 60000 : undefined,
  };

  // Parse additional options from environment variable
  const mochaCliArgsJSONStringified = process.env.TEST_MOCHA_CLI_ARGS;
  let additionalOptions: Mocha.MochaOptions = {};
  if (mochaCliArgsJSONStringified) {
    try {
      const mochaCliArgsArray = JSON.parse(mochaCliArgsJSONStringified) as unknown;
      if (!isStringArray(mochaCliArgsArray)) {
        throw new Error('TEST_MOCHA_CLI_ARGS must be a valid JSON array of strings');
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      additionalOptions = loadOptions(mochaCliArgsArray) as Mocha.MochaOptions;
    } catch (error) {
      console.error('Failed to parse TEST_MOCHA_CLI_ARGS:', error);
      throw error;
    }
  }

  const mocha = new Mocha({
    ...additionalOptions,
    ...baseOptions, // The base options must take priority, as `loadOptions` returns the defaults as well.
  });

  const testsRoot = path.resolve(__dirname, '.');

  try {
    const files = await glob('./**/**.test.js', { cwd: testsRoot });

    files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

    return new Promise((resolve, reject) => {
      mocha.run(failures => {
        if (failures > 0) {
          reject(new Error(`${failures} tests failed.`));
        } else {
          resolve();
        }
      });
    });
  } catch (err) {
    console.error(err);
    throw err; // Rethrow the error for the caller to handle
  }
}
