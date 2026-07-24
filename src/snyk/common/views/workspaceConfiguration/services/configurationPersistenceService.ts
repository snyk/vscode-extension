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
import { assertExplicitOverrideDepsPresent } from '../../../languageServer/explicitLsKeyTracking';
import {
  GLOBAL_RESET_FIELDS,
  lsKeyToVscodeKey,
  mapConfigToSettings,
  mapLspSettingsToVscodeSettings,
  VSCODE_KEY_TO_LS_KEYS,
} from '../../../languageServer/lsKeyToVscodeKeyMap';
import _ from 'lodash';
import type { GlobalLsKeyValue } from '../../../languageServer/serverSettingsToLspConfigurationParam';
import { HtmlSettingsData, HtmlFolderSettingsData } from '../types/workspaceConfiguration.types';
import type { IExplicitOverridesMap } from '../../../languageServer/explicitOverridesMap';
import type { ILastKnownValueCache } from '../../../languageServer/lastKnownValueCache';
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
    private readonly contextService: IContextService | undefined,
    private readonly explicitOverridesMap: IExplicitOverridesMap,
    private readonly lastKnownValueCache: ILastKnownValueCache,
  ) {
    assertExplicitOverrideDepsPresent('ConfigurationPersistenceService', explicitOverridesMap, lastKnownValueCache);
  }

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
      // automatically. Global-reset entries ({ value: null, changed: true }) are excluded by
      // mapLspSettingsToVscodeSettings's own null-skip (its `value === null` guard), so no
      // pre-filter is needed.
      const settingsMap = mapLspSettingsToVscodeSettings(settings);

      if (Object.keys(settingsMap).length > 0) {
        this.logger.debug('Persisting inbound Snyk Language Server configuration to VS Code settings');
        await this.applySettingsMap(settingsMap, true);
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

  /**
   * A reset is an inbound global setting of `{ value: null, changed: true }`.
   * The LS may also encode a reset as `{ changed: true }` with the `value` field
   * omitted entirely, producing `value === undefined`.  Loose equality (`== null`)
   * captures both null and undefined so either encoding is treated as a reset.
   * The GLOBAL_RESET_FIELDS allowlist gate in the callers ensures this broadening
   * only applies to resettable keys.
   */
  private isGlobalReset(setting: LspConfigSetting): boolean {
    // eslint-disable-next-line eqeqeq
    return setting.value == null && setting.changed === true;
  }

  /**
   * For each inbound global reset, clears the persisted VS Code global value
   * (`update(section, undefined, ConfigurationTarget.Global)`).
   *
   * [IDE-2264 ticket 03/09]: deliberately does NOT touch the explicit-overrides map — this
   * inbound path has no access to it, structurally. The map's reset sentinel exists to get OUR
   * OWN pending reset delivered to the LS; this path is the LS itself telling us a reset already
   * happened. Writing to the map here would echo the LS's own reset back to it on the next pull —
   * a redundant `Unset`/disk write at best, and a resend of an already-confirmed reset at worst,
   * if this echo arrives after our own outbound delivery already cleared the sentinel (see
   * `applyOutboundGlobalResets`).
   *
   * Only keys that are members of GLOBAL_RESET_FIELDS are handled: the LS can send
   * `{ value: null, changed: true }` for non-resettable keys (e.g. `api_endpoint`,
   * `trusted_folders`) and we must not silently wipe those user settings.
   *
   * Deduplication: multiple LS keys may share one vscodeKey (e.g. all four
   * `severity_filter_*` map to `snyk.severity`). Each distinct vscodeKey is cleared at
   * most once per batch.
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
      // GLOBAL_RESET_FIELDS invariant: every member has a vscodeKey.
      // Enforced at test-time by the drift guard in lsKeyToVscodeKeyMap.test.ts.
      // If the invariant is ever violated (drift without test coverage), throw rather than
      // silently skipping — a missing vscodeKey is a programming error, not a recoverable
      // runtime condition.
      if (!vscodeKey)
        throw new Error(`GLOBAL_RESET_FIELDS invariant violated: '${lsKey}' has no vscodeKey in SETTINGS_REGISTRY`);

      const group = vscodeKeyToLsKeys.get(vscodeKey);
      if (group) {
        group.push(lsKey);
      } else {
        vscodeKeyToLsKeys.set(vscodeKey, [lsKey]);
      }
    }

    // For each distinct vscodeKey: write first, log only on success. [IDE-2264 ticket 03]: this
    // inbound path never writes to the explicit-overrides map — it has no access to it.
    await this.applyVscodeKeyResets(
      vscodeKeyToLsKeys,
      lsKey => {
        this.logger.debug(`Reset global setting: ${lsKey}`);
      },
      true,
    );
  }

  /**
   * Write+error-handling loop shared by INBOUND (`applyGlobalResets`) and OUTBOUND
   * (`applyOutboundGlobalResets`) reset paths.
   *
   * For each (vscodeKey → lsKeys) entry: clears the VS Code global override
   * (updateConfiguration → undefined, global scope) then, on success only, calls
   * `onWriteSuccess` for each lsKey in the group. One failure does NOT abort the batch
   * (per-group try/catch). The caller is responsible for any suppressor window.
   *
   * On success, also updates the last-known-value cache to `undefined` for the vscodeKey, so a
   * subsequent inbound push's redundancy check compares against the post-reset state rather
   * than a stale pre-reset value.
   *
   * `gateOnExistingOverride`: the inbound path (echoing an LS-reported reset) only writes when a
   * global override actually exists to clear — VS Code fires no onDidChangeConfiguration event
   * for a no-op write, and onWriteSuccess still runs either way so the caller's tracker state is
   * queued regardless. The outbound path writes unconditionally, since the webview's
   * dirty-tracking already guarantees a null field is a genuine reset.
   */
  private async applyVscodeKeyResets(
    vscodeKeyToLsKeys: Map<string, string[]>,
    onWriteSuccess: (lsKey: string) => void,
    gateOnExistingOverride: boolean,
  ): Promise<void> {
    for (const [vscodeKey, lsKeys] of vscodeKeyToLsKeys) {
      try {
        const { configurationId, section } = Configuration.getConfigName(vscodeKey);

        const shouldSkip =
          gateOnExistingOverride &&
          this.scopeDetectionService.shouldSkipSettingUpdate(configurationId, section, undefined, 'user');
        if (!shouldSkip) {
          // value=undefined removes the override; true → ConfigurationTarget.Global (user scope).
          await this.workspace.updateConfiguration(configurationId, section, undefined, true);
          // The reset cleared the VS Code override, so the next inbound push for this key
          // must not be skipped as redundant against the now-stale pre-reset value.
          this.lastKnownValueCache.set(vscodeKey, undefined);
        }
        // Mutate caller-supplied state whether or not there was anything to write.
        // Each key's callback is wrapped independently: a callback failure (e.g. a resolver
        // throw during the D1 cache seed) must not prevent the remaining siblings in the
        // same fan-out group from receiving their onWriteSuccess notification.
        for (const lsKey of lsKeys) {
          try {
            onWriteSuccess(lsKey);
          } catch (cbErr) {
            this.logger.error(`onWriteSuccess failed for ${lsKey}: ${cbErr}`);
          }
        }
      } catch (e) {
        this.logger.error(`Failed to reset setting ${vscodeKey}: ${e}`);
        // Do NOT call onWriteSuccess — leave caller state consistent with the failed write.
      }
    }
  }

  /**
   * Write+error-handling loop shared by the INBOUND (`persistInboundLspConfiguration`) and
   * OUTBOUND (`saveConfigToVSCodeSettings`) settings-write paths.
   *
   * For each settingKey: merges object values with the current VS Code value (to preserve
   * sibling keys), writes, and updates the last-known-value cache. One failure does NOT abort
   * the batch (per-key try/catch).
   *
   * `skipIfUnchanged`: the inbound path re-applies the LS's full resolved state on every pull,
   * so it skips a value unchanged since the last write to this VS Code key (redundancy check
   * against the last-known-value cache). The outbound path's webview only sends a field when
   * its value genuinely changed (client-side dirty-tracking), so it writes every key present
   * unconditionally.
   *
   * `onWriteSuccess`: called after a successful write, e.g. to record explicit-overrides
   * entries (outbound only — the inbound path has no per-user-action to attribute the write to).
   */
  private async applySettingsMap(
    settingsMap: Record<string, unknown>,
    skipIfUnchanged: boolean,
    onWriteSuccess?: (settingKey: string) => void,
  ): Promise<void> {
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

        if (skipIfUnchanged) {
          // Redundancy check: every LS pull re-sends its full resolved state, so a value
          // unchanged since the last write to this VS Code key would otherwise be rewritten
          // on every sync. Compare only against the last-known-value cache — a cache miss
          // (nothing written yet this session for this key) never causes a skip, which is
          // what prevents a resolved value that happens to equal the schema default from
          // getting written as a permanent-looking override on the very first sync.
          const lastKnown = this.lastKnownValueCache.get(settingKey);
          if (lastKnown !== undefined && _.isEqual(effectiveValue, lastKnown)) {
            this.logger.debug(`Skipping ${settingKey}: unchanged since last write`);
            continue;
          }
        }

        await this.workspace.updateConfiguration(configurationId, settingName, effectiveValue, scope !== 'workspace');

        this.lastKnownValueCache.set(settingKey, effectiveValue);
        onWriteSuccess?.(settingKey);

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
   * - record a reset entry in the explicit-overrides map
   * - update the last-known-value cache to `undefined` (the override was cleared)
   *
   * The webview only sends a field when its value genuinely changed since the form was
   * last presented (client-side dirty-tracking), so every reset field here is acted on
   * directly — no "does an override already exist" gate, no old tag-based tracker.
   *
   * New-structure mutations happen AFTER the VS Code write succeeds, so state is only
   * updated when the write actually completed. On write failure, state is left unchanged.
   *
   * The GLOBAL_RESET_FIELDS invariant guarantees every member has a vscodeKey
   * (enforced by the FIX 3 unit test), so the no-vscodeKey branch is unreachable
   * and has been removed. All reset keys are grouped by their (always-present) vscodeKey.
   *
   * This is the OUTBOUND counterpart of `applyGlobalResets` (which handles the inbound echo
   * and updates the last-known-value cache but never the explicit-overrides map).
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

      // GLOBAL_RESET_FIELDS invariant: every member has a vscodeKey.
      // Enforced at test-time by the drift guard in lsKeyToVscodeKeyMap.test.ts
      // ('every GLOBAL_RESET_FIELDS member maps to a defined vscodeKey via lsKeyToVscodeKey').
      // If the invariant is ever violated (drift without test coverage), throw rather than
      // silently skipping — a missing vscodeKey is a programming error, not a recoverable
      // runtime condition, and silence would hide the bug until the LS misses the reset signal.
      const vscodeKey = lsKeyToVscodeKey(lsKey);
      if (!vscodeKey)
        throw new Error(`GLOBAL_RESET_FIELDS invariant violated: '${lsKey}' has no vscodeKey in SETTINGS_REGISTRY`);

      const group = vscodeKeyToLsKeys.get(vscodeKey);
      if (group) {
        group.push(lsKey);
      } else {
        vscodeKeyToLsKeys.set(vscodeKey, [lsKey]);
      }
    }

    await this.applyVscodeKeyResets(
      vscodeKeyToLsKeys,
      lsKey => {
        this.explicitOverridesMap.setReset(lsKey);
        this.logger.debug(`Outbound reset: cleared global override for ${lsKey}`);
      },
      false,
    );
  }

  private async saveConfigToVSCodeSettings(config: HtmlSettingsData): Promise<void> {
    this.logger.info('Writing configuration to VS Code settings');

    // Handle outbound global resets before building the settings map:
    // null-valued global-resettable fields are excluded from mapConfigToSettings
    // and processed here instead (clear VS Code global + record reset).
    await this.applyOutboundGlobalResets(config);

    const settingsMap = mapConfigToSettings(config);

    if (!config.isFallbackForm)
      await this.saveFolderConfigs(
        config.folderConfigs ?? (config['folder_configs'] as HtmlFolderSettingsData[] | undefined),
      );

    await this.applySettingsMap(settingsMap, false, settingKey => {
      // Each sibling is recorded independently: a shared vscodeKey (e.g. snyk.severity) can
      // have several LS keys, and one throwing must not skip recording the others — the VS
      // Code write already succeeded for all of them.
      for (const lsKey of VSCODE_KEY_TO_LS_KEYS[settingKey] ?? []) {
        const lsValue = config[lsKey];
        if (lsValue === undefined || lsValue === null) continue;
        try {
          this.explicitOverridesMap.setExplicitValue(lsKey, lsValue);
        } catch (cbErr) {
          this.logger.error(`Failed to record explicit-overrides value for ${lsKey}: ${cbErr}`);
        }
      }
    });

    this.logger.info('Successfully wrote all settings to VS Code configuration');
  }
}
