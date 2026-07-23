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
import type { WorkspaceFolder } from '../../../vscode/types';
import type { LspConfigSetting, LspConfigurationParam } from '../../../languageServer/types';
import { folderConfigsFromLspParam } from '../../../languageServer/inboundLspFolderSettingsToFolderConfig';
import {
  GLOBAL_RESET_FIELDS,
  lsKeyToVscodeKey,
  mapConfigToSettings,
  mapLspSettingsToVscodeSettings,
  SETTINGS_REGISTRY,
  VSCODE_KEY_TO_LS_KEYS,
} from '../../../languageServer/lsKeyToVscodeKeyMap';
import type { GlobalLsKeyValue } from '../../../languageServer/serverSettingsToLspConfigurationParam';
import { HtmlSettingsData, HtmlFolderSettingsData } from '../types/workspaceConfiguration.types';
import type { IExplicitLspConfigurationChangeTracker } from '../../../languageServer/explicitLspConfigurationChangeTracker';
import type { IExplicitOverridesMap } from '../../../languageServer/explicitOverridesMap';
import type { ILastKnownValueCache } from '../../../languageServer/lastKnownValueCache';
import { EFFECTIVE_VALUE_UNKNOWN, IScopeDetectionService } from './scopeDetectionService';

export interface IConfigurationPersistenceService {
  handleSaveConfig(configJson: string): Promise<void>;

  /**
   * Writes LS global settings from `$/snyk.configuration` into VS Code `settings.json`.
   * No-op when the global snapshot has no mappable keys.
   */
  persistInboundLspConfiguration(param: LspConfigurationParam): Promise<void>;
}

export class ConfigurationPersistenceService implements IConfigurationPersistenceService {
  /**
   * Snapshot of LS-resolved effective values keyed by VS Code setting key.
   * Populated on every inbound `$/snyk.configuration` (`persistInboundLspConfiguration`).
   * Read by `applySettingsMap` so the skip guard compares against the effective resolution
   * rather than the package.json schema default.
   *
   * Keys absent from the map (no snapshot yet for that key) use the EFFECTIVE_VALUE_UNKNOWN
   * sentinel, which triggers the override-aware fallback in shouldSkipSettingUpdate.
   */
  private effectiveByVscodeKey = new Map<string, unknown>();

  constructor(
    private readonly workspace: IVSCodeWorkspace,
    private readonly configuration: IConfiguration,
    private readonly scopeDetectionService: IScopeDetectionService,
    private readonly clientAdapter: ILanguageClientAdapter,
    private readonly logger: ILog,
    private readonly contextService?: IContextService,
    private readonly explicitLspConfigurationChangeTracker?: IExplicitLspConfigurationChangeTracker,
    private readonly explicitOverridesMap?: IExplicitOverridesMap,
    private readonly lastKnownValueCache?: ILastKnownValueCache,
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
      // automatically. Global-reset entries ({ value: null, changed: true }) are excluded by
      // mapLspSettingsToVscodeSettings's own null-skip (its `value === null` guard), so no
      // pre-filter is needed.
      const settingsMap = mapLspSettingsToVscodeSettings(settings);

      if (Object.keys(settingsMap).length > 0) {
        this.logger.debug('Persisting inbound Snyk Language Server configuration to VS Code settings');
        await this.applySettingsMap(settingsMap, true);
      }

      // Capture the LS-resolved effective values AFTER writing, so that subsequent
      // outbound saves (handleSaveConfig → applySettingsMap) compare against the
      // LS-effective baseline rather than the package.json schema default.
      //
      // Ordering note: capturing after applySettingsMap means this inbound batch is
      // written unconditionally (the guard sees the previous snapshot or UNKNOWN),
      // which is correct — inbound LS values are always authoritative. The snapshot
      // is for use by the NEXT outbound save, not for skipping this inbound write.
      //
      // Null values (reset echoes: { value: null, changed: true }) are excluded from the
      // snapshot — null means "reverted to org default", not a concrete effective value,
      // and is handled by the reset path above. Keys absent from a partial inbound batch
      // retain their last known effective value (map.set overwrites, does not clear).
      this.captureEffectiveSnapshot(settings);

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
   * Updates `effectiveByVscodeKey` from an inbound settings batch.
   *
   * For each LS key that has a vscodeKey mapping and a non-null value, accumulates the
   * LS-reported effective value keyed by vscodeKey. Null values (reset echoes) are
   * skipped — they represent "reverted to org default", not a concrete effective value.
   *
   * Uses the registry's `toVscodeValue` transform so the stored value is in the same
   * shape that the save path will compare against (VS Code value, not raw LS value).
   *
   * Multiple LS keys may share one vscodeKey (e.g. the four severity_filter_* keys all
   * map to snyk.severity, and issue_view_open_issues / issue_view_ignored_issues both map
   * to snyk.issueViewOptions). Object values are merged rather than overwritten so the
   * stored effective value has the same fully-merged shape that applySettingsMap compares
   * against. A naive set() would leave only the last-writer's partial object (e.g.
   * {low:true}), making isEqual(merged, partial) always false and producing spurious writes.
   *
   * Keys absent from a partial inbound batch retain their last known effective value.
   */
  private captureEffectiveSnapshot(settings: Record<string, LspConfigSetting>): void {
    for (const [lsKey, setting] of Object.entries(settings)) {
      if (setting.value === null || setting.value === undefined) continue;
      const vscodeKey = lsKeyToVscodeKey(lsKey);
      if (!vscodeKey) continue;
      // Apply the same toVscodeValue transform used by mapLspSettingsToVscodeSettings so
      // the stored effective value is in VS Code shape, matching what the save path writes.
      const entry = SETTINGS_REGISTRY[lsKey as keyof typeof SETTINGS_REGISTRY];
      const transformed = entry?.toVscodeValue ? entry.toVscodeValue(setting.value) : setting.value;
      // Merge object values rather than overwriting: multiple LS keys can share one
      // vscodeKey (severity_filter_* → snyk.severity; issue_view_* → snyk.issueViewOptions).
      // setOrMerge mirrors the logic in mapLspSettingsToVscodeSettings.
      const existing = this.effectiveByVscodeKey.get(vscodeKey);
      if (
        existing !== undefined &&
        typeof existing === 'object' &&
        existing !== null &&
        typeof transformed === 'object' &&
        transformed !== null
      ) {
        this.effectiveByVscodeKey.set(vscodeKey, {
          ...(existing as Record<string, unknown>),
          ...(transformed as Record<string, unknown>),
        });
      } else {
        this.effectiveByVscodeKey.set(vscodeKey, transformed);
      }
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

    // For each distinct vscodeKey: write first, mutate tracker only on success.
    await this.applyVscodeKeyResets(vscodeKeyToLsKeys, lsKey => {
      this.explicitLspConfigurationChangeTracker?.unmarkExplicitlyChanged(lsKey);
      this.logger.debug(`Reset global setting: ${lsKey}`);
    });
  }

  /**
   * Writes a VS Code setting, optionally tagging it as an inbound-origin write first.
   *
   * The tag (`markPendingInboundWrite`/`consumePendingInboundWrite`) tells the explicit-change
   * listener to treat the resulting `onDidChangeConfiguration` event as an echo rather than a
   * user edit, so it's marked BEFORE writing (surviving an arbitrarily delayed event) and
   * consumed on a thrown write so it can't leak into the next genuine edit of the same key.
   *
   * Pass `tagAsInboundOrigin: true` only when the write itself is not a user override to honor:
   * an LS-authoritative echo (`applySettingsMap` from `persistInboundLspConfiguration`), or the
   * inbound reset clearing an override (`applyVscodeKeyResets`, via `applyGlobalResets` — the
   * caller already unmarks the key via `onWriteSuccess`).
   *
   * The outbound save path (`saveConfigToVSCodeSettings`) no longer routes through this method —
   * it writes directly (see `applyOutboundSettingsMap`/`applyOutboundGlobalResets`), recording
   * attribution in the explicit-overrides map and last-known-value cache instead of tagging.
   */
  private async writeTaggedAsInboundOrigin(
    vscodeKey: string,
    configurationId: string,
    section: string,
    value: unknown,
    configurationTarget: boolean | WorkspaceFolder | undefined,
    tagAsInboundOrigin: boolean,
  ): Promise<void> {
    if (tagAsInboundOrigin) {
      this.explicitLspConfigurationChangeTracker?.markPendingInboundWrite(vscodeKey);
    }
    try {
      await this.workspace.updateConfiguration(configurationId, section, value, configurationTarget);
    } catch (e) {
      if (tagAsInboundOrigin) {
        this.explicitLspConfigurationChangeTracker?.consumePendingInboundWrite(vscodeKey);
      }
      throw e;
    }
  }

  /**
   * Write+error-handling loop for INBOUND global resets (`applyGlobalResets`). The outbound
   * save path has its own dedicated resets (`applyOutboundGlobalResets`) that write
   * unconditionally, since the webview's dirty-tracking already guarantees a null field is a
   * genuine reset.
   *
   * For each (vscodeKey → lsKeys) entry: clears the VS Code global override
   * (updateConfiguration → undefined, global scope) then, on success only, calls
   * `onWriteSuccess` for each lsKey in the group. One failure does NOT abort the batch
   * (per-group try/catch). The caller is responsible for any suppressor window.
   *
   * On success, also removes the vscodeKey from `effectiveByVscodeKey` so the next
   * outbound save falls back to EFFECTIVE_VALUE_UNKNOWN rather than a stale pre-reset
   * value. Without this invalidation, a save of a value equal to the stale effective
   * would be silently skipped — reproducing the IDE-2149 class of bug in the reset window
   * between the inbound reset echo and the next $/snyk.configuration snapshot.
   */
  private async applyVscodeKeyResets(
    vscodeKeyToLsKeys: Map<string, string[]>,
    onWriteSuccess: (lsKey: string) => void,
  ): Promise<void> {
    for (const [vscodeKey, lsKeys] of vscodeKeyToLsKeys) {
      try {
        const { configurationId, section } = Configuration.getConfigName(vscodeKey);

        // Only write when a global or workspace override actually exists to clear: VS Code
        // fires no onDidChangeConfiguration event for a no-op write, so writing here would
        // leak a pending marker that's never consumed — silently suppressing the next genuine
        // user edit of this key [IDE-2264]. Routes through the same predicate applySettingsMap
        // uses, rather than a bespoke inspectConfiguration peek, so both write paths share one
        // "should this write happen" decision. onWriteSuccess below still runs either way, so
        // the caller's tracker state is queued regardless of whether a VS Code override
        // previously existed.
        const shouldSkip = this.scopeDetectionService.shouldSkipSettingUpdate(
          configurationId,
          section,
          undefined,
          'user',
          EFFECTIVE_VALUE_UNKNOWN,
        );
        if (!shouldSkip) {
          // value=undefined removes the override; true → ConfigurationTarget.Global (user scope).
          await this.writeTaggedAsInboundOrigin(vscodeKey, configurationId, section, undefined, true, true);
          // Invalidate the effective snapshot for this vscodeKey: the reset cleared the
          // VS Code override, so the stored effective value is now stale. The next outbound
          // save must fall back to EFFECTIVE_VALUE_UNKNOWN (override-aware fallback) rather
          // than skipping on equality with the now-stale effective.
          this.effectiveByVscodeKey.delete(vscodeKey);
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

  private async applySettingsMap(settingsMap: Record<string, unknown>, tagAsInboundOrigin: boolean): Promise<void> {
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

        // Resolve the LS-effective value for this VS Code key so the guard compares
        // against the actual LS resolution, not the package.json schema default.
        const lsEffective = this.effectiveByVscodeKey.has(settingKey)
          ? this.effectiveByVscodeKey.get(settingKey)
          : EFFECTIVE_VALUE_UNKNOWN;

        if (
          this.scopeDetectionService.shouldSkipSettingUpdate(
            configurationId,
            settingName,
            effectiveValue,
            scope,
            lsEffective,
          )
        ) {
          this.logger.debug(`Skipping ${settingKey}: no change or value is at default and not explicitly set`);
          continue;
        }

        await this.writeTaggedAsInboundOrigin(
          settingKey,
          configurationId,
          settingName,
          effectiveValue,
          scope !== 'workspace',
          tagAsInboundOrigin,
        );

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
   * and still uses the old tracker + effective-value snapshot — migrated separately).
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

    for (const [vscodeKey, lsKeys] of vscodeKeyToLsKeys) {
      try {
        const { configurationId, section } = Configuration.getConfigName(vscodeKey);
        // value=undefined removes the override; true → ConfigurationTarget.Global (user scope).
        await this.workspace.updateConfiguration(configurationId, section, undefined, true);

        this.lastKnownValueCache?.set(vscodeKey, undefined);
        for (const lsKey of lsKeys) {
          try {
            this.explicitOverridesMap?.setReset(lsKey);
            this.logger.debug(`Outbound reset: cleared global override for ${lsKey}`);
          } catch (cbErr) {
            this.logger.error(`Failed to record explicit-overrides reset for ${lsKey}: ${cbErr}`);
          }
        }
      } catch (e) {
        this.logger.error(`Failed to reset setting ${vscodeKey}: ${e}`);
        // Do NOT record a reset or update the cache — leave state consistent with the failed write.
      }
    }
  }

  /**
   * Writes every (non-reset) key in `settingsMap` directly to VS Code configuration for an
   * outbound webview save. Both settings webviews (the LS-served main form and the
   * extension's own fallback form) already send only fields whose value genuinely changed
   * since the form was last presented, so no "is this redundant" gate is applied here —
   * every key present is acted on directly, replacing the old effective-value comparison and
   * the old tag-based tracker.
   *
   * On a successful write: the last-known-value cache is updated for the VS Code key, and the
   * explicit-overrides map records each LS key that maps to it (only those actually present
   * with a non-null value in `config` — a shared vscodeKey like snyk.severity may have only
   * one of its sibling LS keys present in the payload). A write that throws updates neither.
   */
  private async applyOutboundSettingsMap(
    settingsMap: Record<string, unknown>,
    config: HtmlSettingsData,
  ): Promise<void> {
    for (const [settingKey, value] of Object.entries(settingsMap)) {
      try {
        const { configurationId, section: settingName } = Configuration.getConfigName(settingKey);

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

        const scope = this.scopeDetectionService.getSettingScope(settingKey);

        await this.workspace.updateConfiguration(configurationId, settingName, effectiveValue, scope !== 'workspace');

        this.lastKnownValueCache?.set(settingKey, effectiveValue);
        // Each sibling is recorded independently: a shared vscodeKey (e.g. snyk.severity) can
        // have several LS keys, and one throwing must not skip recording the others — the VS
        // Code write above already succeeded for all of them.
        for (const lsKey of VSCODE_KEY_TO_LS_KEYS[settingKey] ?? []) {
          const lsValue = config[lsKey];
          if (lsValue === undefined || lsValue === null) continue;
          try {
            this.explicitOverridesMap?.setExplicitValue(lsKey, lsValue);
          } catch (cbErr) {
            this.logger.error(`Failed to record explicit-overrides value for ${lsKey}: ${cbErr}`);
          }
        }

        this.logger.debug(`Updated setting: ${settingKey} at ${scope} level`);
      } catch (e) {
        this.logger.error(`Failed to update setting ${settingKey}: ${e}`);
      }
    }

    this.logger.info('Successfully applied settings map to VS Code configuration');
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

    await this.applyOutboundSettingsMap(settingsMap, config);

    this.logger.info('Successfully wrote all settings to VS Code configuration');
  }
}
