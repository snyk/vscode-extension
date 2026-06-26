import type * as vscode from 'vscode';
import { MEMENTO_EXPLICIT_LSP_CONFIGURATION_LS_KEYS } from '../constants/explicitLspConfiguration';

export interface IExplicitLspConfigurationChangeTracker {
  markExplicitlyChanged(lsKey: string): void;

  unmarkExplicitlyChanged(lsKey: string): void;

  isExplicitlyChanged(lsKey: string): boolean;

  /**
   * Records that a global-reset was triggered from the dialog so the next outbound
   * pull to the LS emits `{ value: null, changed: true }` for this key.
   *
   * Also clears `committedSinceReset` for this key: a newly-queued reset supersedes
   * any prior user edit that was recorded in the windowed signal for the same key.
   */
  markPendingReset(lsKey: string): void;

  /**
   * Returns the current set of pending-reset LS keys and clears it, so the reset
   * is emitted exactly once on the next pull.
   */
  consumePendingResets(): Set<string>;

  // ── ADR-2: transient, windowed, per-LS-key "committed-since-reset" signal ──

  /**
   * Marks that the user committed a concrete value for `lsKey` in this session
   * window (since the last `markPendingReset` call for that key).
   *
   * Called by the fan-out path only for LS keys whose concrete value actually
   * changed (value-compared), not blindly for all siblings.
   *
   * NOT persisted to Memento — starts empty on every construction.
   */
  markCommittedSinceReset(lsKey: string): void;

  /**
   * Returns true iff the user committed a concrete value for `lsKey` since the
   * last `markPendingReset` call for that key.
   *
   * The signal is cleared by `markPendingReset` (not by `consumePendingResets`):
   * a freshly-queued reset supersedes any prior concrete user edit for the same key.
   *
   * This is the signal the re-enqueue guard reads (ADR-2).  Never reads the
   * cumulative `isExplicitlyChanged` set.
   */
  committedSinceReset(lsKey: string): boolean;

  // ── ADR-2: last-known sub-key value cache (for fan-out comparison) ─────────

  /**
   * Returns true iff `setLastKnownValue` has been called for `lsKey` (regardless of the
   * stored value).  Uses Map.has so it correctly distinguishes "never seen" (cold cache)
   * from "seen and stored undefined" (warm cache after a reset or a legitimately-undefined
   * value such as issueViewOptions sub-keys).
   *
   * This is the key to fixing the cold-cache ambiguity (Defect 2): `getLastKnownValue`
   * returns undefined for BOTH cases, so the fan-out guard must use `hasLastKnownValue`
   * to decide whether the cache is warm before calling `isEqual`.
   */
  hasLastKnownValue(lsKey: string): boolean;

  /**
   * Returns the last cached value for `lsKey`, or `undefined` if not yet seen.
   *
   * Used by `markExplicitLsKeysFromConfigurationChangeEvent` to compare the new
   * sub-key value against the prior value for shared-setting fan-out groups (e.g.
   * four `severity_filter_*` keys that share `snyk.severity`).  A sibling whose
   * sub-key value did not change is NOT marked in the windowed `committedSinceReset`
   * signal, even though the shared VS Code setting fired `onDidChangeConfiguration`.
   */
  getLastKnownValue(lsKey: string): unknown;

  /**
   * Updates the cached value for `lsKey` to `value`.
   *
   * Called by `markExplicitLsKeysFromConfigurationChangeEvent` after reading each
   * sub-key's new value, so the next event can compare against it.
   *
   * NOT persisted to Memento — cache starts empty on construction.
   */
  setLastKnownValue(lsKey: string, value: unknown): void;
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

  /**
   * ADR-2: Transient, in-memory, per-LS-key "committed-since-reset" signal.
   * NOT persisted to Memento.  Empty at construction even if `keys` is non-empty.
   *
   * Set only on a genuine concrete user edit (via `markCommittedSinceReset`).
   * Cleared for a key when `markPendingReset` is called for that key (not by
   * `consumePendingResets` — the drain does not reset this signal).
   * Read per-key by the re-enqueue guard (`committedSinceReset`).
   *
   * Semantics: "did the user commit a concrete value for this LS key since the last
   * markPendingReset call for that key?" — a transient, windowed, per-key question
   * that the cumulative `keys` set cannot answer correctly (it is persistent,
   * cross-session, and fanned-out across shared VS Code settings).
   */
  private readonly committedSinceResetSet = new Set<string>();

  /**
   * ADR-2: Transient cache of the last-known resolved value per LS key.
   * NOT persisted to Memento.  Used by the fan-out marking logic to determine
   * which sibling sub-keys actually changed when a shared VS Code setting fires
   * `onDidChangeConfiguration` (e.g. four severity_filter_* keys sharing snyk.severity).
   * A sibling whose value did not change is not marked in the windowed signal.
   */
  private readonly lastKnownValues = new Map<string, unknown>();

  /** Serializes Memento writes so rapid mark/unmark calls don't race at disk level. */
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly globalState: vscode.Memento) {
    const stored = globalState.get<string[]>(MEMENTO_EXPLICIT_LSP_CONFIGURATION_LS_KEYS) ?? [];
    for (const k of stored) {
      this.keys.add(k);
    }
    // committedSinceResetSet intentionally starts empty — not loaded from Memento.
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
    // ADR-2: A freshly-queued reset supersedes any prior concrete user edit for this key.
    // Clear the windowed signal so the re-enqueue guard does not incorrectly suppress
    // re-delivery when fromConfiguration rejects after draining this key.
    this.committedSinceResetSet.delete(lsKey);
  }

  consumePendingResets(): Set<string> {
    const snap = new Set(this.pendingResets);
    this.pendingResets.clear();
    return snap;
  }

  // ── ADR-2: committedSinceReset signal ─────────────────────────────────────

  markCommittedSinceReset(lsKey: string): void {
    this.committedSinceResetSet.add(lsKey);
  }

  committedSinceReset(lsKey: string): boolean {
    return this.committedSinceResetSet.has(lsKey);
  }

  hasLastKnownValue(lsKey: string): boolean {
    return this.lastKnownValues.has(lsKey);
  }

  getLastKnownValue(lsKey: string): unknown {
    return this.lastKnownValues.get(lsKey);
  }

  setLastKnownValue(lsKey: string, value: unknown): void {
    this.lastKnownValues.set(lsKey, value);
  }

  /** @internal Tests only */
  clearForTests(): void {
    this.keys.clear();
    this.pendingResets.clear();
    this.committedSinceResetSet.clear();
    this.lastKnownValues.clear();
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
