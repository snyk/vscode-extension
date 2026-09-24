import * as fs from 'fs';
import { parse, ParseError } from 'jsonc-parser';
import * as path from 'path';
import { ExtensionContext, Uri } from 'vscode';
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
  // Genuine JSONC syntax error, as opposed to "checked, nothing there" (ENOENT or a valid
  // file with no org key) — the caller must NOT mark the folder migrated in this case, so a
  // transiently-broken settings.json gets retried next activation instead of losing the org
  // for good.
  parseFailed?: boolean;
}

function extractOrgSettings(settings: Record<string, unknown>): LegacyOrgSettings {
  const organization = settings[ADVANCED_ORGANIZATION];
  return {
    organization: typeof organization === 'string' ? organization : undefined,
    autoSelectOrganization: settings[ADVANCED_AUTO_SELECT_ORGANIZATION] as boolean | undefined,
  };
}

// Shared JSONC parse step for both settings.json and a .code-workspace file's top-level
// `settings` block. Collects errors instead of letting parse() silently return undefined on a
// hard syntax error, so callers can tell "malformed" apart from "empty/absent".
function parseOrgSettingsSource(
  content: string,
  sourcePath: string,
  logger: ILog,
): { raw: Record<string, unknown> | undefined } | { parseFailed: true } {
  const errors: ParseError[] = [];
  // VS Code's own settings.json tolerates trailing commas, so a trailing comma alone must not
  // be treated as the "genuine syntax error" case below.
  const raw = parse(content, errors, { allowTrailingComma: true }) as Record<string, unknown> | undefined;
  if (errors.length > 0) {
    logger.debug(`folderOrgMigration: malformed JSON in ${sourcePath}, will retry next activation`);
    return { parseFailed: true };
  }
  return { raw };
}

async function readLegacyOrgSettings(folderPath: string, logger: ILog): Promise<LegacyOrgSettings> {
  // Deliberate coupling to VS Code's on-disk settings file layout — the only way left to
  // read a deregistered resource-scoped setting, since getConfiguration() can't return it.
  const settingsPath = path.join(folderPath, '.vscode', 'settings.json');
  try {
    const content = await fs.promises.readFile(settingsPath, 'utf-8');
    const parsed = parseOrgSettingsSource(content, settingsPath, logger);
    if ('parseFailed' in parsed) {
      return { parseFailed: true };
    }
    return extractOrgSettings(parsed.raw ?? {});
  } catch (e) {
    // ENOENT (no .vscode/settings.json) is the expected common case — only log real failures.
    if ((e as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      logger.debug(`folderOrgMigration: failed to read legacy org settings for ${folderPath}: ${e}`);
    }
    return {};
  }
}

// A saved multi-root `.code-workspace` file has its own top-level `settings` block (same JSONC
// shape as .vscode/settings.json) that resource-scoped settings could also come from — a third
// tier alongside folder settings and defaults. Read once per activation, not once per folder.
async function readWorkspaceFileOrgSettings(workspaceFileUri: Uri, logger: ILog): Promise<LegacyOrgSettings> {
  if (workspaceFileUri.scheme !== 'file') {
    // ponytail: remote/virtual workspaces aren't handled here — IVSCodeWorkspace doesn't expose
    // vscode.workspace.fs, so there's no non-Node way to read this yet. Add if reported.
    return {};
  }
  try {
    const content = await fs.promises.readFile(workspaceFileUri.fsPath, 'utf-8');
    const parsed = parseOrgSettingsSource(content, workspaceFileUri.fsPath, logger);
    if ('parseFailed' in parsed) {
      return {};
    }
    return extractOrgSettings((parsed.raw?.settings as Record<string, unknown>) ?? {});
  } catch (e) {
    if ((e as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      logger.debug(
        `folderOrgMigration: failed to read workspace-file org settings for ${workspaceFileUri.fsPath}: ${e}`,
      );
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

  const workspaceFileUri = workspace.getWorkspaceFile();
  const workspaceOrg = workspaceFileUri ? await readWorkspaceFileOrgSettings(workspaceFileUri, logger) : {};

  const existingConfigs = configuration.getFolderConfigs();
  const configsByPath = new Map(existingConfigs.map(c => [c.folderPath, c]));
  let migrated = false;

  for (const folder of foldersToCheck) {
    const folderPath = folder.uri.fsPath;
    const legacy = await readLegacyOrgSettings(folderPath, logger);
    if (legacy.parseFailed) {
      // Don't record as migrated — retry this folder next activation instead of permanently
      // losing the org to a transiently-broken settings.json.
      continue;
    }
    // Record the folder as checked for every other outcome, so a folder with no legacy org
    // isn't re-read on every activation.
    migratedFolderPaths.add(folderPath);

    // Folder-level org wins; the workspace-file-level org is only a fallback for folders with
    // none of their own — matches VS Code's real settings precedence (folder overrides workspace).
    const effective = legacy.organization ? legacy : workspaceOrg;
    // autoSelectOrganization:true is an explicit opt-out of the per-folder org — leave default.
    if (!effective.organization || effective.autoSelectOrganization === true) {
      continue;
    }

    const folderConfig = configsByPath.get(folderPath) ?? new FolderConfig(folderPath);
    folderConfig.setSetting(LS_KEY.orgSetByUser, true);
    folderConfig.setSetting(LS_KEY.preferredOrg, effective.organization);
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
