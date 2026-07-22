import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as sinon from 'sinon';
import { describe, it, beforeEach, afterEach } from 'mocha';
import * as assert from 'assert';
import { migrateFolderOrgSettingsIfNeeded } from '../../../../snyk/common/configuration/folderOrgMigration';
import { FolderConfig, IConfiguration } from '../../../../snyk/common/configuration/configuration';
import { LanguageServerSettings } from '../../../../snyk/common/languageServer/settings';
import { LS_KEY } from '../../../../snyk/common/languageServer/serverSettingsToLspConfigurationParam';
import { MEMENTO_FOLDER_ORG_MIGRATION_V1 } from '../../../../snyk/common/constants/globalState';
import { IVSCodeWorkspace } from '../../../../snyk/common/vscode/workspace';

describe('per-folder org lost on upgrade (IDE-2259)', () => {
  let tmpDir: string;
  let workspace: Pick<IVSCodeWorkspace, 'getWorkspaceFolders'>;
  // In-memory stand-in for Configuration's folderConfig store, matching the real
  // getFolderConfigs()/setFolderConfigs() contract that LanguageServerSettings relies on.
  let inMemoryFolderConfigs: FolderConfig[];
  let configuration: Pick<IConfiguration, 'getFolderConfigs' | 'setFolderConfigs'>;
  let context: { globalState: { get: sinon.SinonStub; update: sinon.SinonStub } };

  function writeLegacySettings(folderPath: string, settings: Record<string, unknown>) {
    fs.mkdirSync(path.join(folderPath, '.vscode'), { recursive: true });
    fs.writeFileSync(path.join(folderPath, '.vscode', 'settings.json'), JSON.stringify(settings));
  }

  function setWorkspaceFolders(...folderPaths: string[]) {
    (workspace.getWorkspaceFolders as sinon.SinonStub).returns(folderPaths.map(p => ({ uri: { fsPath: p } })));
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snyk-folder-org-migration-'));
    workspace = { getWorkspaceFolders: sinon.stub().returns([]) };
    inMemoryFolderConfigs = [];
    configuration = {
      getFolderConfigs: () => inMemoryFolderConfigs,
      setFolderConfigs: (configs: FolderConfig[]) => {
        inMemoryFolderConfigs = configs;
        return Promise.resolve();
      },
    };
    context = {
      globalState: {
        get: sinon.stub().returns(undefined),
        update: sinon.stub().resolves(),
      },
    };
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  async function migrate() {
    await migrateFolderOrgSettingsIfNeeded(
      workspace as IVSCodeWorkspace,
      configuration as IConfiguration,
      context as unknown as import('vscode').ExtensionContext,
    );
  }

  it('BUG (pre-fix regression guard): without migration, resolveFolderConfigs ignores the legacy per-folder org entirely', () => {
    // This is the exact real code path LanguageServer.getInitializationOptions() uses to
    // build the folderConfigs sent to snyk-ls on startup. On a fresh v2.31.0->main upgrade,
    // in-memory folder configs are empty, so it falls back to a bare `new FolderConfig(path)`
    // per workspace folder — regardless of what's in that folder's .vscode/settings.json.
    const juiceShop = path.join(tmpDir, 'juice-shop');
    writeLegacySettings(juiceShop, {
      'snyk.advanced.organization': 'devex_ide',
      'snyk.advanced.autoSelectOrganization': false,
    });
    setWorkspaceFolders(juiceShop);

    const resolved = LanguageServerSettings.resolveFolderConfigs(
      configuration as IConfiguration,
      workspace as IVSCodeWorkspace,
    );
    const juiceShopConfig = resolved.find(c => c.folderPath === juiceShop);
    assert.ok(juiceShopConfig);
    assert.strictEqual(juiceShopConfig.orgSetByUser(), false, 'org is lost without the migration step');
    assert.strictEqual(juiceShopConfig.preferredOrg(), '');
  });

  it('FIX: migration promotes each folder explicit org before LS init, so resolveFolderConfigs preserves it', async () => {
    const juiceShop = path.join(tmpDir, 'juice-shop');
    const snykGoof = path.join(tmpDir, 'snyk-goof');
    writeLegacySettings(juiceShop, {
      'snyk.advanced.organization': 'devex_ide',
      'snyk.advanced.autoSelectOrganization': false,
    });
    writeLegacySettings(snykGoof, {
      'snyk.advanced.organization': 'code-consistent-ignores-early-access-verification',
      'snyk.advanced.autoSelectOrganization': false,
    });
    setWorkspaceFolders(juiceShop, snykGoof);

    await migrate();
    const resolved = LanguageServerSettings.resolveFolderConfigs(
      configuration as IConfiguration,
      workspace as IVSCodeWorkspace,
    );

    const juiceShopConfig = resolved.find(c => c.folderPath === juiceShop);
    const snykGoofConfig = resolved.find(c => c.folderPath === snykGoof);
    assert.ok(juiceShopConfig);
    assert.ok(snykGoofConfig);
    assert.strictEqual(juiceShopConfig.orgSetByUser(), true);
    assert.strictEqual(juiceShopConfig.preferredOrg(), 'devex_ide');
    assert.strictEqual(snykGoofConfig.orgSetByUser(), true);
    assert.strictEqual(snykGoofConfig.preferredOrg(), 'code-consistent-ignores-early-access-verification');
  });

  it('does not send a config-change notification (LanguageClient does not exist yet at this point in activation)', async () => {
    const folderPath = path.join(tmpDir, 'folder1');
    writeLegacySettings(folderPath, { 'snyk.advanced.organization': 'my-org' });
    setWorkspaceFolders(folderPath);
    const setFolderConfigsSpy = sinon.spy(configuration, 'setFolderConfigs');

    await migrate();

    sinon.assert.calledOnce(setFolderConfigsSpy);
    assert.strictEqual(setFolderConfigsSpy.getCall(0).args[1], false);
  });

  it('treats autoSelectOrganization=true as an explicit opt-out, even if an org string is present', async () => {
    const folderPath = path.join(tmpDir, 'folder1');
    writeLegacySettings(folderPath, {
      'snyk.advanced.organization': 'org-b',
      'snyk.advanced.autoSelectOrganization': true,
    });
    setWorkspaceFolders(folderPath);

    await migrate();

    assert.strictEqual(inMemoryFolderConfigs.length, 0);
  });

  it('does nothing when a folder has no legacy org settings', async () => {
    const folderPath = path.join(tmpDir, 'folder1');
    writeLegacySettings(folderPath, {});
    setWorkspaceFolders(folderPath);

    await migrate();

    assert.strictEqual(inMemoryFolderConfigs.length, 0);
    sinon.assert.calledWith(context.globalState.update, MEMENTO_FOLDER_ORG_MIGRATION_V1, [folderPath]);
  });

  it('preserves other pre-existing folder settings when merging in the migrated org keys', async () => {
    const folderPath = path.join(tmpDir, 'folder1');
    writeLegacySettings(folderPath, { 'snyk.advanced.organization': 'my-org' });
    const existingConfig = new FolderConfig(folderPath);
    existingConfig.setSetting(LS_KEY.baseBranch, 'develop');
    inMemoryFolderConfigs = [existingConfig];
    setWorkspaceFolders(folderPath);

    await migrate();

    assert.strictEqual(inMemoryFolderConfigs[0].baseBranch(), 'develop');
    assert.strictEqual(inMemoryFolderConfigs[0].preferredOrg(), 'my-org');
  });

  it('FIX: tolerates JSONC comments in settings.json (VS Code settings files allow them)', async () => {
    const folderPath = path.join(tmpDir, 'folder1');
    fs.mkdirSync(path.join(folderPath, '.vscode'), { recursive: true });
    fs.writeFileSync(
      path.join(folderPath, '.vscode', 'settings.json'),
      `{
        // per-folder org override
        "snyk.advanced.organization": "my-org",
      }`,
    );
    setWorkspaceFolders(folderPath);

    await migrate();

    assert.strictEqual(inMemoryFolderConfigs[0].preferredOrg(), 'my-org');
  });

  it('does not re-check a folder whose path is already recorded as migrated', async () => {
    const folderPath = path.join(tmpDir, 'folder1');
    context.globalState.get.returns([folderPath]);
    writeLegacySettings(folderPath, { 'snyk.advanced.organization': 'my-org' });
    setWorkspaceFolders(folderPath);
    const setFolderConfigsSpy = sinon.spy(configuration, 'setFolderConfigs');

    await migrate();

    sinon.assert.notCalled(setFolderConfigsSpy);
    sinon.assert.notCalled(context.globalState.update);
  });

  it('still migrates a distinct, never-before-seen folder even though a different folder is already recorded as migrated', async () => {
    const migratedFolder = path.join(tmpDir, 'already-migrated-folder');
    const newFolder = path.join(tmpDir, 'new-folder');
    context.globalState.get.returns([migratedFolder]);
    writeLegacySettings(newFolder, { 'snyk.advanced.organization': 'my-org' });
    setWorkspaceFolders(migratedFolder, newFolder);

    await migrate();

    assert.strictEqual(inMemoryFolderConfigs.find(c => c.folderPath === newFolder)?.preferredOrg(), 'my-org');
    const [, updatedPaths] = context.globalState.update.getCall(0).args as [string, string[]];
    assert.deepStrictEqual(new Set(updatedPaths), new Set([migratedFolder, newFolder]));
  });
});
