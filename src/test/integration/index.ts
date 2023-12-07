import { glob } from 'glob';
import Mocha from 'mocha';
import path from 'path';

export async function run(): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
    timeout: process.env.SNYK_VSCE_DEVELOPMENT ? 60000 : undefined,
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
