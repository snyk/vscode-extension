import * as fs from 'fs';
import * as path from 'path';
import { ExtensionContext } from 'vscode';
import { MEMENTO_FOLDER_ORG_MIGRATION_V1 } from '../constants/globalState';
import { ADVANCED_ORGANIZATION, ADVANCED_AUTO_SELECT_ORGANIZATION } from '../constants/settings';
import { LS_KEY } from '../languageServer/serverSettingsToLspConfigurationParam';
import { IVSCodeWorkspace } from '../vscode/workspace';
import { IConfiguration, FolderConfig } from './configuration';

/**
 * Migrates per-folder organization settings from v2.31.0 to the new LS-based model.
 *
 * In v2.31.0, `snyk.advanced.organization` and `snyk.advanced.autoSelectOrganization`
 * were `resource`-scoped, allowing per-folder customization in `.vscode/settings.json`.
 * On upgrade to main, the scope changed to `window` and `autoSelectOrganization` was removed.
 * Window-scoped keys in folder-level `.vscode/settings.json` are ignored by VS Code,
 * so legacy per-folder orgs become invisible and folders revert to auto-determined org.
 *
 * This migration runs at extension startup and:
 * 1. Reads legacy per-folder org settings from each folder's `.vscode/settings.json`
 * 2. Maps them to the new LS-based FolderConfig model
 * 3. Updates in-memory folder configs with migrated org keys marked as changed
 * 4. Tracks completion via globalState memento to prevent re-running
 *
 * The migration must complete before LS initialization so folderConfigs with migrated
 * org values are included in initializationOptions and LS respects the user-set org
 * rather than overwriting with auto-determined values.
 */

interface LegacyOrgSettings {
  organization?: string;
  autoSelectOrganization?: boolean;
}

/**
 * Reads legacy org settings from a folder's .vscode/settings.json file.
 */
function readLegacyOrgSettingsFromFile(folderPath: string): LegacyOrgSettings {
  try {
    const settingsPath = path.join(folderPath, '.vscode', 'settings.json');
    if (!fs.existsSync(settingsPath)) {
      return {};
    }

    const content = fs.readFileSync(settingsPath, 'utf-8');
    const settings = JSON.parse(content);

    return {
      organization: settings['snyk.advanced.organization'],
      autoSelectOrganization: settings['snyk.advanced.autoSelectOrganization'],
    };
  } catch (error) {
    // Log but continue — don't break migration for one folder's parse error
    console.warn(`Failed to read legacy org settings from ${folderPath}:`, error);
    return {};
  }
}

/**
 * Maps legacy org settings to new LS FolderConfig keys.
 *
 * Migration logic:
 * - If organization is set AND autoSelectOrganization is false: org_set_by_user=true, preferred_org=value
 * - If organization is set AND autoSelectOrganization is true: org_set_by_user=false
 * - If organization is set AND autoSelectOrganization is absent: org_set_by_user=true, preferred_org=value (user explicitly set it)
 * - If organization is absent OR autoSelectOrganization is true: org_set_by_user=false
 */
function mapLegacyOrgToFolderConfig(legacy: LegacyOrgSettings): Record<string, { value: unknown; changed: boolean }> {
  const migrated: Record<string, { value: unknown; changed: boolean }> = {};

  if (legacy.organization) {
    // User explicitly set an org value
    if (legacy.autoSelectOrganization === true) {
      // Explicitly disabled user org — use auto-selection instead
      migrated[LS_KEY.orgSetByUser] = { value: false, changed: true };
    } else {
      // autoSelectOrganization is false OR undefined — keep the explicit org
      migrated[LS_KEY.orgSetByUser] = { value: true, changed: true };
      migrated[LS_KEY.preferredOrg] = { value: legacy.organization, changed: true };
    }
  } else {
    // No org set — auto-selection applies (whether explicitly enabled or default)
    migrated[LS_KEY.orgSetByUser] = { value: false, changed: true };
  }

  return migrated;
}

/**
 * Performs the one-time migration of per-folder org settings from v2.31.0 to the new model.
 * Idempotent: checks globalState memento to skip if already run.
 */
export async function migrateFolderOrgSettingsIfNeeded(
  workspace: IVSCodeWorkspace,
  configuration: IConfiguration,
  context: ExtensionContext,
): Promise<void> {
  // Check if migration has already run
  if (context.globalState.get(MEMENTO_FOLDER_ORG_MIGRATION_V1) === true) {
    return;
  }

  try {
    const workspaceFolders = workspace.getWorkspaceFolders?.();
    if (!workspaceFolders || workspaceFolders.length === 0) {
      // No folders to migrate
      context.globalState.update(MEMENTO_FOLDER_ORG_MIGRATION_V1, true);
      return;
    }

    // Get current in-memory folder configs (may be empty on first start)
    const currentConfigs = configuration.getFolderConfigs();
    const configsByPath = new Map(currentConfigs.map(c => [c.folderPath, c]));

    let migrationNeeded = false;

    for (const folder of workspaceFolders) {
      const folderPath = folder.uri.fsPath;
      const legacy = readLegacyOrgSettingsFromFile(folderPath);

      // Skip if no legacy org settings exist
      if (!legacy.organization && legacy.autoSelectOrganization === undefined) {
        continue;
      }

      migrationNeeded = true;

      // Get or create folder config for this path
      let folderConfig = configsByPath.get(folderPath);
      if (!folderConfig) {
        folderConfig = new FolderConfig(folderPath);
        configsByPath.set(folderPath, folderConfig);
      }

      // Apply migration: map legacy settings to LS keys
      const migratedSettings = mapLegacyOrgToFolderConfig(legacy);
      for (const [key, setting] of Object.entries(migratedSettings)) {
        folderConfig.settings[key] = setting;
      }
    }

    if (migrationNeeded) {
      // Update in-memory configs and notify LS of changes
      const migratedConfigs = Array.from(configsByPath.values());
      await configuration.setFolderConfigs(migratedConfigs, true);
    }

    // Mark migration complete
    context.globalState.update(MEMENTO_FOLDER_ORG_MIGRATION_V1, true);
  } catch (error) {
    console.error('Folder org migration failed:', error);
    // Mark as done anyway to avoid repeated attempts — user can manually fix if needed
    context.globalState.update(MEMENTO_FOLDER_ORG_MIGRATION_V1, true);
    throw error;
  }
}
