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

    // D2 (superseded, [IDE-2264 ticket 04]): previously exercised markExplicitLsKeysFromConfigu-
    // rationChangeEvent's cold-vs-warm-cache distinction for fan-out siblings via this tracker's
    // hasLastKnownValue/setLastKnownValue. That function no longer reads the tracker at all — it
    // now compares against LastKnownValueCache (ticket 01), which is always seeded at
    // construction for every tracked VS Code key, so the cold-vs-warm-undefined ambiguity this
    // test guarded against cannot occur in the new code path. Coverage for the new comparison
    // lives in explicitLsKeyTracking.test.ts.

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

  // The pendingInboundWrite tag-leak concern formerly documented here (a no-op write's tag
  // never being consumed, swallowing the next genuine edit) is moot for direct-edit detection
  // as of [IDE-2264 ticket 04]: markExplicitLsKeysFromConfigurationChangeEvent no longer reads
  // pendingInboundWrite at all — it compares against LastKnownValueCache instead. The tag
  // itself (markPendingInboundWrite/consumePendingInboundWrite) remains on this tracker only
  // for the inbound-push write path (ticket 08 removes it once that path is also migrated).
});
