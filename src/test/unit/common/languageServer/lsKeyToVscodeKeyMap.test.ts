// ABOUTME: Unit tests for lsKeyToVscodeKeyMap — registry invariants and drift guards
import assert from 'assert';
import { GLOBAL_RESET_FIELDS, lsKeyToVscodeKey } from '../../../../snyk/common/languageServer/lsKeyToVscodeKeyMap';

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
