import assert from 'assert';
import sinon from 'sinon';
import type { FolderConfig, IConfiguration } from '../../../../snyk/common/configuration/configuration';
import { LanguageServerSettings } from '../../../../snyk/common/languageServer/settings';
import { synthesizeFolderConfigsFromWorkspace } from '../../../../snyk/common/languageServer/synthesizeFolderConfigsFromWorkspace';
import type { WorkspaceFolder } from '../../../../snyk/common/vscode/types';

function workspaceFolder(fsPath: string): WorkspaceFolder {
  return { uri: { fsPath } } as WorkspaceFolder;
}

suite('synthesizeFolderConfigsFromWorkspace', () => {
  test('manual org: preferredOrg from getOrganizationAtWorkspaceFolderLevel, orgSetByUser true', () => {
    const wf = workspaceFolder('/proj');
    const configuration = {
      isAutoSelectOrganizationEnabled: sinon.stub().withArgs(wf).returns(false),
      getOrganizationAtWorkspaceFolderLevel: sinon.stub().withArgs(wf).returns('devex_ide'),
      getOrganization: sinon.stub(),
    } as unknown as IConfiguration;

    const rows = synthesizeFolderConfigsFromWorkspace(configuration, [wf]);
    assert.strictEqual(rows.length, 1);
    const fc = rows[0];
    assert.strictEqual(fc.folderPath, '/proj');
    assert.strictEqual(fc.orgSetByUser, true);
    assert.strictEqual(fc.preferredOrg, 'devex_ide');
    assert.strictEqual(fc.autoDeterminedOrg, '');
    assert.strictEqual(fc.orgMigratedFromGlobalConfig, false);
  });

  test('auto org: autoDeterminedOrg from getOrganization, orgSetByUser false', () => {
    const wf = workspaceFolder('/app');
    const configuration = {
      isAutoSelectOrganizationEnabled: sinon.stub().withArgs(wf).returns(true),
      getOrganization: sinon.stub().withArgs(wf).returns('auto-org'),
      getOrganizationAtWorkspaceFolderLevel: sinon.stub(),
    } as unknown as IConfiguration;

    const rows = synthesizeFolderConfigsFromWorkspace(configuration, [wf]);
    const fc = rows[0];
    assert.strictEqual(fc.orgSetByUser, false);
    assert.strictEqual(fc.preferredOrg, '');
    assert.strictEqual(fc.autoDeterminedOrg, 'auto-org');
  });

  test('maps one row per workspace folder', () => {
    const a = workspaceFolder('/a');
    const b = workspaceFolder('/b');
    const configuration = {
      isAutoSelectOrganizationEnabled: sinon.stub().returns(true),
      getOrganization: sinon.stub().returns('x'),
      getOrganizationAtWorkspaceFolderLevel: sinon.stub(),
    } as unknown as IConfiguration;

    const rows = synthesizeFolderConfigsFromWorkspace(configuration, [a, b]);
    assert.strictEqual(rows.length, 2);
    assert.strictEqual(rows[0].folderPath, '/a');
    assert.strictEqual(rows[1].folderPath, '/b');
  });
});

suite('LanguageServerSettings.resolveFolderConfigsForServerSettings', () => {
  test('synthesizes when in-memory is empty and workspace has folders', () => {
    const wf = workspaceFolder('/ws');
    const configuration = {
      getFolderConfigs: () => [] as FolderConfig[],
      isAutoSelectOrganizationEnabled: sinon.stub().withArgs(wf).returns(false),
      getOrganizationAtWorkspaceFolderLevel: sinon.stub().withArgs(wf).returns('org1'),
      getOrganization: sinon.stub(),
    } as unknown as IConfiguration;

    const resolved = LanguageServerSettings.resolveFolderConfigsForServerSettings(configuration, true, {
      getWorkspaceFolders: () => [wf],
    });
    assert.strictEqual(resolved.length, 1);
    assert.strictEqual(resolved[0].preferredOrg, 'org1');
  });

  test('uses in-memory folder configs when non-empty', () => {
    const mem: FolderConfig[] = [
      {
        folderPath: '/p',
        baseBranch: '',
        localBranches: undefined,
        referenceFolderPath: undefined,
        orgSetByUser: true,
        preferredOrg: 'from-ls',
        autoDeterminedOrg: '',
        orgMigratedFromGlobalConfig: true,
      },
    ];
    const configuration = {
      getFolderConfigs: () => mem,
    } as unknown as IConfiguration;

    const resolved = LanguageServerSettings.resolveFolderConfigsForServerSettings(configuration, true, {
      getWorkspaceFolders: () => [workspaceFolder('/p')],
    });
    assert.strictEqual(resolved, mem);
  });
});
