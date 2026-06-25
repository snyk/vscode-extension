// ABOUTME: Service for detecting VS Code configuration scope (user/workspace/folder/default)
// ABOUTME: and populating scope indicators in HTML
import { Configuration } from '../../../configuration/configuration';
import { IVSCodeWorkspace } from '../../../vscode/workspace';
import _ from 'lodash';

/**
 * Sentinel that indicates the LS-resolved effective value is not known for a given key.
 * Used as the `effectiveValue` parameter of `shouldSkipSettingUpdate` when no inbound
 * `$/snyk.configuration` snapshot has been received yet for that key.
 *
 * A plain `undefined` cannot serve as the sentinel because an LS-resolved effective value
 * can legitimately be `undefined`/falsey for some keys. This unique symbol is unambiguous.
 */
export const EFFECTIVE_VALUE_UNKNOWN: unique symbol = Symbol('effective-value-unknown');

export interface IScopeDetectionService {
  getSettingScope(settingKey: string): string;
  populateScopeIndicators(html: string, mapHtmlKey: (key: string) => string | undefined): string;
  /**
   * Determines whether a setting update should be skipped.
   *
   * Predicate (ADR-1):
   * 1. If `effectiveValue` is known (not `EFFECTIVE_VALUE_UNKNOWN`):
   *    skip iff `_.isEqual(value, effectiveValue)` — redundant vs the LS-resolved effective state.
   * 2. If `effectiveValue` is unknown — fallback (override-aware, NEVER schema-default skip):
   *    - 'workspace':       skip iff value === workspaceValue       && workspaceValue       !== undefined
   *    - 'user':            skip iff value === globalValue          && globalValue          !== undefined
   *    - 'workspaceFolder': skip iff value === workspaceFolderValue && workspaceFolderValue !== undefined
   *    - 'default' (or any other): return false — never skip on schema-default equality alone
   */
  shouldSkipSettingUpdate(
    configurationId: string,
    settingName: string,
    value: unknown,
    scope: string,
    effectiveValue: unknown,
  ): boolean;
}

export class ScopeDetectionService implements IScopeDetectionService {
  constructor(private readonly workspace: IVSCodeWorkspace) {}

  getSettingScope(settingKey: string): string {
    const { configurationId, section: settingName } = Configuration.getConfigName(settingKey);

    const inspection = this.workspace.inspectConfiguration(configurationId, settingName);

    if (!inspection) return 'default';

    // Priority: workspaceFolderValue > workspaceValue > globalValue
    if (inspection.workspaceFolderValue !== undefined) return 'workspaceFolder';
    if (inspection.workspaceValue !== undefined) return 'workspace';
    if (inspection.globalValue !== undefined) return 'user';
    return 'default';
  }

  populateScopeIndicators(html: string, mapHtmlKey: (key: string) => string | undefined): string {
    const slotRegex =
      /(?<prefix><span[^>]*class="config-scope-slot"[^>]*data-setting-key=")(?<settingKey>[^"]*)(?<suffix>"[^>]*>)(?<content>.*?)(?<closing><\/span>)/g;

    return html.replace(slotRegex, (match, ...args) => {
      const groups = args[args.length - 1] as {
        prefix: string;
        settingKey: string;
        suffix: string;
        content: string;
        closing: string;
      };

      const vscodeSetting = mapHtmlKey(groups.settingKey);
      if (!vscodeSetting) return match;
      const scope = this.getSettingScope(vscodeSetting);

      if (scope !== 'workspace') {
        return match;
      }

      // Create scope indicator text like VS Code does - preserve original attributes
      const scopeIndicator = '<span class="scope-indicator">(Modified in Workspace)</span>';
      return `${groups.prefix}${groups.settingKey}${groups.suffix}${scopeIndicator}${groups.closing}`;
    });
  }

  shouldSkipSettingUpdate(
    configurationId: string,
    settingName: string,
    value: unknown,
    scope: string,
    effectiveValue: unknown,
  ): boolean {
    const inspection = this.workspace.inspectConfiguration(configurationId, settingName);

    if (!inspection) {
      return false;
    }

    // Step 1 (ADR-1): if the LS-resolved effective value is known, use it as the sole baseline.
    // Skip only when the proposed value is redundant versus the effective resolution.
    // The package.json schema default is NEVER the skip baseline for LS-resolved keys.
    if (effectiveValue !== EFFECTIVE_VALUE_UNKNOWN) {
      return _.isEqual(value, effectiveValue);
    }

    // Step 2 (ADR-1 fallback): effective value is unknown — use override-aware comparison.
    // NEVER skip solely because value equals the schema default.
    switch (scope) {
      case 'workspace':
        // Skip iff the value is identical to the existing workspace override (and one exists).
        return _.isEqual(value, inspection.workspaceValue) && inspection.workspaceValue !== undefined;
      case 'user':
        // Skip iff the value is identical to the existing user-global override (and one exists).
        return _.isEqual(value, inspection.globalValue) && inspection.globalValue !== undefined;
      case 'workspaceFolder':
        // Defense-in-depth: mirror the workspace/user override-aware pattern for folder scope.
        return _.isEqual(value, inspection.workspaceFolderValue) && inspection.workspaceFolderValue !== undefined;
      default:
        // 'default' scope (no override at any level) or any unrecognised scope:
        // a write at this point is a genuine change — never skip on schema-default equality.
        return false;
    }
  }
}
