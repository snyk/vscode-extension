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
import { ILog } from '../../../../snyk/common/logger/interfaces';

describe('per-folder org lost on upgrade (IDE-2259)', () => {
  let tmpDir: string;
  let workspace: Pick<IVSCodeWorkspace, 'getWorkspaceFolders' | 'getWorkspaceFile'>;
  // In-memory stand-in for Configuration's folderConfig store, matching the real
  // getFolderConfigs()/setFolderConfigs() contract that LanguageServerSettings relies on.
  let inMemoryFolderConfigs: FolderConfig[];
  let configuration: Pick<IConfiguration, 'getFolderConfigs' | 'setFolderConfigs'>;
  let context: { globalState: { get: sinon.SinonStub; update: sinon.SinonStub } };
  let logger: ILog;
  let loggerDebugStub: sinon.SinonStub;

  function writeLegacySettings(folderPath: string, settings: Record<string, unknown>) {
    fs.mkdirSync(path.join(folderPath, '.vscode'), { recursive: true });
    fs.writeFileSync(path.join(folderPath, '.vscode', 'settings.json'), JSON.stringify(settings));
  }

  function setWorkspaceFolders(...folderPaths: string[]) {
    (workspace.getWorkspaceFolders as sinon.SinonStub).returns(folderPaths.map(p => ({ uri: { fsPath: p } })));
  }

  function writeWorkspaceFile(workspaceFilePath: string, topLevelSettings: Record<string, unknown>) {
    fs.writeFileSync(workspaceFilePath, JSON.stringify({ folders: [], settings: topLevelSettings }));
    (workspace.getWorkspaceFile as sinon.SinonStub).returns({ scheme: 'file', fsPath: workspaceFilePath });
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snyk-folder-org-migration-'));
    workspace = { getWorkspaceFolders: sinon.stub().returns([]), getWorkspaceFile: sinon.stub().returns(undefined) };
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
    loggerDebugStub = sinon.stub();
    logger = {
      info: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub(),
      debug: loggerDebugStub,
      log: sinon.stub(),
      showOutput: sinon.stub(),
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
      logger,
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

  it('logs (but does not throw) when settings.json cannot be read for a reason other than ENOENT', async () => {
    const folderPath = path.join(tmpDir, 'folder1');
    // Making settings.json a directory forces a non-ENOENT (EISDIR) read failure.
    fs.mkdirSync(path.join(folderPath, '.vscode', 'settings.json'), { recursive: true });
    setWorkspaceFolders(folderPath);

    await migrate();

    assert.strictEqual(inMemoryFolderConfigs.length, 0);
    sinon.assert.calledOnce(loggerDebugStub);
  });

  it('FIX: malformed JSON in settings.json is NOT marked migrated, so it is retried next activation', async () => {
    const folderPath = path.join(tmpDir, 'folder1');
    fs.mkdirSync(path.join(folderPath, '.vscode'), { recursive: true });
    fs.writeFileSync(path.join(folderPath, '.vscode', 'settings.json'), '{ "snyk.advanced.organization": ');
    setWorkspaceFolders(folderPath);

    await migrate();

    assert.strictEqual(inMemoryFolderConfigs.length, 0, 'no org can be trusted from a malformed file');
    const [, updatedPaths] = context.globalState.update.getCall(0).args as [string, string[]];
    assert.ok(!updatedPaths.includes(folderPath), 'malformed folder must not be recorded as migrated');
    sinon.assert.calledOnce(loggerDebugStub);

    // Confirm it is actually retried: fixing the file on a second activation now recovers the org.
    fs.writeFileSync(
      path.join(folderPath, '.vscode', 'settings.json'),
      JSON.stringify({ 'snyk.advanced.organization': 'recovered-org' }),
    );
    context.globalState.get.returns(updatedPaths);
    await migrate();
    assert.strictEqual(inMemoryFolderConfigs[0]?.preferredOrg(), 'recovered-org');
  });

  it('FIX: a missing settings.json (ENOENT) is still marked migrated (unchanged behavior)', async () => {
    const folderPath = path.join(tmpDir, 'folder-with-no-vscode-dir');
    fs.mkdirSync(folderPath, { recursive: true });
    setWorkspaceFolders(folderPath);

    await migrate();

    assert.strictEqual(inMemoryFolderConfigs.length, 0);
    sinon.assert.calledWith(context.globalState.update, MEMENTO_FOLDER_ORG_MIGRATION_V1, [folderPath]);
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

  it('FIX: a folder with no per-folder org falls back to the .code-workspace top-level settings org', async () => {
    const folderPath = path.join(tmpDir, 'folder1');
    writeLegacySettings(folderPath, {}); // no per-folder org
    writeWorkspaceFile(path.join(tmpDir, 'project.code-workspace'), { 'snyk.advanced.organization': 'workspace-org' });
    setWorkspaceFolders(folderPath);

    await migrate();

    assert.strictEqual(inMemoryFolderConfigs[0]?.orgSetByUser(), true);
    assert.strictEqual(inMemoryFolderConfigs[0]?.preferredOrg(), 'workspace-org');
  });

  it("FIX: a folder's own per-folder org is kept, ignoring the .code-workspace top-level org", async () => {
    const folderPath = path.join(tmpDir, 'folder1');
    writeLegacySettings(folderPath, { 'snyk.advanced.organization': 'folder-org' });
    writeWorkspaceFile(path.join(tmpDir, 'project.code-workspace'), { 'snyk.advanced.organization': 'workspace-org' });
    setWorkspaceFolders(folderPath);

    await migrate();

    assert.strictEqual(inMemoryFolderConfigs[0]?.preferredOrg(), 'folder-org');
  });
});
