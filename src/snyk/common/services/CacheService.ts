import { IVSCodeCommands } from '../vscode/commands';
import { SNYK_CLEAR_CACHE_COMMAND } from '../constants/commands';

export interface IClearCacheService {
  clearCache(folderUri?: string, cacheType?: string): Promise<void>;
}

export class ClearCacheService implements IClearCacheService {
  constructor(private commandExecutor: IVSCodeCommands) {}

  async clearCache(folderUri?: string, cacheType?: string): Promise<void> {
    try {
      const uri = folderUri || '';
      const type = cacheType || '';
      await this.commandExecutor.executeCommand(SNYK_CLEAR_CACHE_COMMAND, uri, type);
    } catch (error) {
      console.warn(`[ClearCacheService] Failed to clear cache`);
    }
  }
}
