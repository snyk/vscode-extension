import type * as vscode from 'vscode';
import { MEMENTO_EXPLICIT_OVERRIDES_MAP } from '../constants/explicitLspConfiguration';

/**
 * Either a concrete value the user explicitly set for an LS key, or a reset sentinel
 * queued for delivery to the language server as `{ value: null, changed: true }`.
 */
type ExplicitOverrideEntry = { readonly kind: 'value'; readonly value: unknown } | { readonly kind: 'reset' };

export interface IExplicitOverridesMap {
  /** Records that the user explicitly set `lsKey` to `value`. Overwrites any pending reset. */
  setExplicitValue(lsKey: string, value: unknown): void;

  /** Queues a reset sentinel for `lsKey`. Overwrites any prior concrete value. */
  setReset(lsKey: string): void;

  /** Returns the current entry for `lsKey`, or `undefined` if never set. */
  getEntry(lsKey: string): ExplicitOverrideEntry | undefined;

  /**
   * Clears the reset sentinel for `lsKey`, but only if the current entry is still a
   * reset — i.e. only once the reset has actually been confirmed delivered. A concrete
   * value entry (written by a user edit that superseded the reset) is left untouched.
   */
  confirmResetDelivered(lsKey: string): void;
}

/**
 * Persisted map from LS key to either a concrete explicit value or a reset sentinel.
 * Single source of truth for `ConfigSetting.changed`/`value` on outbound LS config.
 */
export class ExplicitOverridesMap implements IExplicitOverridesMap {
  private readonly entries = new Map<string, ExplicitOverrideEntry>();

  /** Serializes Memento writes so rapid set calls don't race at disk level. */
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly globalState: vscode.Memento) {
    const stored = globalState.get<Record<string, ExplicitOverrideEntry>>(MEMENTO_EXPLICIT_OVERRIDES_MAP) ?? {};
    for (const [lsKey, entry] of Object.entries(stored)) {
      this.entries.set(lsKey, entry);
    }
  }

  setExplicitValue(lsKey: string, value: unknown): void {
    this.entries.set(lsKey, { kind: 'value', value });
    this.persist();
  }

  setReset(lsKey: string): void {
    this.entries.set(lsKey, { kind: 'reset' });
    this.persist();
  }

  getEntry(lsKey: string): ExplicitOverrideEntry | undefined {
    return this.entries.get(lsKey);
  }

  confirmResetDelivered(lsKey: string): void {
    if (this.entries.get(lsKey)?.kind !== 'reset') {
      return;
    }
    this.entries.delete(lsKey);
    this.persist();
  }

  private persist(): void {
    const snapshot = Object.fromEntries(this.entries);
    this.writeQueue = this.writeQueue
      .catch(() => {
        /* keep queue alive on prior failure */
      })
      .then(() => this.globalState.update(MEMENTO_EXPLICIT_OVERRIDES_MAP, snapshot));
  }
}
