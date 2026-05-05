import { FolderConfig } from '../configuration/configuration';
import type { LspConfigurationParam } from './types';

/**
 * Converts inbound `$/snyk.configuration` folder rows into {@link FolderConfig} list.
 * LS is the source of truth — the returned list replaces in-memory state entirely.
 */
export function folderConfigsFromLspParam(param: LspConfigurationParam): FolderConfig[] {
  const incoming = param.folderConfigs;
  if (!incoming || incoming.length === 0) {
    return [];
  }

  return incoming.map(fc => new FolderConfig(fc.folderPath, fc.settings ?? {}));
}
