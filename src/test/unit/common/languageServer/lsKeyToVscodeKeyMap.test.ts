// ABOUTME: Unit tests for lsKeyToVscodeKeyMap — registry invariants and drift guards
import assert from 'assert';
import {
  GLOBAL_RESET_FIELDS,
  lsKeyToVscodeKey,
  mapLspSettingsToVscodeSettings,
} from '../../../../snyk/common/languageServer/lsKeyToVscodeKeyMap';
import { ADVANCED_CLI_BASE_DOWNLOAD_URL, ADVANCED_CLI_PATH } from '../../../../snyk/common/constants/settings';
import { LS_GLOBAL_KEY } from '../../../../snyk/common/languageServer/serverSettingsToLspConfigurationParam';

// ── Fix 1: GLOBAL_RESET_FIELDS drift guard ──────────────────────────────────
//
// GLOBAL_RESET_FIELDS is a hand-maintained Set. If a key is added to it without
// a corresponding SETTINGS_REGISTRY entry that has a defined vscodeKey, both the
// inbound (applyGlobalResets) and outbound (applyOutboundGlobalResets) reset paths
// throw an invariant Error rather than silently skipping the key.
//
// This test asserts that lsKeyToVscodeKey(member) is defined for every member of
// GLOBAL_RESET_FIELDS, making drift loud rather than silent.
suite('GLOBAL_RESET_FIELDS — drift guard (lsKeyToVscodeKeyMap)', () => {
  test('every GLOBAL_RESET_FIELDS member maps to a defined vscodeKey via lsKeyToVscodeKey', () => {
    for (const lsKey of GLOBAL_RESET_FIELDS) {
      const vscodeKey = lsKeyToVscodeKey(lsKey);
      assert.ok(
        vscodeKey !== undefined,
        `GLOBAL_RESET_FIELDS member '${lsKey}' has no vscodeKey in SETTINGS_REGISTRY — ` +
          `lsKeyToVscodeKey('${lsKey}') returned undefined. ` +
          `Only keys with a defined vscodeKey (user-visible, persistable fields) are resettable. ` +
          `Either add a vscodeKey entry for '${lsKey}' in SETTINGS_REGISTRY or remove it from GLOBAL_RESET_FIELDS.`,
      );
    }
  });
});

// ── Inbound blank-value guard (skipBlankInbound) ────────────────────────────
//
// The LS occasionally echoes a blank binary_base_url. Persisting a blank to
// snyk.advanced.cliBaseDownloadUrl corrupts the setting: downstream URL assembly
// (staticCliApi) concatenates it into hostless paths like `/cli/stable/...`, the
// CLI download fails, and the Language Server never starts. mapLspSettingsToVscodeSettings
// must skip blank values for keys marked skipBlankInbound. This complements the outbound
// guard in Configuration.setCliBaseDownloadUrl (which rejects empty strings); the inbound
// guard is stricter — it also treats whitespace-only as blank.
suite('mapLspSettingsToVscodeSettings — blank binary_base_url guard', () => {
  test('skips a blank binary_base_url (does not persist it)', () => {
    const result = mapLspSettingsToVscodeSettings({ [LS_GLOBAL_KEY.binaryBaseUrl]: { value: '' } });
    assert.ok(
      !(ADVANCED_CLI_BASE_DOWNLOAD_URL in result),
      'blank binary_base_url must not be written to VS Code settings',
    );
  });

  test('skips a whitespace-only binary_base_url', () => {
    const result = mapLspSettingsToVscodeSettings({ [LS_GLOBAL_KEY.binaryBaseUrl]: { value: '   ' } });
    assert.ok(
      !(ADVANCED_CLI_BASE_DOWNLOAD_URL in result),
      'whitespace-only binary_base_url must not be written to VS Code settings',
    );
  });

  test('writes a non-blank binary_base_url', () => {
    const url = 'https://downloads.snyk.io';
    const result = mapLspSettingsToVscodeSettings({ [LS_GLOBAL_KEY.binaryBaseUrl]: { value: url } });
    assert.strictEqual(result[ADVANCED_CLI_BASE_DOWNLOAD_URL], url);
  });

  // Scope guard: the blank-skip must apply ONLY to skipBlankInbound-flagged keys. cli_path is not
  // flagged — a blank cli_path is a meaningful "use the managed binary", so it must still be
  // written. This locks the deliberate scoping so a future refactor cannot globalize the skip.
  test('does NOT skip a blank cli_path (only skipBlankInbound keys are guarded)', () => {
    const result = mapLspSettingsToVscodeSettings({ [LS_GLOBAL_KEY.cliPath]: { value: '' } });
    assert.strictEqual(result[ADVANCED_CLI_PATH], '');
  });
});
