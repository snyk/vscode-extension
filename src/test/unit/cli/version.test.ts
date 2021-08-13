import { doesNotThrow, strictEqual, throws } from 'assert';
import { CliVersion } from '../../../snyk/cli/version';

suite('CliVersion', () => {
  test('New version is the same as the current', () => {
    const currentVersion = new CliVersion('1.0.0');
    const otherVersion = new CliVersion('1.0.0');
    strictEqual(currentVersion.isLatest(otherVersion), true);
  });

  test('New version is older than the current', () => {
    const currentVersion = new CliVersion('1.0.1');
    const otherVersion = new CliVersion('1.0.0');
    strictEqual(currentVersion.isLatest(otherVersion), true);
  });

  test('New version has newer patch than the current', () => {
    const currentVersion = new CliVersion('1.0.0');
    const otherVersion = new CliVersion('1.0.1');
    strictEqual(currentVersion.isLatest(otherVersion), false);
  });

  test('New version has newer minor than the current', () => {
    const currentVersion = new CliVersion('1.0.0');
    const otherVersion = new CliVersion('1.1.0');
    strictEqual(currentVersion.isLatest(otherVersion), false);
  });

  test('New version has newer major than the current', () => {
    const currentVersion = new CliVersion('1.0.0');
    const otherVersion = new CliVersion('2.0.0');
    strictEqual(currentVersion.isLatest(otherVersion), false);
  });

  test('Non-dotted version cannot be constructed', () => {
    throws(() => new CliVersion('16830'));
  });

  test('Version prefix is accepted and compares correctly', () => {
    doesNotThrow(() => new CliVersion('v1.683.0'));

    const currentVersion = new CliVersion('v1.683.0');
    const otherVersion = new CliVersion('v1.683.1');
    strictEqual(currentVersion.isLatest(otherVersion), false);
  });
});
