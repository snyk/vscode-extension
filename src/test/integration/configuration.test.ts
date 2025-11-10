import { deepStrictEqual, strictEqual } from 'assert';
import path from 'path';
import { sleep } from '@amplitude/experiment-node-server/dist/src/util/time';
import { FeaturesConfiguration, FolderConfig } from '../../snyk/common/configuration/configuration';
import { configuration } from '../../snyk/common/configuration/instance';
import vscode from 'vscode';
import {
  ADVANCED_CUSTOM_ENDPOINT,
  ADVANCED_ORGANIZATION,
  CONFIGURATION_IDENTIFIER,
} from '../../snyk/common/constants/settings';
import { assertEventually } from '../util/testUtils';

suite('Configuration', () => {
  test('settings change is reflected', async () => {
    await vscode.workspace.getConfiguration().update(ADVANCED_CUSTOM_ENDPOINT, '');
    strictEqual(configuration.snykCodeUrl, 'https://app.snyk.io/manage/snyk-code?from=vscode');
    strictEqual(configuration.authHost, 'https://app.snyk.io');

    await vscode.workspace.getConfiguration().update(ADVANCED_CUSTOM_ENDPOINT, 'https://api.snyk.io');
    strictEqual(configuration.snykCodeUrl, 'https://app.snyk.io/manage/snyk-code?from=vscode');
    strictEqual(configuration.authHost, 'https://app.snyk.io');

    await vscode.workspace.getConfiguration().update(ADVANCED_CUSTOM_ENDPOINT, 'https://api.dev.snyk.io');
    strictEqual(configuration.snykCodeUrl, 'https://app.dev.snyk.io/manage/snyk-code?from=vscode');
    strictEqual(configuration.authHost, 'https://app.dev.snyk.io');
  });

  test('configuration change is reflected', async () => {
    try {
      const featuresConfig = {
        ossEnabled: false,
        codeSecurityEnabled: false,
        iacEnabled: false,
      } as FeaturesConfiguration;

      await configuration.setFeaturesConfiguration(featuresConfig);

      deepStrictEqual(configuration.getFeaturesConfiguration(), featuresConfig);
    } finally {
      await configuration.setToken('');

      await configuration.setFeaturesConfiguration(undefined);
      const defaultConfig = configuration.getFeaturesConfiguration();
      deepStrictEqual(defaultConfig, {
        ossEnabled: true,
        codeSecurityEnabled: true,
        iacEnabled: true,
      });

      const enabledFeaturesConfig = {
        ossEnabled: true,
        codeSecurityEnabled: true,
        iacEnabled: true,
      } as FeaturesConfiguration;
      await configuration.setFeaturesConfiguration(enabledFeaturesConfig);
    }
  });

  suite('Folder Organization Configuration Sync', () => {
    let workspaceFolder: vscode.WorkspaceFolder | undefined;
    const secondFolderPath = path.resolve(__dirname, '../../../src/test/integration/test_data/minimal_project');

    const clearOrganizationAtAllLevels = async (): Promise<void> => {
      await vscode.workspace
        .getConfiguration(CONFIGURATION_IDENTIFIER)
        .update('advanced.organization', undefined, vscode.ConfigurationTarget.Global);
      await vscode.workspace
        .getConfiguration(CONFIGURATION_IDENTIFIER)
        .update('advanced.organization', undefined, vscode.ConfigurationTarget.Workspace);

      // Clear for all workspace folders
      const folders = vscode.workspace.workspaceFolders;
      if (folders) {
        await folders.reduce(
          (promise, folder) =>
            promise.then(() =>
              vscode.workspace
                .getConfiguration(CONFIGURATION_IDENTIFIER, folder)
                .update('advanced.organization', undefined, vscode.ConfigurationTarget.WorkspaceFolder),
            ),
          Promise.resolve(),
        );
      }
    };

    setup(async () => {
      const folders = vscode.workspace.workspaceFolders;
      if (!folders || folders.length === 0) {
        throw new Error('Incorrect number of workspace folders during setup');
      }
      workspaceFolder = folders[0];

      await clearOrganizationAtAllLevels();
      await configuration.setFolderConfigs([]);
    });

    teardown(async () => {
      await sleep(200); // Allow VS Code time to fully work out its workspace situation before cleanup

      await clearOrganizationAtAllLevels();
      await configuration.setFolderConfigs([]);

      // Remove second folder if it exists
      const folders = vscode.workspace.workspaceFolders;
      if (folders) {
        const secondFolderIndex = folders.findIndex(f => f.uri.fsPath === secondFolderPath);
        if (secondFolderIndex >= 0) {
          const removeSuccess = vscode.workspace.updateWorkspaceFolders(secondFolderIndex, 1);
          if (!removeSuccess) {
            throw new Error('Failed to remove second workspace folder during cleanup');
          }
          await sleep(200); // Allow VS Code to fully remove the workspace folder
        }
      }
    });

    test('should sync folder-level organization setting to folder config', async () => {
      if (!workspaceFolder) {
        throw new Error('Workspace folder not available');
      }

      // Set up initial folder config without a preferred org
      const initialFolderConfig = {
        folderPath: workspaceFolder.uri.fsPath,
        baseBranch: 'main',
        localBranches: undefined,
        referenceFolderPath: undefined,
        preferredOrg: '',
        orgSetByUser: false,
        autoDeterminedOrg: 'irrelevant-org',
        orgMigratedFromGlobalConfig: true,
      };
      await configuration.setFolderConfigs([initialFolderConfig]);

      // Simulate user changing organization setting at folder level
      await vscode.workspace
        .getConfiguration(CONFIGURATION_IDENTIFIER, workspaceFolder)
        .update('advanced.organization', 'test-org-123', vscode.ConfigurationTarget.WorkspaceFolder);

      // Wait for configuration change event to propagate and folder config to update
      await assertEventually(
        () => {
          const configs = configuration.getFolderConfigs();
          return configs.length === 1 && configs[0].preferredOrg === 'test-org-123';
        },
        2000,
        50,
        'Folder config organization should eventually be "test-org-123"',
      );
    });

    test('should clear folder config organization when setting is unset', async () => {
      if (!workspaceFolder) {
        throw new Error('Workspace folder not available');
      }

      // Set up folder config with an organization
      const initialFolderConfig = {
        folderPath: workspaceFolder.uri.fsPath,
        baseBranch: 'main',
        localBranches: undefined,
        referenceFolderPath: undefined,
        preferredOrg: 'existing-org',
        orgSetByUser: true,
        autoDeterminedOrg: 'irrelevant-org',
        orgMigratedFromGlobalConfig: true,
      };
      await configuration.setFolderConfigs([initialFolderConfig]);

      // Set organization at folder level
      await vscode.workspace
        .getConfiguration(CONFIGURATION_IDENTIFIER, workspaceFolder)
        .update('advanced.organization', 'temp-org', vscode.ConfigurationTarget.WorkspaceFolder);

      // Wait for sync
      await assertEventually(
        () => {
          const configs = configuration.getFolderConfigs();
          return configs.length > 0 && configs[0].preferredOrg === 'temp-org';
        },
        2000,
        50,
        'Folder config organization should eventually be "temp-org"',
      );

      // Now unset the organization
      await vscode.workspace
        .getConfiguration(CONFIGURATION_IDENTIFIER, workspaceFolder)
        .update('advanced.organization', undefined, vscode.ConfigurationTarget.WorkspaceFolder);

      // Wait for configuration change event to propagate
      await assertEventually(
        () => {
          const configs = configuration.getFolderConfigs();
          return configs.length === 1 && configs[0].preferredOrg === '';
        },
        2000,
        50,
        'Folder config organization should eventually be cleared (empty string)',
      );
    });

    test('should only update folder configs for affected workspace folders', async () => {
      if (!workspaceFolder) {
        throw new Error('Workspace folder not available');
      }

      // Set up multiple folder configs
      const folderConfig1 = {
        folderPath: workspaceFolder.uri.fsPath,
        baseBranch: 'main',
        localBranches: undefined,
        referenceFolderPath: undefined,
        preferredOrg: 'org-1',
        orgSetByUser: true,
        autoDeterminedOrg: 'irrelevant-org',
        orgMigratedFromGlobalConfig: true,
      };
      const folderConfig2 = {
        folderPath: '/path/to/different/folder',
        baseBranch: 'main',
        localBranches: undefined,
        referenceFolderPath: undefined,
        preferredOrg: 'org-2',
        orgSetByUser: true,
        autoDeterminedOrg: 'irrelevant-org',
        orgMigratedFromGlobalConfig: true,
      };
      await configuration.setFolderConfigs([folderConfig1, folderConfig2]);

      // Change organization only for the first workspace folder
      await vscode.workspace
        .getConfiguration(CONFIGURATION_IDENTIFIER, workspaceFolder)
        .update('advanced.organization', 'updated-org-1', vscode.ConfigurationTarget.WorkspaceFolder);

      // Wait for configuration change event to propagate and verify only matching folder updated
      await assertEventually(
        () => {
          const configs = configuration.getFolderConfigs();
          if (configs.length !== 2) return false;

          const config1 = configs.find(fc => fc.folderPath === workspaceFolder?.uri.fsPath);
          const config2 = configs.find(fc => fc.folderPath === '/path/to/different/folder');

          return config1?.preferredOrg === 'updated-org-1' && config2?.preferredOrg === 'org-2';
        },
        2000,
        50,
        'Only the affected workspace folder config should eventually be updated, other folder configs should remain unchanged',
      );
    });

    test('should update folder config to empty string when global org is set but no folder-level org exists', async () => {
      if (!workspaceFolder) {
        throw new Error('Workspace folder not available');
      }

      // Set up folder config with an organization
      const initialFolderConfig = {
        folderPath: workspaceFolder.uri.fsPath,
        baseBranch: 'main',
        localBranches: undefined,
        referenceFolderPath: undefined,
        preferredOrg: 'folder-org',
        orgSetByUser: true,
        autoDeterminedOrg: 'irrelevant-org',
        orgMigratedFromGlobalConfig: true,
      };
      await configuration.setFolderConfigs([initialFolderConfig]);

      // Set organization at global level (not folder level)
      // This should clear the folder config org since there's no folder-level override
      await vscode.workspace
        .getConfiguration(CONFIGURATION_IDENTIFIER)
        .update('advanced.organization', 'global-org', vscode.ConfigurationTarget.Global);

      // Wait for configuration change event to propagate and verify folder config cleared
      await assertEventually(
        () => {
          const configs = configuration.getFolderConfigs();
          return configs.length === 1 && configs[0].preferredOrg === '';
        },
        2000,
        50,
        'Folder config organization should eventually be cleared when no folder-level org setting exists',
      );
    });

    // Skipped: Relies on real LS, which we aren't doing in integration tests (at time of writing)
    test.skip('should handle config migration when LS sends orgMigratedFromGlobalConfig and orgSetByUser', async function () {
      this.timeout(15000);

      if (!workspaceFolder) {
        throw new Error('Workspace folder not available');
      }

      // Step 1: Set org in a single workspace's folder config
      // This will be sent to LS, which will automatically migrate it
      await vscode.workspace
        .getConfiguration(CONFIGURATION_IDENTIFIER, workspaceFolder)
        .update('advanced.organization', 'user-set-org', vscode.ConfigurationTarget.WorkspaceFolder);

      // Step 2: Wait for LS to migrate and send back the config with migration flags
      await assertEventually(
        () => {
          const configs = configuration.getFolderConfigs();
          return (
            configs.length === 1 &&
            configs[0].preferredOrg === 'user-set-org' &&
            configs[0].orgMigratedFromGlobalConfig === true &&
            configs[0].orgSetByUser === true
          );
        },
        5000,
        100,
        'Folder config should eventually be migrated by LS with orgMigratedFromGlobalConfig=true and orgSetByUser=true',
      );

      // Step 3: Forcibly reset folder config back to unmigrated state
      // This will cause LS to run the migration logic and send us back a migrated folder config, which we will then process.
      const unmigratedConfig: FolderConfig = {
        folderPath: workspaceFolder.uri.fsPath,
        baseBranch: 'main',
        localBranches: undefined,
        referenceFolderPath: undefined,
        preferredOrg: '',
        orgSetByUser: false,
        autoDeterminedOrg: '',
        orgMigratedFromGlobalConfig: false,
      };
      await configuration.setFolderConfigs([unmigratedConfig]);

      // Step 4: Wait for LS to detect the unmigrated config and re-migrate it
      // LS will automatically migrate any config it sees without migration flags
      await assertEventually(
        () => {
          const configs = configuration.getFolderConfigs();
          return (
            configs.length === 1 &&
            configs[0].preferredOrg === 'user-set-org' &&
            configs[0].orgMigratedFromGlobalConfig === true &&
            configs[0].orgSetByUser === true
          );
        },
        5000,
        100,
        'LS should automatically re-migrate the config with migration flags set',
      );

      // Step 5: Verify the org has been left alone in the VS Code settings at the workspace folder level
      const folderLevelOrg = vscode.workspace
        .getConfiguration(CONFIGURATION_IDENTIFIER, workspaceFolder)
        .get<string>(ADVANCED_ORGANIZATION);
      strictEqual(folderLevelOrg, 'user-set-org', 'Workspace folder level org setting should remain unchanged');
    });

    // Skipped: Relies on real LS, which we aren't doing in integration tests (at time of writing)
    test.skip('should handle config migration with multiple workspace folders', async function () {
      this.timeout(15000);

      // Verify we start with exactly one folder
      const initialFolders = vscode.workspace.workspaceFolders;
      if (!initialFolders || initialFolders.length !== 1) {
        throw new Error(`Expected exactly 1 workspace folder at start but got ${initialFolders?.length ?? 0}`);
      }

      // Add a second workspace folder for this test
      const addSuccess = vscode.workspace.updateWorkspaceFolders(
        1, // Start index (after first folder)
        0, // Delete count (don't delete any)
        { uri: vscode.Uri.file(secondFolderPath) },
      );

      if (!addSuccess) {
        throw new Error('Failed to add second workspace folder');
      }

      // Wait for workspace folders to update with assertEventually
      await assertEventually(
        () => {
          const folders = vscode.workspace.workspaceFolders;
          return folders !== undefined && folders.length === 2;
        },
        2000,
        100,
        'Expected 2 workspace folders after adding second folder',
      );

      await sleep(500); // Give VS Code extra time to fully initialize the workspace folder and its settings resources

      const folders = vscode.workspace.workspaceFolders;
      if (!folders || folders.length !== 2) {
        throw new Error(`Expected exactly 2 workspace folders but got ${folders?.length ?? 0}`);
      }

      const folder1 = folders[0];
      const folder2 = folders.find(f => f.uri.fsPath === secondFolderPath);

      if (!folder2) {
        throw new Error('Second workspace folder was not found after adding');
      }

      // Step 1: Set org only for folder2, leave folder1 without org setting
      // folder1 will have no org set (should get resolved by LS migration)
      // folder2 will have an explicit org set by user
      await vscode.workspace
        .getConfiguration(CONFIGURATION_IDENTIFIER, folder2)
        .update('advanced.organization', 'folder2-org', vscode.ConfigurationTarget.WorkspaceFolder);

      // Step 2: Wait for LS to migrate both configs
      await assertEventually(
        () => {
          const configs = configuration.getFolderConfigs();
          const config1 = configs.find(c => c.folderPath === folder1.uri.fsPath);
          const config2 = configs.find(c => c.folderPath === folder2.uri.fsPath);
          return (
            configs.length === 2 &&
            config1?.orgMigratedFromGlobalConfig === true &&
            config1?.orgSetByUser === false &&
            config2?.preferredOrg === 'folder2-org' &&
            config2?.orgMigratedFromGlobalConfig === true &&
            config2?.orgSetByUser === true
          );
        },
        5000,
        100,
        'Both folder configs should eventually be migrated by LS',
      );

      // Step 3: Force reset both folders to unmigrated state
      // folder1 has no org set in its workspace folder settings
      // folder2 has an org set in its workspace folder settings
      const unmigratedConfig1: FolderConfig = {
        folderPath: folder1.uri.fsPath,
        baseBranch: 'main',
        localBranches: undefined,
        referenceFolderPath: undefined,
        preferredOrg: '',
        orgSetByUser: false,
        autoDeterminedOrg: '',
        orgMigratedFromGlobalConfig: false,
      };

      const unmigratedConfig2: FolderConfig = {
        folderPath: folder2.uri.fsPath,
        baseBranch: 'main',
        localBranches: undefined,
        referenceFolderPath: undefined,
        preferredOrg: '',
        orgSetByUser: false,
        autoDeterminedOrg: '',
        orgMigratedFromGlobalConfig: false,
      };

      await configuration.setFolderConfigs([unmigratedConfig1, unmigratedConfig2]);

      // Step 4: Wait for LS to re-migrate both folders
      await assertEventually(
        () => {
          const configs = configuration.getFolderConfigs();
          const config1 = configs.find(c => c.folderPath === folder1.uri.fsPath);
          const config2 = configs.find(c => c.folderPath === folder2.uri.fsPath);
          return (
            config1?.orgMigratedFromGlobalConfig === true &&
            config1?.orgSetByUser === false &&
            config2?.preferredOrg === 'folder2-org' &&
            config2?.orgMigratedFromGlobalConfig === true &&
            config2?.orgSetByUser === true
          );
        },
        5000,
        100,
        'LS should eventually re-migrate both folder configs',
      );

      // Step 5: Verify both orgs in VS Code settings
      // folder1 will get an org populated by LS migration logic (resolved from LDX-Sync or default)
      // folder2 should still have the org set by user
      const folder1Org = vscode.workspace
        .getConfiguration(CONFIGURATION_IDENTIFIER, folder1)
        .get<string>(ADVANCED_ORGANIZATION);
      const folder2Org = vscode.workspace
        .getConfiguration(CONFIGURATION_IDENTIFIER, folder2)
        .get<string>(ADVANCED_ORGANIZATION);

      // folder1 gets resolved to some org by LS - we just verify it's been set to something
      strictEqual(typeof folder1Org, 'string', 'Folder1 org should be populated by LS migration logic');
      strictEqual(folder1Org!.length > 0, true, 'Folder1 org should not be empty');
      strictEqual(folder2Org, 'folder2-org', 'Folder2 org setting should remain unchanged');
    });
  });
});
