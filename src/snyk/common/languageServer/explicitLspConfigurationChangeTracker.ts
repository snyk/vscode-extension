import type * as vscode from 'vscode';
import { MEMENTO_EXPLICIT_LSP_CONFIGURATION_LS_KEYS } from '../constants/explicitLspConfiguration';

export interface IExplicitLspConfigurationChangeTracker {
  markExplicitlyChanged(lsKey: string): void;

  isExplicitlyChanged(lsKey: string): boolean;
}

/**
 * Persists which LS keys the user has explicitly overridden.
 * Keys are merged into a set; `isExplicitlyChanged` drives `ConfigSetting.changed` on outbound LS config.
 */
export class ExplicitLspConfigurationChangeTracker implements IExplicitLspConfigurationChangeTracker {
  private readonly keys = new Set<string>();

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
    void this.globalState.update(MEMENTO_EXPLICIT_LSP_CONFIGURATION_LS_KEYS, [...this.keys]);
  }

  isExplicitlyChanged(lsKey: string): boolean {
    return this.keys.has(lsKey);
  }

  /** @internal Tests only */
  clearForTests(): void {
    this.keys.clear();
    void this.globalState.update(MEMENTO_EXPLICIT_LSP_CONFIGURATION_LS_KEYS, []);
  }
}
