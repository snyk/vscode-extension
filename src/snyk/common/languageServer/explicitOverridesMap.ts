import type * as vscode from 'vscode';
import { MEMENTO_EXPLICIT_OVERRIDES_MAP } from '../constants/explicitLspConfiguration';
import type { ILog } from '../logger/interfaces';

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

  /** Set while a persist is queued but not yet started, so rapid set calls collapse to one write. */
  private persistQueued = false;

  constructor(private readonly globalState: vscode.Memento, private readonly logger?: Pick<ILog, 'error'>) {
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
    if (this.persistQueued) {
      return;
    }
    this.persistQueued = true;
    this.writeQueue = this.writeQueue
      .then(() => {
        // Cleared before the update, not after: a mutation landing while this write is in
        // flight is not covered by the snapshot below and must queue its own write.
        this.persistQueued = false;
        return this.globalState.update(MEMENTO_EXPLICIT_OVERRIDES_MAP, Object.fromEntries(this.entries));
      })
      .catch((error: unknown) => {
        // Tail-position, so it both keeps the serialized queue alive for the next write and
        // stops a trailing rejection from surfacing as an unhandled rejection.
        // ponytail: logged, not reverted — persist() writes the whole map, so the next
        // successful write heals the divergence. Reverting `entries` would drop a real user
        // override to match a disk state we failed to write.
        this.logger?.error(`Failed to persist explicit overrides map: ${String(error)}`);
      });
  }
}
