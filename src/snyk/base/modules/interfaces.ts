import { IWorkspaceTrust } from '../../common/configuration/trustedFolders';
import { IContextService } from '../../common/services/contextService';
import { DownloadService } from '../../common/services/downloadService';
import { IOpenerService } from '../../common/services/openerService';
import { IViewManagerService } from '../../common/services/viewManagerService';
import { ExtensionContext } from '../../common/vscode/extensionContext';
import { ExtensionContext as VSCodeExtensionContext } from '../../common/vscode/types';
import { IStatusBarItem } from '../statusBarItem/statusBarItem';
import { ILoadingBadge } from '../views/loadingBadge';

export interface IBaseSnykModule {
  readonly loadingBadge: ILoadingBadge;
  statusBarItem: IStatusBarItem;
  contextService: IContextService;
  openerService: IOpenerService;
  viewManagerService: IViewManagerService;
  readonly workspaceTrust: IWorkspaceTrust;

  // Abstract methods
  runScan(): Promise<void>;
}

export interface ISnykLib {
  enableCode(): Promise<void>;
  checkAdvancedMode(): Promise<void>;
  setupFeatureFlags(): Promise<void>;
}

export interface IExtension extends IBaseSnykModule, ISnykLib {
  context: ExtensionContext | undefined;
  activate(context: VSCodeExtensionContext): void;
  stopLanguageServer(): Promise<void>;
  restartLanguageServer(): Promise<void>;
  initDependencyDownload(): DownloadService;
}
