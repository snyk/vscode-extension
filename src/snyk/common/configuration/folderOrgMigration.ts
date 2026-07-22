import * as fs from 'fs';
import { parse } from 'jsonc-parser';
import * as path from 'path';
import { ExtensionContext } from 'vscode';
import { MEMENTO_FOLDER_ORG_MIGRATION_V1 } from '../constants/globalState';
import { ADVANCED_ORGANIZATION, ADVANCED_AUTO_SELECT_ORGANIZATION } from '../constants/settings';
import { ILog } from '../logger/interfaces';
import { LS_KEY } from '../languageServer/serverSettingsToLspConfigurationParam';
import { IVSCodeWorkspace } from '../vscode/workspace';
import { IConfiguration, FolderConfig } from './configuration';

/**
 * v2.31.0 had `snyk.advanced.organization`/`snyk.advanced.autoSelectOrganization` as
 * `resource`-scoped VS Code settings, so each folder's `.vscode/settings.json` could carry
 * its own org. Both are now window-scoped/removed, so those folder-level values are inert —
 * only this on-disk read can still recover them (IDE-2259).
 */
interface LegacyOrgSettings {
  organization?: string;
  autoSelectOrganization?: boolean;
}

async function readLegacyOrgSettings(folderPath: string, logger: ILog): Promise<LegacyOrgSettings> {
  try {
    // Deliberate coupling to VS Code's on-disk settings file layout — the only way left to
    // read a deregistered resource-scoped setting, since getConfiguration() can't return it.
    const settingsPath = path.join(folderPath, '.vscode', 'settings.json');
    const content = await fs.promises.readFile(settingsPath, 'utf-8');
    const settings = parse(content) as Record<string, unknown> | undefined;
    if (!settings) {
      return {};
    }
    const organization = settings[ADVANCED_ORGANIZATION];
    return {
      organization: typeof organization === 'string' ? organization : undefined,
      autoSelectOrganization: settings[ADVANCED_AUTO_SELECT_ORGANIZATION] as boolean | undefined,
    };
  } catch (e) {
    // ENOENT (no .vscode/settings.json) is the expected common case — only log real failures.
    if ((e as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      logger.debug(`folderOrgMigration: failed to read legacy org settings for ${folderPath}: ${e}`);
    }
    return {};
  }
}

export async function migrateFolderOrgSettingsIfNeeded(
  workspace: IVSCodeWorkspace,
  configuration: IConfiguration,
  context: ExtensionContext,
  logger: ILog,
): Promise<void> {
  // Tracked per-folder-path (not a single install-wide boolean): globalState is shared across
  // every window of this extension install, but the legacy org lives per workspace folder. A
  // per-install flag would let the first window post-upgrade permanently skip every other
  // folder/window that hasn't been seen yet (IDE-2259 review fix).
  const migratedFolderPaths = new Set(context.globalState.get<string[]>(MEMENTO_FOLDER_ORG_MIGRATION_V1) ?? []);
  const foldersToCheck = workspace.getWorkspaceFolders().filter(folder => !migratedFolderPaths.has(folder.uri.fsPath));
  if (foldersToCheck.length === 0) {
    return;
  }

  const existingConfigs = configuration.getFolderConfigs();
  const configsByPath = new Map(existingConfigs.map(c => [c.folderPath, c]));
  let migrated = false;

  for (const folder of foldersToCheck) {
    const folderPath = folder.uri.fsPath;
    // Record the folder as checked regardless of outcome, so a folder with no legacy org
    // isn't re-read on every activation.
    migratedFolderPaths.add(folderPath);

    const legacy = await readLegacyOrgSettings(folderPath, logger);
    // autoSelectOrganization:true is an explicit opt-out of the per-folder org — leave default.
    if (!legacy.organization || legacy.autoSelectOrganization === true) {
      continue;
    }

    const folderConfig = configsByPath.get(folderPath) ?? new FolderConfig(folderPath);
    folderConfig.setSetting(LS_KEY.orgSetByUser, true);
    folderConfig.setSetting(LS_KEY.preferredOrg, legacy.organization);
    configsByPath.set(folderPath, folderConfig);
    migrated = true;
  }

  if (migrated) {
    // triggerConfigChangeEvent=false: this runs before LanguageServer/LanguageClient exist,
    // so there's nothing to notify — the migrated configs are picked up directly by the
    // initial resolveFolderConfigs() call when building initializationOptions.
    await configuration.setFolderConfigs(Array.from(configsByPath.values()), false);
  }

  await context.globalState.update(MEMENTO_FOLDER_ORG_MIGRATION_V1, Array.from(migratedFolderPaths));
}
