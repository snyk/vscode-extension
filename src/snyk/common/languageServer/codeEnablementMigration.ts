import { Configuration } from '../configuration/configuration';
import { CODE_SECURITY_ENABLED_SETTING } from '../constants/settings';
import {
  MEMENTO_ANALYTICS_PLUGIN_INSTALLED_SENT,
  MEMENTO_CLI_VERSION,
  MEMENTO_CODE_ENABLEMENT_MIGRATED,
  MEMENTO_LS_PROTOCOL_VERSION,
} from '../constants/globalState';
import type { ExtensionContext } from '../vscode/extensionContext';
import type { IVSCodeWorkspace } from '../vscode/workspace';
import type { ILog } from '../logger/interfaces';

// Mementos a prior activation persists that evidence a pre-existing install. All are written
// after this migration runs in a given activation (download at extension.ts and the plugin-
// installed event both run later), so on a fresh install's first launch they are all undefined.
// Using several — rather than the download-gated protocol version alone — means a custom-cliPath
// or air-gapped install (which never triggers a managed download, so never writes the protocol or
// CLI version) is still recognised via the download-independent plugin-installed memento.
const EXISTING_INSTALL_MEMENTOS = [
  MEMENTO_LS_PROTOCOL_VERSION,
  MEMENTO_CLI_VERSION,
  MEMENTO_ANALYTICS_PLUGIN_INSTALLED_SENT,
];

/**
 * One-shot recovery migration for the Snyk Code enabled state.
 *
 * The default value for Cdde enablement changed from True to False (to match the language server)
 * in extension version 2.32.0.
 *
 * On the first run after upgrade, we set `codeSecurity = true` into global settings for users
 * of pre-2.32.0 extensions who have no explicit global value. Fresh installs are never seeded:
 * they defer to org governance / the LS default. This does mean that users who relied on Code being
 * enabled will have a user preference for Code enablement after upgrade, which might override
 * LDX-Sync values. This is a deliberate trade-off to preserve functionality.
 *
 * {@link EXISTING_INSTALL_MEMENTOS} is used to track state over upgrade. Since they arw written
 * on first launch (after this migration runs), the migration only runs once.
 *
 * There is a deliberate asymmetry with OSS/IaC/Secrets: those defaults already match the LS,
 * wehereas the Code value was the opposite of the LS default.
 *
 * Best-effort: never throws. A failure is logged and the migration retries on the next activation
 * (the guard is recorded only after a successful pass), so it can never abort extension activation.
 */
export async function migrateCodeEnablementForExistingInstall(
  context: Pick<ExtensionContext, 'getGlobalStateValue' | 'updateGlobalStateValue'>,
  workspace: Pick<IVSCodeWorkspace, 'inspectConfiguration' | 'updateConfiguration'>,
  logger: ILog,
): Promise<void> {
  try {
    // Idempotent: the migration is evaluated exactly once per install.
    if (context.getGlobalStateValue<boolean>(MEMENTO_CODE_ENABLEMENT_MIGRATED)) {
      return;
    }

    // A prior activation persisted a lifecycle memento → this is an upgrade, not a fresh install.
    const isExistingInstall = EXISTING_INSTALL_MEMENTOS.some(key => context.getGlobalStateValue(key) !== undefined);

    if (isExistingInstall) {
      const { configurationId, section } = Configuration.getConfigName(CODE_SECURITY_ENABLED_SETTING);
      const inspect = workspace.inspectConfiguration<boolean>(configurationId, section);

      // Only materialize when the user relied on the old default: the setting resolves (inspect is
      // defined for a registered key) but has no explicit global value. An explicitly persisted
      // true or false is left untouched. Matches the seed's `inspect === undefined` skip.
      if (inspect !== undefined && inspect.globalValue === undefined) {
        await workspace.updateConfiguration(configurationId, section, true, true);
        logger.info('Preserved the existing Snyk Code enabled state as an explicit setting on upgrade.');
      }
    }

    // Record evaluation regardless of outcome so a fresh install is never seeded on a later launch.
    await context.updateGlobalStateValue(MEMENTO_CODE_ENABLEMENT_MIGRATED, true);
  } catch (e) {
    // Never let a best-effort recovery migration abort activation. The guard is not recorded on
    // failure, so the migration retries on the next activation.
    logger.warn(`Snyk Code enablement recovery migration failed; will retry on next activation: ${e}`);
  }
}
