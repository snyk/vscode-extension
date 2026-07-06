/**
 * Unit tests for ExplicitLspConfigurationChangeTracker.
 *
 * Includes a regression test for the pending-reset cancellation race:
 * if a user triggers a global reset (markPendingReset) and then immediately
 * re-edits the same key to a concrete value (markExplicitlyChanged), the
 * pending reset must be cancelled so the next pull does NOT emit
 * { value: null, changed: true } over the user's fresh concrete value.
 *
 * Also includes tests for the ADR-2 "committed-since-drain" transient signal
 * (committedSinceReset / markCommittedSinceReset / hasLastKnownValue).
 */
import assert from 'assert';
import { ExplicitLspConfigurationChangeTracker } from '../../../../snyk/common/languageServer/explicitLspConfigurationChangeTracker';
import { MEMENTO_EXPLICIT_LSP_CONFIGURATION_LS_KEYS } from '../../../../snyk/common/constants/explicitLspConfiguration';
import { markExplicitLsKeysFromConfigurationChangeEvent } from '../../../../snyk/common/languageServer/explicitLsKeyTracking';
import { LS_GLOBAL_KEY } from '../../../../snyk/common/languageServer/serverSettingsToLspConfigurationParam';

/** Minimal in-memory Memento that satisfies the interface used by the tracker. */
function makeMemento(): import('vscode').Memento {
  const store = new Map<string, unknown>();
  return {
    get<T>(key: string, defaultValue?: T): T {
      return (store.has(key) ? store.get(key) : defaultValue) as T;
    },
    update(key: string, value: unknown): Thenable<void> {
      store.set(key, value);
      return Promise.resolve();
    },
    // vscode.Memento also declares `keys()` in newer VS Code types; provide a no-op.
    keys(): readonly string[] {
      return [...store.keys()];
    },
  };
}

suite('ExplicitLspConfigurationChangeTracker', () => {
  suite('markExplicitlyChanged cancels a pending reset for the same key (race fix)', () => {
    test('markPendingReset then markExplicitlyChanged: consumePendingResets does NOT return the key', () => {
      const tracker = new ExplicitLspConfigurationChangeTracker(makeMemento());

      // Simulate: user clicked "Reset" → outbound reset marks key as pending.
      tracker.markPendingReset('organization');

      // Simulate: before the LS pull, user re-edits 'organization' to a concrete value.
      // markExplicitlyChanged should cancel the pending reset so the stale null is NOT emitted.
      tracker.markExplicitlyChanged('organization');

      const pending = tracker.consumePendingResets();

      assert.ok(
        !pending.has('organization'),
        'markExplicitlyChanged must cancel the pending reset for the same key — ' +
          "otherwise the next pull emits { value: null } over the user's fresh concrete value",
      );
    });

    test('markPendingReset without subsequent markExplicitlyChanged: consumePendingResets still returns the key', () => {
      const tracker = new ExplicitLspConfigurationChangeTracker(makeMemento());

      tracker.markPendingReset('organization');

      const pending = tracker.consumePendingResets();

      assert.ok(
        pending.has('organization'),
        'consumePendingResets must still return the key when markExplicitlyChanged was NOT called after the reset',
      );
    });

    test('unmarkExplicitlyChanged does NOT cancel a pending reset', () => {
      const tracker = new ExplicitLspConfigurationChangeTracker(makeMemento());

      tracker.markPendingReset('organization');
      // unmark is called by applyOutboundGlobalResets BEFORE the key is re-edited;
      // it must not cancel the pending reset.
      tracker.unmarkExplicitlyChanged('organization');

      const pending = tracker.consumePendingResets();

      assert.ok(
        pending.has('organization'),
        'unmarkExplicitlyChanged must NOT cancel the pending reset — only markExplicitlyChanged (re-edit) should do so',
      );
    });

    test('markExplicitlyChanged for a different key does not cancel the pending reset', () => {
      const tracker = new ExplicitLspConfigurationChangeTracker(makeMemento());

      tracker.markPendingReset('organization');
      tracker.markExplicitlyChanged('api_endpoint'); // different key

      const pending = tracker.consumePendingResets();

      assert.ok(
        pending.has('organization'),
        'editing a different key must not cancel the pending reset for organization',
      );
    });
  });

  // ── ADR-2: committedSinceReset — transient, windowed, per-LS-key signal ─────
  suite('committedSinceReset signal (ADR-2)', () => {
    test('markCommittedSinceReset then committedSinceReset: returns true for that key', () => {
      const tracker = new ExplicitLspConfigurationChangeTracker(makeMemento());

      tracker.markCommittedSinceReset('organization');

      assert.ok(
        tracker.committedSinceReset('organization'),
        'committedSinceReset must return true after markCommittedSinceReset for the same key',
      );
    });

    test('committedSinceReset returns false for an unmarked key', () => {
      const tracker = new ExplicitLspConfigurationChangeTracker(makeMemento());

      assert.ok(
        !tracker.committedSinceReset('organization'),
        'committedSinceReset must return false for a key that was never marked',
      );
    });

    test('markPendingReset clears committedSinceReset for that key', () => {
      const tracker = new ExplicitLspConfigurationChangeTracker(makeMemento());

      tracker.markCommittedSinceReset('organization');
      assert.ok(tracker.committedSinceReset('organization'), 'precondition: should be set');

      tracker.markPendingReset('organization');

      assert.ok(
        !tracker.committedSinceReset('organization'),
        'markPendingReset must clear committedSinceReset for that key — ' +
          'the reset supersedes the prior user edit for this window',
      );
    });

    test('markCommittedSinceReset for key A does not affect key B', () => {
      const tracker = new ExplicitLspConfigurationChangeTracker(makeMemento());

      tracker.markCommittedSinceReset('severity_filter_low');

      assert.ok(
        !tracker.committedSinceReset('severity_filter_high'),
        'marking severity_filter_low must not affect severity_filter_high',
      );
    });

    // Defect 2: regression test — a second fan-out event for a key whose value is legitimately
    // undefined must NOT mark committedSinceReset.
    //
    // This test exercises the REAL production guard in
    // markExplicitLsKeysFromConfigurationChangeEvent (which uses lodash isEqual, not reference
    // equality), so any change to the guard logic is caught here rather than by an inline
    // reimplementation that could drift from production.
    //
    // Scenario: severity_filter_critical is pre-seeded to undefined (warm cache — e.g. after a
    // reset seed).  A second fan-out event fires for snyk.severity.  The resolver returns
    // undefined for critical again (value unchanged).  With the production guard
    // (cacheWasCold = !hasLastKnownValue → false; isEqual(undefined, undefined) → true) the
    // windowed signal must NOT be marked.
    test('D2: second fan-out event with unchanged undefined value does NOT mark committedSinceReset', () => {
      const tracker = new ExplicitLspConfigurationChangeTracker(makeMemento());

      // Pre-seed the tracker: warm cache for severity_filter_critical with value undefined
      // (simulates what applyOutboundGlobalResets does after a reset seed for this key).
      tracker.setLastKnownValue(LS_GLOBAL_KEY.severityFilterCritical, undefined);

      // Verify the cache is warm (hasLastKnownValue = true) even though the stored value is undefined.
      assert.ok(
        tracker.hasLastKnownValue(LS_GLOBAL_KEY.severityFilterCritical),
        'D2 precondition: hasLastKnownValue must return true after setLastKnownValue was called — ' +
          'even when the stored value is undefined (warm-cache-undefined vs cold-cache-undefined)',
      );

      // Fake event: snyk.severity fired (shared key for all four severity_filter_* keys).
      const SEVERITY_VSCODE_KEY = 'snyk.severity';
      const fakeEvent = {
        affectsConfiguration(key: string): boolean {
          return key === SEVERITY_VSCODE_KEY;
        },
      };

      // Resolver: critical returns undefined (unchanged), siblings return true (different to
      // ensure the fan-out branch is taken with currentValueOf provided).
      const currentValues: Record<string, unknown> = {
        [LS_GLOBAL_KEY.severityFilterCritical]: undefined, // unchanged — warm cache
        [LS_GLOBAL_KEY.severityFilterHigh]: true,
        [LS_GLOBAL_KEY.severityFilterMedium]: true,
        [LS_GLOBAL_KEY.severityFilterLow]: true,
      };

      // Call the REAL production guard — not an inline reimplementation.
      markExplicitLsKeysFromConfigurationChangeEvent(fakeEvent, tracker, lsKey => currentValues[lsKey]);

      // The production guard: cacheWasCold (Map.has snapshot = false → warm) → skip mark
      // when isEqual(undefined, undefined) = true. committedSinceReset must remain false.
      assert.ok(
        !tracker.committedSinceReset(LS_GLOBAL_KEY.severityFilterCritical),
        'D2: severity_filter_critical must NOT be marked committedSinceReset on a second fan-out ' +
          'event when the cached value is warm-undefined and the new value is also undefined ' +
          '— the production guard (hasLastKnownValue + isEqual) must distinguish warm-cache-undefined ' +
          'from cold-cache-undefined. FAIL here means the guard uses reference equality or Map.get ' +
          'instead of Map.has, reverting the Defect 2 fix.',
      );
    });

    // D2b: hasLastKnownValue returns false before setLastKnownValue is called (cold cache).
    test('D2b: hasLastKnownValue returns false for a key that was never set', () => {
      const tracker = new ExplicitLspConfigurationChangeTracker(makeMemento());
      assert.ok(
        !tracker.hasLastKnownValue('severity_filter_critical'),
        'hasLastKnownValue must return false before setLastKnownValue is called',
      );
    });

    // Cross-session test: a key in the persisted cumulative `keys` set at construction
    // must NOT read as committed-since-drain. The windowed signal is transient (in-memory only).
    test('cross-session: key in persisted keys set at construction does NOT read as committedSinceReset', () => {
      // Build a Memento that already has 'organization' in the persisted keys set,
      // as if it was explicitly changed in a prior session.
      const memento = makeMemento();
      // Pre-populate the persisted set (what the tracker stores under MEMENTO_EXPLICIT_LSP_CONFIGURATION_LS_KEYS)
      void memento.update(MEMENTO_EXPLICIT_LSP_CONFIGURATION_LS_KEYS, ['organization']);

      // Construct a fresh tracker — it loads the persisted keys set.
      const tracker = new ExplicitLspConfigurationChangeTracker(memento);

      // isExplicitlyChanged should return true (loaded from persistence)
      assert.ok(
        tracker.isExplicitlyChanged('organization'),
        'precondition: organization should be in the cumulative keys set from prior session',
      );

      // committedSinceReset must return false — it is transient and starts empty.
      assert.ok(
        !tracker.committedSinceReset('organization'),
        'committedSinceReset must be false at construction even if the key is in the persisted keys set — ' +
          'the windowed signal is transient and must not carry across sessions',
      );
    });
  });
});
