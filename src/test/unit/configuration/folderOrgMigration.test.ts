import * as fs from 'fs';
import * as path from 'path';
import * as sinon from 'sinon';
import { describe, it, beforeEach, afterEach } from 'mocha';
import * as assert from 'assert';
import { ExtensionContext } from 'vscode';
import { migrateFolderOrgSettingsIfNeeded } from '../../../snyk/common/configuration/folderOrgMigration';
import { FolderConfig } from '../../../snyk/common/configuration/configuration';
import { LS_KEY } from '../../../snyk/common/languageServer/serverSettingsToLspConfigurationParam';
import { MEMENTO_FOLDER_ORG_MIGRATION_V1 } from '../../../snyk/common/constants/globalState';

describe('folderOrgMigration', () => {
  let sandbox: sinon.SinonSandbox;
  let mockWorkspace: any;
  let mockConfiguration: any;
  let mockContext: any;
  let tmpDir: string;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    tmpDir = path.join(__dirname, 'test-workspace-' + Date.now());

    mockWorkspace = {
      getWorkspaceFolders: () => [],
    };

    mockConfiguration = {
      getFolderConfigs: () => [],
      setFolderConfigs: async () => {},
    };

    mockContext = {
      globalState: {
        get: () => undefined,
        update: async () => {},
      },
    };
  });

  afterEach(() => {
    sandbox.restore();
    // Clean up temp files
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  describe('migration skipping', () => {
    it('should skip migration if memento indicates already migrated', async () => {
      mockContext.globalState.get = () => true;
      const setFolderConfigsSpy = sandbox.spy(mockConfiguration, 'setFolderConfigs');

      await migrateFolderOrgSettingsIfNeeded(mockWorkspace, mockConfiguration, mockContext);

      assert.strictEqual(setFolderConfigsSpy.callCount, 0);
    });

    it('should mark migration done even if no folders', async () => {
      mockWorkspace.getWorkspaceFolders = () => [];
      const updateSpy = sandbox.spy(mockContext.globalState, 'update');

      await migrateFolderOrgSettingsIfNeeded(mockWorkspace, mockConfiguration, mockContext);

      assert.strictEqual(updateSpy.callCount, 1);
      const args = updateSpy.getCall(0).args;
      assert.strictEqual(args[0], MEMENTO_FOLDER_ORG_MIGRATION_V1);
      assert.strictEqual(args[1], true);
    });
  });

  describe('legacy org settings detection', () => {
    it('should detect explicit org without autoSelect', async () => {
      const folderPath = path.join(tmpDir, 'folder1');
      fs.mkdirSync(path.join(folderPath, '.vscode'), { recursive: true });
      fs.writeFileSync(
        path.join(folderPath, '.vscode', 'settings.json'),
        JSON.stringify({
          'snyk.advanced.organization': 'my-org-id',
        }),
      );

      mockWorkspace.getWorkspaceFolders = () => [{ uri: { fsPath: folderPath } }];
      const setFolderConfigsSpy = sandbox.spy(mockConfiguration, 'setFolderConfigs');

      await migrateFolderOrgSettingsIfNeeded(mockWorkspace, mockConfiguration, mockContext);

      assert.strictEqual(setFolderConfigsSpy.callCount, 1);
      const configs = setFolderConfigsSpy.getCall(0).args[0] as FolderConfig[];
      assert.strictEqual(configs.length, 1);
      assert.strictEqual(configs[0].preferredOrg(), 'my-org-id');
      assert.strictEqual(configs[0].orgSetByUser(), true);
    });

    it('should migrate explicit org with autoSelectOrganization=false', async () => {
      const folderPath = path.join(tmpDir, 'folder1');
      fs.mkdirSync(path.join(folderPath, '.vscode'), { recursive: true });
      fs.writeFileSync(
        path.join(folderPath, '.vscode', 'settings.json'),
        JSON.stringify({
          'snyk.advanced.organization': 'org-a',
          'snyk.advanced.autoSelectOrganization': false,
        }),
      );

      mockWorkspace.getWorkspaceFolders = () => [{ uri: { fsPath: folderPath } }];
      const setFolderConfigsSpy = sandbox.spy(mockConfiguration, 'setFolderConfigs');

      await migrateFolderOrgSettingsIfNeeded(mockWorkspace, mockConfiguration, mockContext);

      const configs = setFolderConfigsSpy.getCall(0).args[0] as FolderConfig[];
      assert.strictEqual(configs[0].preferredOrg(), 'org-a');
      assert.strictEqual(configs[0].orgSetByUser(), true);
    });

    it('should set orgSetByUser=false when autoSelectOrganization=true even if org is set', async () => {
      const folderPath = path.join(tmpDir, 'folder1');
      fs.mkdirSync(path.join(folderPath, '.vscode'), { recursive: true });
      fs.writeFileSync(
        path.join(folderPath, '.vscode', 'settings.json'),
        JSON.stringify({
          'snyk.advanced.organization': 'org-b',
          'snyk.advanced.autoSelectOrganization': true,
        }),
      );

      mockWorkspace.getWorkspaceFolders = () => [{ uri: { fsPath: folderPath } }];
      const setFolderConfigsSpy = sandbox.spy(mockConfiguration, 'setFolderConfigs');

      await migrateFolderOrgSettingsIfNeeded(mockWorkspace, mockConfiguration, mockContext);

      const configs = setFolderConfigsSpy.getCall(0).args[0] as FolderConfig[];
      assert.strictEqual(configs[0].orgSetByUser(), false);
    });

    it('should set orgSetByUser=false when no org is set', async () => {
      const folderPath = path.join(tmpDir, 'folder1');
      fs.mkdirSync(path.join(folderPath, '.vscode'), { recursive: true });
      fs.writeFileSync(path.join(folderPath, '.vscode', 'settings.json'), JSON.stringify({}));

      mockWorkspace.getWorkspaceFolders = () => [{ uri: { fsPath: folderPath } }];
      const setFolderConfigsSpy = sandbox.spy(mockConfiguration, 'setFolderConfigs');

      await migrateFolderOrgSettingsIfNeeded(mockWorkspace, mockConfiguration, mockContext);

      // No migration needed, so setFolderConfigs should not be called
      assert.strictEqual(setFolderConfigsSpy.callCount, 0);
    });

    it('should skip folder if settings.json does not exist', async () => {
      const folderPath = path.join(tmpDir, 'folder1');
      fs.mkdirSync(folderPath, { recursive: true });

      mockWorkspace.getWorkspaceFolders = () => [{ uri: { fsPath: folderPath } }];
      const setFolderConfigsSpy = sandbox.spy(mockConfiguration, 'setFolderConfigs');

      await migrateFolderOrgSettingsIfNeeded(mockWorkspace, mockConfiguration, mockContext);

      // No legacy settings, so no migration
      assert.strictEqual(setFolderConfigsSpy.callCount, 0);
    });

    it('should continue with other folders if one has invalid JSON', async () => {
      const folder1 = path.join(tmpDir, 'folder1');
      const folder2 = path.join(tmpDir, 'folder2');
      fs.mkdirSync(path.join(folder1, '.vscode'), { recursive: true });
      fs.mkdirSync(path.join(folder2, '.vscode'), { recursive: true });

      // Invalid JSON
      fs.writeFileSync(path.join(folder1, '.vscode', 'settings.json'), '{invalid json}');

      // Valid JSON with org
      fs.writeFileSync(
        path.join(folder2, '.vscode', 'settings.json'),
        JSON.stringify({
          'snyk.advanced.organization': 'org-x',
        }),
      );

      mockWorkspace.getWorkspaceFolders = () => [{ uri: { fsPath: folder1 } }, { uri: { fsPath: folder2 } }];
      const setFolderConfigsSpy = sandbox.spy(mockConfiguration, 'setFolderConfigs');

      await migrateFolderOrgSettingsIfNeeded(mockWorkspace, mockConfiguration, mockContext);

      // Migration should still apply to folder2
      assert.strictEqual(setFolderConfigsSpy.callCount, 1);
      const configs = setFolderConfigsSpy.getCall(0).args[0] as FolderConfig[];
      const folder2Config = configs.find(c => c.folderPath === folder2);
      assert.ok(folder2Config);
      assert.strictEqual(folder2Config.preferredOrg(), 'org-x');
    });
  });

  describe('multi-folder scenarios', () => {
    it('should migrate multiple folders with different orgs', async () => {
      const folder1 = path.join(tmpDir, 'juice-shop');
      const folder2 = path.join(tmpDir, 'snyk-goof');

      fs.mkdirSync(path.join(folder1, '.vscode'), { recursive: true });
      fs.mkdirSync(path.join(folder2, '.vscode'), { recursive: true });

      fs.writeFileSync(
        path.join(folder1, '.vscode', 'settings.json'),
        JSON.stringify({
          'snyk.advanced.organization': 'devex_ide',
          'snyk.advanced.autoSelectOrganization': false,
        }),
      );

      fs.writeFileSync(
        path.join(folder2, '.vscode', 'settings.json'),
        JSON.stringify({
          'snyk.advanced.organization': 'code-consistent-ignores',
          'snyk.advanced.autoSelectOrganization': false,
        }),
      );

      mockWorkspace.getWorkspaceFolders = () => [{ uri: { fsPath: folder1 } }, { uri: { fsPath: folder2 } }];
      const setFolderConfigsSpy = sandbox.spy(mockConfiguration, 'setFolderConfigs');

      await migrateFolderOrgSettingsIfNeeded(mockWorkspace, mockConfiguration, mockContext);

      const configs = setFolderConfigsSpy.getCall(0).args[0] as FolderConfig[];
      assert.strictEqual(configs.length, 2);

      const folder1Config = configs.find(c => c.folderPath === folder1);
      assert.ok(folder1Config);
      assert.strictEqual(folder1Config.preferredOrg(), 'devex_ide');
      assert.strictEqual(folder1Config.orgSetByUser(), true);

      const folder2Config = configs.find(c => c.folderPath === folder2);
      assert.ok(folder2Config);
      assert.strictEqual(folder2Config.preferredOrg(), 'code-consistent-ignores');
      assert.strictEqual(folder2Config.orgSetByUser(), true);
    });

    it('should preserve existing non-org settings when merging', async () => {
      const folderPath = path.join(tmpDir, 'folder1');
      fs.mkdirSync(path.join(folderPath, '.vscode'), { recursive: true });
      fs.writeFileSync(
        path.join(folderPath, '.vscode', 'settings.json'),
        JSON.stringify({
          'snyk.advanced.organization': 'my-org',
        }),
      );

      // Pre-existing folder config with other settings
      const existingConfig = new FolderConfig(folderPath);
      existingConfig.setSetting('base_branch', 'develop');
      mockConfiguration.getFolderConfigs = () => [existingConfig];

      mockWorkspace.getWorkspaceFolders = () => [{ uri: { fsPath: folderPath } }];
      const setFolderConfigsSpy = sandbox.spy(mockConfiguration, 'setFolderConfigs');

      await migrateFolderOrgSettingsIfNeeded(mockWorkspace, mockConfiguration, mockContext);

      const configs = setFolderConfigsSpy.getCall(0).args[0] as FolderConfig[];
      assert.strictEqual(configs.length, 1);
      assert.strictEqual(configs[0].preferredOrg(), 'my-org');
      assert.strictEqual(configs[0].baseBranch(), 'develop');
    });
  });

  describe('changed flag', () => {
    it('should mark migrated org keys with changed=true', async () => {
      const folderPath = path.join(tmpDir, 'folder1');
      fs.mkdirSync(path.join(folderPath, '.vscode'), { recursive: true });
      fs.writeFileSync(
        path.join(folderPath, '.vscode', 'settings.json'),
        JSON.stringify({
          'snyk.advanced.organization': 'my-org',
          'snyk.advanced.autoSelectOrganization': false,
        }),
      );

      mockWorkspace.getWorkspaceFolders = () => [{ uri: { fsPath: folderPath } }];
      const setFolderConfigsSpy = sandbox.spy(mockConfiguration, 'setFolderConfigs');

      await migrateFolderOrgSettingsIfNeeded(mockWorkspace, mockConfiguration, mockContext);

      const configs = setFolderConfigsSpy.getCall(0).args[0] as FolderConfig[];
      const config = configs[0];

      assert.strictEqual(config.settings[LS_KEY.orgSetByUser]?.changed, true);
      assert.strictEqual(config.settings[LS_KEY.preferredOrg]?.changed, true);
    });
  });

  describe('notification flag', () => {
    it('should pass triggerConfigChangeEvent=true to setFolderConfigs', async () => {
      const folderPath = path.join(tmpDir, 'folder1');
      fs.mkdirSync(path.join(folderPath, '.vscode'), { recursive: true });
      fs.writeFileSync(
        path.join(folderPath, '.vscode', 'settings.json'),
        JSON.stringify({
          'snyk.advanced.organization': 'my-org',
        }),
      );

      mockWorkspace.getWorkspaceFolders = () => [{ uri: { fsPath: folderPath } }];
      const setFolderConfigsSpy = sandbox.spy(mockConfiguration, 'setFolderConfigs');

      await migrateFolderOrgSettingsIfNeeded(mockWorkspace, mockConfiguration, mockContext);

      const args = setFolderConfigsSpy.getCall(0).args;
      assert.strictEqual(args[1], true); // triggerConfigChangeEvent
    });
  });

  describe('error handling', () => {
    it('should still mark migration done if an error occurs', async () => {
      mockWorkspace.getWorkspaceFolders = () => {
        throw new Error('Test error');
      };
      const updateSpy = sandbox.spy(mockContext.globalState, 'update');

      try {
        await migrateFolderOrgSettingsIfNeeded(mockWorkspace, mockConfiguration, mockContext);
      } catch {
        // Expected
      }

      assert.strictEqual(updateSpy.callCount, 1);
      const args = updateSpy.getCall(0).args;
      assert.strictEqual(args[0], MEMENTO_FOLDER_ORG_MIGRATION_V1);
      assert.strictEqual(args[1], true);
    });

    it('should rethrow error after marking migration done', async () => {
      const testError = new Error('Test error');
      mockWorkspace.getWorkspaceFolders = () => {
        throw testError;
      };

      let caught: Error | undefined;
      try {
        await migrateFolderOrgSettingsIfNeeded(mockWorkspace, mockConfiguration, mockContext);
      } catch (e) {
        caught = e as Error;
      }

      assert.ok(caught);
      assert.strictEqual(caught.message, 'Test error');
    });
  });
});
