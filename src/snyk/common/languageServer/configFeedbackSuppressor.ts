/**
 * Shared, injectable suppression scope for VS Code `onDidChangeConfiguration` feedback.
 *
 * The listener registered by `LanguageServer.registerExplicitKeyMarkingListener` calls
 * `markExplicitlyChanged`, which (since the round-5 race fix) calls `pendingResets.delete`.
 * This is correct when the user re-edits a key after queuing a reset, but NOT when the
 * listener fires because of the reset's own `updateConfiguration` write.
 *
 * Both the INBOUND path (`runInboundPersistence` in LanguageServer) and the OUTBOUND path
 * (`applyOutboundGlobalResets` in ConfigurationPersistenceService) must suppress the listener
 * while their respective `updateConfiguration` calls are in flight.  This object provides a
 * reference-counted scope so concurrent suppress/restore pairs compose correctly.
 *
 * Usage:
 *   suppressor.begin();   // increment active count
 *   try { await write(); } finally { suppressor.end(); }  // decrement
 *   // listener checks suppressor.isActive before calling markExplicitlyChanged
 */
export interface IConfigFeedbackSuppressor {
  /** True while at least one suppress scope is active. */
  readonly isActive: boolean;
  /** Increment the active scope count. */
  begin(): void;
  /** Decrement the active scope count. */
  end(): void;
}

export class ConfigFeedbackSuppressor implements IConfigFeedbackSuppressor {
  private depth = 0;

  get isActive(): boolean {
    return this.depth > 0;
  }

  begin(): void {
    this.depth++;
  }

  end(): void {
    if (this.depth > 0) {
      this.depth--;
    }
  }
}
