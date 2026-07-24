/**
 * Unit tests for ExplicitLspConfigurationChangeTracker: the cumulative, persisted
 * "has the user explicitly overridden this LS key" set that drives ConfigSetting.changed
 * on outbound LS config.
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
  test('markExplicitlyChanged then isExplicitlyChanged: returns true for that key', () => {
    const tracker = new ExplicitLspConfigurationChangeTracker(makeMemento());
    tracker.markExplicitlyChanged('organization');
    assert.ok(tracker.isExplicitlyChanged('organization'));
  });

  test('isExplicitlyChanged returns false for a key that was never marked', () => {
    const tracker = new ExplicitLspConfigurationChangeTracker(makeMemento());
    assert.ok(!tracker.isExplicitlyChanged('organization'));
  });

  test('unmarkExplicitlyChanged clears a previously marked key', () => {
    const tracker = new ExplicitLspConfigurationChangeTracker(makeMemento());
    tracker.markExplicitlyChanged('organization');
    tracker.unmarkExplicitlyChanged('organization');
    assert.ok(!tracker.isExplicitlyChanged('organization'));
  });

  test('cross-session: keys persisted at construction are loaded as explicitly changed', () => {
    const memento = makeMemento();
    void memento.update(MEMENTO_EXPLICIT_LSP_CONFIGURATION_LS_KEYS, ['organization']);

    const tracker = new ExplicitLspConfigurationChangeTracker(memento);

    assert.ok(
      tracker.isExplicitlyChanged('organization'),
      'a key persisted in a prior session must be loaded as explicitly changed',
    );
  });
});
