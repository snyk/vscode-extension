import { Configuration } from '../configuration/configuration';
import type { IVSCodeWorkspace } from '../vscode/workspace';

export interface ILastKnownValueCache {
  /** Returns the cached value for `vscodeKey`, or `undefined` if never seeded or set. */
  get(vscodeKey: string): unknown;

  /** Updates the cached value for `vscodeKey` to `value`. */
  set(vscodeKey: string, value: unknown): void;
}

/**
 * Non-persisted cache mapping each VS Code configuration key to the value the extension
 * itself most recently wrote for it (or observed at activation). Seeded once at construction
 * from current VS Code configuration for every tracked key.
 *
 * Purpose: comparing a key's current VS Code value against its cache entry tells apart a write
 * the extension itself just made from a genuine external edit, so callers (config-change
 * marking, middleware echo suppression) can early-return on the former instead of treating it
 * as a new user change.
 */
export class LastKnownValueCache implements ILastKnownValueCache {
  private readonly values = new Map<string, unknown>();

  constructor(workspace: Pick<IVSCodeWorkspace, 'getConfiguration'>, trackedVscodeKeys: readonly string[]) {
    for (const vscodeKey of trackedVscodeKeys) {
      const { configurationId, section } = Configuration.getConfigName(vscodeKey);
      this.values.set(vscodeKey, workspace.getConfiguration(configurationId, section));
    }
  }

  get(vscodeKey: string): unknown {
    return this.values.get(vscodeKey);
  }

  set(vscodeKey: string, value: unknown): void {
    this.values.set(vscodeKey, value);
  }
}
