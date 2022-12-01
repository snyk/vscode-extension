import { deepStrictEqual } from 'assert';
import { IConfiguration } from '../../../../snyk/common/configuration/configuration';
import { getTrustedFolders } from '../../../../snyk/common/configuration/trustedFolders';

suite('Trusted Folders', () => {
  test('Single folder trusted', () => {
    const config = {
      getTrustedFolders: () => ['/test/workspace', '/test/workspace2'],
    } as IConfiguration;
    const workspaceFolders = ['/test/workspace'];

    const trustedFolders = getTrustedFolders(config, workspaceFolders);

    deepStrictEqual(trustedFolders, ['/test/workspace']);
  });

  test('Multiple folders trusted', () => {
    const config = {
      getTrustedFolders: () => ['/test/workspace', '/test/workspace2'],
    } as IConfiguration;
    const workspaceFolders = ['/test/workspace', '/test/workspace2'];

    const trustedFolders = getTrustedFolders(config, workspaceFolders);

    deepStrictEqual(trustedFolders, ['/test/workspace', '/test/workspace2']);
  });

  test('No folders trusted', () => {
    const config = {
      getTrustedFolders: (): string[] => [],
    } as IConfiguration;
    const workspaceFolders = ['/test/workspace', '/test/workspace2'];

    const trustedFolders = getTrustedFolders(config, workspaceFolders);

    deepStrictEqual(trustedFolders, []);
  });
});
