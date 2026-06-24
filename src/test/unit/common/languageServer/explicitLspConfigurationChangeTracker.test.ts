/**
 * Unit tests for ExplicitLspConfigurationChangeTracker.
 *
 * Includes a regression test for the pending-reset cancellation race:
 * if a user triggers a global reset (markPendingReset) and then immediately
 * re-edits the same key to a concrete value (markExplicitlyChanged), the
 * pending reset must be cancelled so the next pull does NOT emit
 * { value: null, changed: true } over the user's fresh concrete value.
 */
import assert from 'assert';
import { ExplicitLspConfigurationChangeTracker } from '../../../../snyk/common/languageServer/explicitLspConfigurationChangeTracker';

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
});
