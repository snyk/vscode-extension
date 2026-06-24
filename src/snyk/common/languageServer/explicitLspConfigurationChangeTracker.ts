import type * as vscode from 'vscode';
import { MEMENTO_EXPLICIT_LSP_CONFIGURATION_LS_KEYS } from '../constants/explicitLspConfiguration';

export interface IExplicitLspConfigurationChangeTracker {
  markExplicitlyChanged(lsKey: string): void;

  unmarkExplicitlyChanged(lsKey: string): void;

  isExplicitlyChanged(lsKey: string): boolean;

  /**
   * Records that a global-reset was triggered from the dialog so the next outbound
   * pull to the LS emits `{ value: null, changed: true }` for this key.
   */
  markPendingReset(lsKey: string): void;

  /**
   * Returns the current set of pending-reset LS keys and clears it, so the reset
   * is emitted exactly once on the next pull.
   */
  consumePendingResets(): Set<string>;
}

/**
 * Persists which LS keys the user has explicitly overridden.
 * Keys are merged into a set; `isExplicitlyChanged` drives `ConfigSetting.changed` on outbound LS config.
 */
export class ExplicitLspConfigurationChangeTracker implements IExplicitLspConfigurationChangeTracker {
  private readonly keys = new Set<string>();
  /**
   * Transient (in-memory only) pending resets — not persisted to Memento.
   * If fromConfiguration throws AFTER consumePendingResets() has drained the set, the
   * transient signal is lost, but this is benign: markPendingReset is only called after
   * the VS Code override clear succeeds (fail-safe ordering in applyOutboundGlobalResets),
   * so the override is already cleared. The next successful pull will emit the resulting
   * default value with changed:false, and the reset is still reflected — no re-enqueue needed.
   */
  private readonly pendingResets = new Set<string>();
  /** Serializes Memento writes so rapid mark/unmark calls don't race at disk level. */
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly globalState: vscode.Memento) {
    const stored = globalState.get<string[]>(MEMENTO_EXPLICIT_LSP_CONFIGURATION_LS_KEYS) ?? [];
    for (const k of stored) {
      this.keys.add(k);
    }
  }

  markExplicitlyChanged(lsKey: string): void {
    // Cancel any pending reset for this key: the user has set a concrete value, so
    // emitting { value: null, changed: true } on the next pull would discard it.
    // This closes the re-edit-after-reset race: reset queues a pending, user re-edits
    // before the pull — the pending is removed so fromConfiguration uses the concrete value.
    this.pendingResets.delete(lsKey);

    if (this.keys.has(lsKey)) {
      return;
    }
    this.keys.add(lsKey);
    this.persistKeys();
  }

  unmarkExplicitlyChanged(lsKey: string): void {
    if (!this.keys.has(lsKey)) {
      return;
    }
    this.keys.delete(lsKey);
    this.persistKeys();
  }

  isExplicitlyChanged(lsKey: string): boolean {
    return this.keys.has(lsKey);
  }

  markPendingReset(lsKey: string): void {
    this.pendingResets.add(lsKey);
  }

  consumePendingResets(): Set<string> {
    const snap = new Set(this.pendingResets);
    this.pendingResets.clear();
    return snap;
  }

  /** @internal Tests only */
  clearForTests(): void {
    this.keys.clear();
    this.pendingResets.clear();
    this.persistKeys();
  }

  private persistKeys(): void {
    const snapshot = [...this.keys];
    this.writeQueue = this.writeQueue
      .catch(() => {
        /* keep queue alive on prior failure */
      })
      .then(() => this.globalState.update(MEMENTO_EXPLICIT_LSP_CONFIGURATION_LS_KEYS, snapshot));
  }
}
