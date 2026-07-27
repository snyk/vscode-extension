// ABOUTME: Service for persisting inbound LS-pushed configuration to VS Code settings
// ABOUTME: Structurally has no access to the explicit-overrides map — the LS push path must never write to it
import { Configuration, IConfiguration } from '../../../configuration/configuration';
import { ILog } from '../../../logger/interfaces';
import { IVSCodeWorkspace } from '../../../vscode/workspace';
import type { LspConfigSetting, LspConfigurationParam } from '../../../languageServer/types';
import { folderConfigsFromLspParam } from '../../../languageServer/inboundLspFolderSettingsToFolderConfig';
import {
  GLOBAL_RESET_FIELDS,
  groupResettableLsKeysByVscodeKey,
  mapLspSettingsToVscodeSettings,
  resolveValueAfterGlobalReset,
} from '../../../languageServer/lsKeyToVscodeKeyMap';
import _ from 'lodash';
import type { GlobalLsKeyValue } from '../../../languageServer/serverSettingsToLspConfigurationParam';
import type { ILastKnownValueCache } from '../../../languageServer/lastKnownValueCache';
import { IScopeDetectionService } from './scopeDetectionService';

interface IInboundConfigPersistenceService {
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
    // Only process keys that are both a genuine reset AND belong to the resettable set. Grouping
    // (and the GLOBAL_RESET_FIELDS invariant throw) is shared with the outbound reset path — see
    // groupResettableLsKeysByVscodeKey.
    const qualifyingLsKeys = Object.entries(settings)
      .filter(([lsKey, setting]) => this.isGlobalReset(setting) && GLOBAL_RESET_FIELDS.has(lsKey as GlobalLsKeyValue))
      .map(([lsKey]) => lsKey);
    const vscodeKeyToLsKeys = groupResettableLsKeysByVscodeKey(qualifyingLsKeys);

    await this.applyVscodeKeyResets(vscodeKeyToLsKeys);
  }

  /**
   * For each distinct vscodeKey: clears the VS Code global override
   * (updateConfiguration → undefined, global scope) when one actually exists — VS Code fires no
   * onDidChangeConfiguration event for a no-op write, so this path only writes when there's
   * something to clear. One failure does NOT abort the batch (per-group try/catch).
   *
   * On success, also updates the last-known-value cache to the post-clear effective value (the
   * schema default when one exists, `undefined` otherwise) for the vscodeKey, so a subsequent
   * inbound push's redundancy check — and a later onDidChangeConfiguration event — compares
   * against the actual post-reset state rather than a stale pre-reset value or a phantom
   * `undefined`. A write that throws reverts the cache to its pre-reset value — otherwise the
   * cache would claim a reset VS Code never applied.
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
          const lastKnown = this.lastKnownValueCache.get(vscodeKey);
          // Cache updated BEFORE the write (not after): a live onDidChangeConfiguration listener
          // (markExplicitLsKeysFromConfigurationChangeEvent) can react to this same write before
          // this async function's own continuation resumes — see applySettingsMap's identical
          // ordering fix for why setting the cache first is required to avoid a false explicit
          // mark on a value this class never treats as a user override.
          //
          // Seeded with the post-clear effective value (schema default when one exists), computed
          // from an inspect taken BEFORE the clearing write below — getConfiguration would still
          // reflect the about-to-be-cleared override at this point, not the value the write will
          // actually leave behind.
          const inspect = this.workspace.inspectConfiguration<unknown>(configurationId, section);
          this.lastKnownValueCache.set(vscodeKey, resolveValueAfterGlobalReset(inspect));
          try {
            // value=undefined removes the override; true → ConfigurationTarget.Global (user scope).
            await this.workspace.updateConfiguration(configurationId, section, undefined, true);
          } catch (e) {
            // The write never landed — undo the cache update above, or the cache would claim a
            // reset VS Code does not have for the rest of the session.
            this.lastKnownValueCache.set(vscodeKey, lastKnown);
            throw e;
          }
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
   * the batch (per-key try/catch). A write that throws reverts the cache to its pre-write
   * value — otherwise the cache would claim a value VS Code never received.
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

        // Cache updated BEFORE the write (not after): VS Code fires onDidChangeConfiguration for
        // this write synchronously, and the live marking listener
        // (markExplicitLsKeysFromConfigurationChangeEvent) reads this cache to decide whether the
        // change is a genuine external edit. Updating it only after the write leaves a window
        // where that listener observes the just-written new value against a stale (pre-write)
        // cache entry, mistaking this inbound (never-a-user-override) write for one.
        this.lastKnownValueCache.set(settingKey, effectiveValue);

        try {
          await this.workspace.updateConfiguration(configurationId, settingName, effectiveValue, scope !== 'workspace');
        } catch (e) {
          // The write never landed — undo the cache update above, or the cache would claim a
          // value VS Code does not have for the rest of the session.
          this.lastKnownValueCache.set(settingKey, lastKnown);
          throw e;
        }

        this.logger.debug(`Updated setting: ${settingKey} at ${scope} level`);
      } catch (e) {
        this.logger.error(`Failed to update setting ${settingKey}: ${e}`);
      }
    }

    this.logger.info('Successfully applied settings map to VS Code configuration');
  }
}
