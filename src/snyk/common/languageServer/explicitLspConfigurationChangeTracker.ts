import type * as vscode from 'vscode';
import { MEMENTO_EXPLICIT_LSP_CONFIGURATION_PFLAGS } from '../constants/explicitLspConfiguration';

export interface IExplicitLspConfigurationChangeTracker {
  markExplicitlyChanged(pflagKey: string): void;

  isExplicitlyChanged(pflagKey: string): boolean;
}

/**
 * Persists which pflag keys the user has explicitly overridden (IntelliJ `explicitChanges` parity).
 * Keys are merged into a set; `isExplicitlyChanged` drives `ConfigSetting.changed` on outbound LS config.
 */
export class ExplicitLspConfigurationChangeTracker implements IExplicitLspConfigurationChangeTracker {
  private readonly keys = new Set<string>();

  constructor(private readonly globalState: vscode.Memento) {
    const stored = globalState.get<string[]>(MEMENTO_EXPLICIT_LSP_CONFIGURATION_PFLAGS) ?? [];
    for (const k of stored) {
      this.keys.add(k);
    }
  }

  markExplicitlyChanged(pflagKey: string): void {
    if (this.keys.has(pflagKey)) {
      return;
    }
    this.keys.add(pflagKey);
    void this.globalState.update(MEMENTO_EXPLICIT_LSP_CONFIGURATION_PFLAGS, [...this.keys]);
  }

  isExplicitlyChanged(pflagKey: string): boolean {
    return this.keys.has(pflagKey);
  }

  /** @internal Tests only */
  clearForTests(): void {
    this.keys.clear();
    void this.globalState.update(MEMENTO_EXPLICIT_LSP_CONFIGURATION_PFLAGS, []);
  }
}
