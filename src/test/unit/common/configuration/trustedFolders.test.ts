import { deepStrictEqual } from 'assert';
import { IConfiguration } from '../../../../snyk/common/configuration/configuration';
import { IWorkspaceTrust, WorkspaceTrust } from '../../../../snyk/common/configuration/trustedFolders';

suite('Trusted Folders', () => {
  let workspaceTrust: IWorkspaceTrust;
  setup(() => {
    workspaceTrust = new WorkspaceTrust();
  });

  test('Single folder trusted', () => {
    const config = {
      getTrustedFolders: () => ['/test/workspace', '/test/workspace2'],
    } as IConfiguration;
    const workspaceFolders = ['/test/workspace'];

    const trustedFolders = workspaceTrust.getTrustedFolders(config, workspaceFolders);

    deepStrictEqual(trustedFolders, ['/test/workspace']);
  });

  test('Multiple folders trusted', () => {
    const config = {
      getTrustedFolders: () => ['/test/workspace', '/test/workspace2'],
    } as IConfiguration;
    const workspaceFolders = ['/test/workspace', '/test/workspace2'];

    const trustedFolders = workspaceTrust.getTrustedFolders(config, workspaceFolders);

    deepStrictEqual(trustedFolders, ['/test/workspace', '/test/workspace2']);
  });

  test('No folders trusted', () => {
    const config = {
      getTrustedFolders: (): string[] => [],
    } as IConfiguration;
    const workspaceFolders = ['/test/workspace', '/test/workspace2'];

    const trustedFolders = workspaceTrust.getTrustedFolders(config, workspaceFolders);

    deepStrictEqual(trustedFolders, []);
  });

  test('Parent folder trusted', () => {
    const config = {
      getTrustedFolders: () => ['/test'],
    } as IConfiguration;
    const workspaceFolders = ['/test/workspace', '/test/workspace2'];

    const trustedFolders = workspaceTrust.getTrustedFolders(config, workspaceFolders);

    deepStrictEqual(trustedFolders, ['/test/workspace', '/test/workspace2']);
  });

  test('Parent folder trusted (trailing slash)', () => {
    const config = {
      getTrustedFolders: () => ['/test/'],
    } as IConfiguration;
    const workspaceFolders = ['/test/workspace', '/test/workspace2'];

    const trustedFolders = workspaceTrust.getTrustedFolders(config, workspaceFolders);

    deepStrictEqual(trustedFolders, ['/test/workspace', '/test/workspace2']);
  });
});
