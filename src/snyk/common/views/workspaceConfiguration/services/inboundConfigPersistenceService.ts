// ABOUTME: Service for persisting inbound LS-pushed configuration to VS Code settings
// ABOUTME: Structurally has no access to the explicit-overrides map — the LS push path must never write to it
import { Configuration, IConfiguration } from '../../../configuration/configuration';
import { ILog } from '../../../logger/interfaces';
import { IVSCodeWorkspace } from '../../../vscode/workspace';
import type { LspConfigSetting, LspConfigurationParam } from '../../../languageServer/types';
import { folderConfigsFromLspParam } from '../../../languageServer/inboundLspFolderSettingsToFolderConfig';
import {
  GLOBAL_RESET_FIELDS,
  lsKeyToVscodeKey,
  mapLspSettingsToVscodeSettings,
} from '../../../languageServer/lsKeyToVscodeKeyMap';
import _ from 'lodash';
import type { GlobalLsKeyValue } from '../../../languageServer/serverSettingsToLspConfigurationParam';
import type { ILastKnownValueCache } from '../../../languageServer/lastKnownValueCache';
import { IScopeDetectionService } from './scopeDetectionService';

export interface IInboundConfigPersistenceService {
  /**
   * Writes LS global settings from `$/snyk.configuration` into VS Code `settings.json`.
   * No-op when the global snapshot has no mappable keys.
   */
  persistInboundLspConfiguration(param: LspConfigurationParam): Promise<void>;
}

export class InboundConfigPersistenceService implements IInboundConfigPersistenceService {
  constructor(
    private readonly workspace: IVSCodeWorkspace,
    private readonly configuration: IConfiguration,
    private readonly scopeDetectionService: IScopeDetectionService,
    private readonly logger: ILog,
    private readonly lastKnownValueCache: ILastKnownValueCache,
  ) {}

  async persistInboundLspConfiguration(param: LspConfigurationParam): Promise<void> {
    try {
      const settings = param.settings ?? {};

      // Handle global resets first: the LS Unsets the user:global override and echoes
      // `{ value: null, changed: true }` so the effective value reverts to the
      // LDX-Sync/org/flagset default. We must clear the persisted VS Code global value —
      // otherwise the stale override is re-pushed on the next pull/reconnect (would otherwise
      // need a manual IDE restart). This path never touches the explicit-overrides map: this
      // class has no reference to it, structurally, so the LS's own reset echo can't get
      // re-recorded and resent back to it on the next pull (see `ConfigurationPersistenceService
      // .applyOutboundGlobalResets`, the outbound counterpart that does own that map).
      await this.applyGlobalResets(settings);

      // Map the remaining (non-reset) LS settings directly to VS Code settings using the
      // registry. Entries without a vscodeKey (token, sendErrorReports, etc.) are skipped
      // automatically. Global-reset entries ({ value: null, changed: true }) are excluded by
      // mapLspSettingsToVscodeSettings's own null-skip (its `value === null` guard), so no
      // pre-filter is needed.
      const settingsMap = mapLspSettingsToVscodeSettings(settings);

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

    await this.applyVscodeKeyResets(vscodeKeyToLsKeys);
  }

  /**
   * For each distinct vscodeKey: clears the VS Code global override
   * (updateConfiguration → undefined, global scope) when one actually exists — VS Code fires no
   * onDidChangeConfiguration event for a no-op write, so this path only writes when there's
   * something to clear. One failure does NOT abort the batch (per-group try/catch).
   *
   * On success, also updates the last-known-value cache to `undefined` for the vscodeKey, so a
   * subsequent inbound push's redundancy check compares against the post-reset state rather
   * than a stale pre-reset value.
   */
  private async applyVscodeKeyResets(vscodeKeyToLsKeys: Map<string, string[]>): Promise<void> {
    for (const [vscodeKey, lsKeys] of vscodeKeyToLsKeys) {
      try {
        const { configurationId, section } = Configuration.getConfigName(vscodeKey);

        const shouldSkip = this.scopeDetectionService.shouldSkipSettingUpdate(
          configurationId,
          section,
          undefined,
          'user',
        );
        if (!shouldSkip) {
          // value=undefined removes the override; true → ConfigurationTarget.Global (user scope).
          await this.workspace.updateConfiguration(configurationId, section, undefined, true);
          // The reset cleared the VS Code override, so the next inbound push for this key
          // must not be skipped as redundant against the now-stale pre-reset value.
          this.lastKnownValueCache.set(vscodeKey, undefined);
        }
        for (const lsKey of lsKeys) {
          this.logger.debug(`Reset global setting: ${lsKey}`);
        }
      } catch (e) {
        this.logger.error(`Failed to reset setting ${vscodeKey}: ${e}`);
      }
    }
  }

  /**
   * For each settingKey: merges object values with the current VS Code value (to preserve
   * sibling keys), writes, and updates the last-known-value cache. One failure does NOT abort
   * the batch (per-key try/catch).
   *
   * The LS re-applies its full resolved state on every pull, so a value unchanged since the
   * last write to this VS Code key is skipped (redundancy check against the last-known-value
   * cache) rather than rewritten on every sync.
   */
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

        await this.workspace.updateConfiguration(configurationId, settingName, effectiveValue, scope !== 'workspace');

        this.lastKnownValueCache.set(settingKey, effectiveValue);

        this.logger.debug(`Updated setting: ${settingKey} at ${scope} level`);
      } catch (e) {
        this.logger.error(`Failed to update setting ${settingKey}: ${e}`);
      }
    }

    this.logger.info('Successfully applied settings map to VS Code configuration');
  }
}
