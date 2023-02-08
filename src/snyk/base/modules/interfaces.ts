import { IWorkspaceTrust } from '../../common/configuration/trustedFolders';
import { IContextService } from '../../common/services/contextService';
import { IViewManagerService } from '../../common/services/viewManagerService';
import { ExtensionContext } from '../../common/vscode/extensionContext';
import { ExtensionContext as VSCodeExtensionContext } from '../../common/vscode/types';
import { IStatusBarItem } from '../statusBarItem/statusBarItem';
import { ILoadingBadge } from '../views/loadingBadge';

export interface IBaseSnykModule {
  readonly loadingBadge: ILoadingBadge;
  statusBarItem: IStatusBarItem;
  contextService: IContextService;
  viewManagerService: IViewManagerService;
  readonly workspaceTrust: IWorkspaceTrust;

  // Abstract methods
  runScan(): Promise<void>;
  runOssScan(manual?: boolean): Promise<void>;
}

export interface IExtension extends IBaseSnykModule {
  context: ExtensionContext | undefined;
  activate(context: VSCodeExtensionContext): void;
  restartLanguageServer(): Promise<void>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type errorType = Error | any;
