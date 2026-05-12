import type * as vscode from 'vscode';
import { MEMENTO_EXPLICIT_LSP_CONFIGURATION_LS_KEYS } from '../constants/explicitLspConfiguration';

export interface IExplicitLspConfigurationChangeTracker {
  markExplicitlyChanged(lsKey: string): void;

  unmarkExplicitlyChanged(lsKey: string): void;

  isExplicitlyChanged(lsKey: string): boolean;
}

/**
 * Persists which LS keys the user has explicitly overridden.
 * Keys are merged into a set; `isExplicitlyChanged` drives `ConfigSetting.changed` on outbound LS config.
 */
export class ExplicitLspConfigurationChangeTracker implements IExplicitLspConfigurationChangeTracker {
  private readonly keys = new Set<string>();
  /** Serializes Memento writes so rapid mark/unmark calls don't race at disk level. */
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly globalState: vscode.Memento) {
    const stored = globalState.get<string[]>(MEMENTO_EXPLICIT_LSP_CONFIGURATION_LS_KEYS) ?? [];
    for (const k of stored) {
      this.keys.add(k);
    }
  }

  markExplicitlyChanged(lsKey: string): void {
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

  /** @internal Tests only */
  clearForTests(): void {
    this.keys.clear();
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
