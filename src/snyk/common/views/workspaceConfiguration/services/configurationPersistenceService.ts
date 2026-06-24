// ABOUTME: Service for persisting configuration to VS Code settings and secret storage
// ABOUTME: Handles token storage and workspace/user-level settings updates
import { IConfiguration } from '../../../configuration/configuration';
import { Configuration } from '../../../configuration/configuration';
import { DID_CHANGE_CONFIGURATION_METHOD } from '../../../constants/languageServer';
import { SNYK_CONTEXT } from '../../../constants/views';
import { ILog } from '../../../logger/interfaces';
import { IContextService } from '../../../services/contextService';
import { ILanguageClientAdapter } from '../../../vscode/languageClient';
import { IVSCodeWorkspace } from '../../../vscode/workspace';
import type { LspConfigSetting, LspConfigurationParam } from '../../../languageServer/types';
import { folderConfigsFromLspParam } from '../../../languageServer/inboundLspFolderSettingsToFolderConfig';
import {
  GLOBAL_RESET_FIELDS,
  lsKeyToVscodeKey,
  mapConfigToSettings,
  mapLspSettingsToVscodeSettings,
} from '../../../languageServer/lsKeyToVscodeKeyMap';
import type { GlobalLsKeyValue } from '../../../languageServer/serverSettingsToLspConfigurationParam';
import { HtmlSettingsData, HtmlFolderSettingsData } from '../types/workspaceConfiguration.types';
import type { IExplicitLspConfigurationChangeTracker } from '../../../languageServer/explicitLspConfigurationChangeTracker';
import { type IConfigFeedbackSuppressor } from '../../../languageServer/configFeedbackSuppressor';
import { IScopeDetectionService } from './scopeDetectionService';

export interface IConfigurationPersistenceService {
  handleSaveConfig(configJson: string): Promise<void>;

  /**
   * Writes LS global settings from `$/snyk.configuration` into VS Code `settings.json`.
   * No-op when the global snapshot has no mappable keys.
   */
  persistInboundLspConfiguration(param: LspConfigurationParam): Promise<void>;
}

export class ConfigurationPersistenceService implements IConfigurationPersistenceService {
  constructor(
    private readonly workspace: IVSCodeWorkspace,
    private readonly configuration: IConfiguration,
    private readonly scopeDetectionService: IScopeDetectionService,
    private readonly clientAdapter: ILanguageClientAdapter,
    private readonly logger: ILog,
    /**
     * Held active (begin/end) across the ENTIRE reset batch in `applyOutboundGlobalResets`
     * — the VS Code write AND the subsequent tracker mutations (unmarkExplicitlyChanged +
     * markPendingReset).  This mirrors the inbound persistence path, which holds
     * `suppressConfigFeedbackFromInboundPersistence = true` across its whole operation.
     *
     * The SAME shared instance must be passed to both `ConfigurationPersistenceService` and
     * `LanguageServer`, wired in extension.ts.  If each class constructed its own instance,
     * ConfigurationPersistenceService.begin()/end() would toggle one object while LanguageServer's
     * listener checked a different object (isActive always false there) — suppression silently broken.
     */
    private readonly outboundResetSuppressor: IConfigFeedbackSuppressor,
    private readonly contextService?: IContextService,
    private readonly explicitLspConfigurationChangeTracker?: IExplicitLspConfigurationChangeTracker,
  ) {}

  async handleSaveConfig(configJson: string): Promise<void> {
    try {
      const config = JSON.parse(configJson) as HtmlSettingsData;
      config.isFallbackForm ??= false;
      this.logger.info(`Saving workspace configuration (isFallbackForm: ${config.isFallbackForm})`);

      await this.saveConfigToVSCodeSettings(config);

      // Only handle token when not in CLI-only mode and token is present in the payload
      if (!config.isFallbackForm && 'token' in config) {
        const existingToken = await this.configuration.getToken();
        const normalizedNewToken = config.token?.trim() || '';
        const normalizedExistingToken = existingToken?.trim() || '';
        if (normalizedNewToken !== normalizedExistingToken) {
          await this.configuration.setToken(config.token);
          if (this.contextService) {
            await this.contextService.setContext(SNYK_CONTEXT.LOGGEDIN, true);
            await this.contextService.setContext(SNYK_CONTEXT.AUTHENTICATION_METHOD_CHANGED, false);
          }
        }
      }

      // Notify the LS once after all settings (including token) have been written.
      // The client is undefined until the LS has started — e.g. when saving from the fallback
      // settings page while the CLI is still downloading. Settings are already persisted above,
      // and the LS reads them from initializationOptions at its next start, so skipping the
      // notification here is safe.
      const languageClient = this.clientAdapter.getLanguageClient();
      if (languageClient) {
        await languageClient.sendNotification(DID_CHANGE_CONFIGURATION_METHOD, {});
      } else {
        this.logger.debug('Language Server is not running; skipping didChangeConfiguration notification.');
      }

      this.logger.info('Workspace configuration saved successfully');
    } catch (e) {
      this.logger.error(`Failed to save workspace configuration: ${e}`);
      throw e;
    }
  }

  async persistInboundLspConfiguration(param: LspConfigurationParam): Promise<void> {
    try {
      const settings = param.settings ?? {};

      // Handle global resets first: the LS Unsets the user:global override and echoes
      // `{ value: null, changed: true }` so the effective value reverts to the
      // LDX-Sync/org/flagset default. We must clear the persisted VS Code global value
      // AND drop explicit-changed tracking, otherwise the stale override is re-pushed on
      // the next pull/reconnect (would otherwise need a manual IDE restart).
      await this.applyGlobalResets(settings);

      // Map the remaining (non-reset) LS settings directly to VS Code settings using the
      // registry. Entries without a vscodeKey (token, sendErrorReports, etc.) are skipped
      // automatically. Reset entries are excluded so they don't write `null` as a value.
      const settingsMap = mapLspSettingsToVscodeSettings(this.withoutGlobalResets(settings));

      if (Object.keys(settingsMap).length > 0) {
        this.logger.debug('Persisting inbound Snyk Language Server configuration to VS Code settings');
        await this.applySettingsMap(settingsMap);
      }

      // Apply folder configs to in-memory storage — LS is the source of truth.
      // An empty array means "clear all folder overrides".
      if (param.folderConfigs !== undefined) {
        await this.configuration.setFolderConfigs(folderConfigsFromLspParam(param));
      }
    } catch (e) {
      this.logger.error(`Failed to persist inbound LS configuration: ${e}`);
      throw e;
    }
  }

  /** A reset is an inbound global setting of `{ value: null, changed: true }`. */
  private isGlobalReset(setting: LspConfigSetting): boolean {
    return setting.value === null && setting.changed === true;
  }

  /**
   * Returns the settings map with genuine global-reset entries removed, so they are not
   * written as values. An entry is a genuine reset only when BOTH conditions hold:
   *   1. The setting is a global reset (`{ value: null, changed: true }`), AND
   *   2. The lsKey is a member of GLOBAL_RESET_FIELDS.
   *
   * Non-resettable keys that happen to arrive as `{ value: null, changed: true }` are kept
   * in the result map so they reach the write path rather than being silently discarded.
   */
  private withoutGlobalResets(settings: Record<string, LspConfigSetting>): Record<string, LspConfigSetting> {
    const result: Record<string, LspConfigSetting> = {};
    for (const [lsKey, setting] of Object.entries(settings)) {
      if (this.isGlobalReset(setting) && GLOBAL_RESET_FIELDS.has(lsKey as GlobalLsKeyValue)) {
        continue;
      }
      result[lsKey] = setting;
    }
    return result;
  }

  /**
   * For each inbound global reset, clear the persisted VS Code global value
   * (`update(section, undefined, ConfigurationTarget.Global)`) and unmark explicit-changed
   * tracking so the now-reverted value is not re-pushed on the next sync/reconnect.
   *
   * Only keys that are members of GLOBAL_RESET_FIELDS are handled: the LS can send
   * `{ value: null, changed: true }` for non-resettable keys (e.g. `api_endpoint`,
   * `trusted_folders`) and we must not silently wipe those user settings.
   *
   * Deduplication: multiple LS keys may share one vscodeKey (e.g. all four
   * `severity_filter_*` map to `snyk.severity`). Each distinct vscodeKey is cleared at
   * most once per batch. Tracker mutations (unmarkExplicitlyChanged) happen AFTER the VS
   * Code write succeeds — mirroring `applyOutboundGlobalResets` — so state is never
   * updated when the write throws. On failure, the tracker is left unchanged so the
   * still-present override is re-pushed on the next sync/reconnect (fail-safe ordering).
   */
  private async applyGlobalResets(settings: Record<string, LspConfigSetting>): Promise<void> {
    // Group qualifying lsKeys by their shared vscodeKey (dedup writes).
    // The global "Project Defaults" reset nulls all GLOBAL_RESET_FIELDS together
    // (all-or-nothing per shared-key group), so clearing the whole shared object is the
    // intended semantics; the dedupe avoids redundant writes/config-change events.
    const vscodeKeyToLsKeys = new Map<string, string[]>();
    for (const [lsKey, setting] of Object.entries(settings)) {
      if (!this.isGlobalReset(setting)) continue;
      // Guard: only process keys that belong to the resettable set.
      if (!GLOBAL_RESET_FIELDS.has(lsKey as GlobalLsKeyValue)) continue;

      const vscodeKey = lsKeyToVscodeKey(lsKey);
      if (!vscodeKey) continue; // GLOBAL_RESET_FIELDS invariant: all members have a vscodeKey.

      const group = vscodeKeyToLsKeys.get(vscodeKey);
      if (group) {
        group.push(lsKey);
      } else {
        vscodeKeyToLsKeys.set(vscodeKey, [lsKey]);
      }
    }

    // For each distinct vscodeKey: write first, mutate tracker only on success.
    for (const [vscodeKey, lsKeys] of vscodeKeyToLsKeys) {
      try {
        const { configurationId, section } = Configuration.getConfigName(vscodeKey);
        // value=undefined removes the override; true → ConfigurationTarget.Global (user scope).
        await this.workspace.updateConfiguration(configurationId, section, undefined, true);
        // Mutate tracker state only after the write has succeeded.
        for (const lsKey of lsKeys) {
          this.explicitLspConfigurationChangeTracker?.unmarkExplicitlyChanged(lsKey);
          this.logger.debug(`Reset global setting: ${lsKey} (${vscodeKey})`);
        }
      } catch (e) {
        this.logger.error(`Failed to reset setting ${vscodeKey}: ${e}`);
        // Do NOT mutate tracker state — leave it consistent with the failed write.
      }
    }
  }

  private async applySettingsMap(settingsMap: Record<string, unknown>): Promise<void> {
    for (const [settingKey, value] of Object.entries(settingsMap)) {
      try {
        const { configurationId, section: settingName } = Configuration.getConfigName(settingKey);

        const scope = this.scopeDetectionService.getSettingScope(settingKey);

        // For object values, merge with current VS Code value to preserve sibling keys
        let effectiveValue = value;
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
          const current = this.workspace.getConfiguration(configurationId, settingName);
          if (current && typeof current === 'object') {
            effectiveValue = {
              ...(current as Record<string, unknown>),
              ...(value as Record<string, unknown>),
            };
          }
        }

        if (this.scopeDetectionService.shouldSkipSettingUpdate(configurationId, settingName, effectiveValue, scope)) {
          this.logger.debug(`Skipping ${settingKey}: no change or value is at default and not explicitly set`);
          continue;
        }

        await this.workspace.updateConfiguration(configurationId, settingName, effectiveValue, scope !== 'workspace');

        this.logger.debug(`Updated setting: ${settingKey} at ${scope} level`);
      } catch (e) {
        this.logger.error(`Failed to update setting ${settingKey}: ${e}`);
      }
    }

    this.logger.info('Successfully applied settings map to VS Code configuration');
  }

  private async saveFolderConfigs(folderConfigs?: Array<HtmlFolderSettingsData>): Promise<void> {
    if (!folderConfigs) return;

    const currentFolderConfigs = this.configuration.getFolderConfigs();

    const folderConfigMap = new Map(
      folderConfigs.map(fc => [fc.folderPath ?? ((fc as Record<string, unknown>)['folder_path'] as string), fc]),
    );

    const updatedFolderConfigs = currentFolderConfigs.map(currentFolderConfig => {
      const formData = folderConfigMap.get(currentFolderConfig.folderPath);
      if (!formData) return currentFolderConfig;

      // HtmlFolderSettingsData field names ARE LS key strings (snake_case),
      // so they pass directly to FolderConfig.setSetting().
      for (const [key, value] of Object.entries(formData)) {
        if (key === 'folderPath' || key === 'folder_path' || value === undefined) continue;
        currentFolderConfig.setSetting(key, value);
      }

      return currentFolderConfig;
    });

    await this.configuration.setFolderConfigs(updatedFolderConfigs, false);
  }

  /**
   * For each global-resettable LS key whose dialog value is explicitly `null`:
   * - clear the VS Code global override (updateConfiguration → undefined, global scope)
   * - unmark explicit-changed tracking so the reset is not re-pushed after acknowledgement
   * - mark a pending reset so the next outbound pull emits `{ value: null, changed: true }`
   *
   * Tracker mutations happen AFTER the VS Code write succeeds, so state is only updated
   * when the write actually completed. On write failure, state is left unchanged.
   *
   * The GLOBAL_RESET_FIELDS invariant guarantees every member has a vscodeKey
   * (enforced by the FIX 3 unit test), so the no-vscodeKey branch is unreachable
   * and has been removed. All reset keys are grouped by their (always-present) vscodeKey.
   *
   * pendingResets is intentionally in-memory only. The VS Code global override is cleared
   * at save time, so if the host crashes before the pending signal is consumed, the next
   * pull/start still emits the (now default) value with changed:false and the reset is
   * still reflected — no durable state needed.
   *
   * This is the OUTBOUND counterpart of `applyGlobalResets` (which handles the inbound echo).
   */
  private async applyOutboundGlobalResets(config: HtmlSettingsData): Promise<void> {
    // Deduplicate VS Code writes: group lsKeys by their shared vscodeKey.
    // The global "Project Defaults" reset nulls all GLOBAL_RESET_FIELDS together
    // (all-or-nothing per shared-key group), so clearing the whole shared object is the
    // intended semantics; the dedupe avoids redundant writes/config-change events.
    const vscodeKeyToLsKeys = new Map<string, string[]>();

    for (const lsKey of GLOBAL_RESET_FIELDS) {
      // Only treat the field as a reset when it is present AND explicitly null.
      if (!(lsKey in config) || config[lsKey] !== null) continue;

      // GLOBAL_RESET_FIELDS invariant: every member has a vscodeKey (see FIX 3 test).
      const vscodeKey = lsKeyToVscodeKey(lsKey);
      if (!vscodeKey) continue;

      const group = vscodeKeyToLsKeys.get(vscodeKey);
      if (group) {
        group.push(lsKey);
      } else {
        vscodeKeyToLsKeys.set(vscodeKey, [lsKey]);
      }
    }

    // Suppress the onDidChangeConfiguration listener across the ENTIRE reset batch —
    // mirroring the inbound persistence path which holds
    // suppressConfigFeedbackFromInboundPersistence = true across its whole
    // persistInboundConfiguration call (languageServer.ts runInboundPersistence).
    //
    // A SINGLE begin()/end() wraps the whole loop so the suppressor spans all groups.
    // Per-group try/catch inside the loop preserves the fail-safe ordering: one key's
    // write failure does NOT abort the batch, and tracker state is only mutated after a
    // successful write.
    //
    // TIMING CONTRACT THIS DESIGN DEPENDS ON:
    // VS Code dispatches onDidChangeConfiguration *synchronously* during the
    // workspace.getConfiguration().update() call — i.e. the event fires while the
    // awaiting code has not yet resumed past the `await updateConfiguration(...)` line.
    // Evidence: (1) the integration test in
    //   src/test/integration/configurationEventTiming.test.ts verifies this empirically
    //   against a real VS Code instance; (2) the inbound suppression path in
    //   runInboundPersistence (languageServer.ts) sets the flag synchronously, does all
    //   writes, and clears it synchronously in `finally` with no tick/yield between.
    //   If onDidChangeConfiguration were a macrotask the flag would already be false
    //   when the event arrived — inbound suppression would be broken, yet the feature
    //   works in production.  By contradiction, the event fires synchronously.
    //
    // Because the event is synchronous, a suppressor that is active across the write
    // is sufficient: the listener always sees isActive=true when VS Code fires the event
    // during the write.  The suppressor window intentionally spans past markPendingReset
    // so that the pending-reset signal is already set before any listener could fire
    // from a subsequent write (defensive belt-and-suspenders).
    //
    // If VS Code ever changed to dispatch onDidChangeConfiguration as a macrotask, both
    // this outbound suppressor AND the inbound suppressConfigFeedbackFromInboundPersistence
    // flag would need to be restructured (e.g. to a persistent suppress-until-consumed
    // model rather than a scoped boolean around the write).
    this.outboundResetSuppressor.begin();
    try {
      for (const [vscodeKey, lsKeys] of vscodeKeyToLsKeys) {
        try {
          const { configurationId, section } = Configuration.getConfigName(vscodeKey);
          await this.workspace.updateConfiguration(configurationId, section, undefined, true);
          // Mutate tracker state only after the write has succeeded, still inside the
          // suppression window so any synchronous onDidChangeConfiguration is still gated.
          for (const lsKey of lsKeys) {
            this.explicitLspConfigurationChangeTracker?.unmarkExplicitlyChanged(lsKey);
            this.explicitLspConfigurationChangeTracker?.markPendingReset(lsKey);
            this.logger.debug(`Outbound reset: cleared global override for ${lsKey} (${vscodeKey})`);
          }
        } catch (e) {
          this.logger.error(`Failed to clear global override for ${vscodeKey}: ${e}`);
          // Do NOT mutate tracker state — leave it consistent with the failed write.
        }
      }
    } finally {
      this.outboundResetSuppressor.end();
    }
  }

  private async saveConfigToVSCodeSettings(config: HtmlSettingsData): Promise<void> {
    this.logger.info('Writing configuration to VS Code settings');

    // Handle outbound global resets before building the settings map:
    // null-valued global-resettable fields are excluded from mapConfigToSettings
    // and processed here instead (clear VS Code global + mark pending reset for LS).
    await this.applyOutboundGlobalResets(config);

    const settingsMap = mapConfigToSettings(config);

    if (!config.isFallbackForm)
      await this.saveFolderConfigs(
        config.folderConfigs ?? (config['folder_configs'] as HtmlFolderSettingsData[] | undefined),
      );

    await this.applySettingsMap(settingsMap);

    this.logger.info('Successfully wrote all settings to VS Code configuration');
  }
}
