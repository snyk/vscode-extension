import { deepStrictEqual, ok, strictEqual } from 'assert';
import * as vscode from 'vscode';
import { configuration } from '../../snyk/common/configuration/instance';
import { getExtension } from '../../extension';

suite('Folder trust', () => {
  let folder: vscode.WorkspaceFolder;
  let folderPath: string;

  suiteSetup(() => {
    const folders = vscode.workspace.workspaceFolders;
    ok(folders && folders.length > 0, 'Need at least one workspace folder');
    folder = folders[0];
    folderPath = folder.uri.fsPath;
  });

  test('workspace folder is NOT trusted initially (it is a temp dir)', () => {
    const trusted = configuration.getTrustedFolders();
    const isTrusted = trusted.some(t => folderPath.startsWith(t) || t === folderPath);
    strictEqual(isTrusted, false, `Temp folder ${folderPath} should not be in trustedFolders: [${trusted.join(', ')}]`);
  });

  test('workspace trust cache agrees: no trusted workspace folders', () => {
    const ext = getExtension();
    ok(ext, 'Extension instance should exist');
    const workspacePaths = [folderPath];
    const trustedWorkspaceFolders = ext.workspaceTrust.getTrustedFolders(configuration, workspacePaths);
    strictEqual(trustedWorkspaceFolders.length, 0, 'No workspace folders should be trusted yet');
  });

  test('CORE: trusting the folder persists to snyk.trustedFolders', async function () {
    this.timeout(5000);

    await configuration.setTrustedFolders([folderPath]);

    const trusted = configuration.getTrustedFolders();
    ok(trusted.includes(folderPath), `trustedFolders should contain ${folderPath}`);
  });

  test('workspace trust cache reflects the newly trusted folder', () => {
    const ext = getExtension();
    ok(ext, 'Extension instance should exist');

    // Cache was invalidated by the config watcher when snyk.trustedFolders changed
    ext.workspaceTrust.resetTrustedFoldersCache();

    const workspacePaths = [folderPath];
    const trustedWorkspaceFolders = ext.workspaceTrust.getTrustedFolders(configuration, workspacePaths);
    deepStrictEqual([...trustedWorkspaceFolders], [folderPath], 'Workspace folder should now be trusted');
  });
});
