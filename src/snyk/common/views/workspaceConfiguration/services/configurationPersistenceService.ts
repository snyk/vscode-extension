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
import { assertExplicitOverrideDepsPresent } from '../../../languageServer/explicitLsKeyTracking';
import {
  GLOBAL_RESET_FIELDS,
  lsKeyToVscodeKey,
  mapConfigToSettings,
  VSCODE_KEY_TO_LS_KEYS,
} from '../../../languageServer/lsKeyToVscodeKeyMap';
import { HtmlSettingsData, HtmlFolderSettingsData } from '../types/workspaceConfiguration.types';
import type { IExplicitOverridesMap } from '../../../languageServer/explicitOverridesMap';
import type { ILastKnownValueCache } from '../../../languageServer/lastKnownValueCache';
import { IScopeDetectionService } from './scopeDetectionService';

export interface IConfigurationPersistenceService {
  handleSaveConfig(configJson: string): Promise<void>;
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
   * This is the OUTBOUND counterpart of the inbound `InboundConfigPersistenceService`'s global
   * reset handling (which updates the last-known-value cache but never the explicit-overrides
   * map — that class has no reference to it, structurally). This path writes unconditionally
   * (no "does an override already exist" gate), since the webview's dirty-tracking already
   * guarantees a null field is a genuine reset.
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
        this.lastKnownValueCache.set(vscodeKey, undefined);

        // Each sibling is recorded independently: a callback failure (e.g. a resolver throw
        // during the D1 cache seed) must not prevent the remaining siblings in the same
        // fan-out group from being recorded — the VS Code write already succeeded for all of them.
        for (const lsKey of lsKeys) {
          try {
            this.explicitOverridesMap.setReset(lsKey);
            this.logger.debug(`Outbound reset: cleared global override for ${lsKey}`);
          } catch (cbErr) {
            this.logger.error(`Failed to record explicit-overrides reset for ${lsKey}: ${cbErr}`);
          }
        }
      } catch (e) {
        this.logger.error(`Failed to reset setting ${vscodeKey}: ${e}`);
      }
    }
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

    // The webview only sends a field when its value genuinely changed (client-side
    // dirty-tracking), so every key present is written unconditionally — no
    // unchanged-since-last-write skip (unlike the inbound path, which re-applies the LS's
    // full resolved state on every pull and must skip redundant rewrites).
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

        await this.workspace.updateConfiguration(configurationId, settingName, effectiveValue, scope !== 'workspace');

        this.lastKnownValueCache.set(settingKey, effectiveValue);

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

        this.logger.debug(`Updated setting: ${settingKey} at ${scope} level`);
      } catch (e) {
        this.logger.error(`Failed to update setting ${settingKey}: ${e}`);
      }
    }

    this.logger.info('Successfully wrote all settings to VS Code configuration');
  }
}
