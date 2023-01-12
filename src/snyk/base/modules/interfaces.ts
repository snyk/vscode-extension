import { IWorkspaceTrust } from '../../common/configuration/trustedFolders';
import { IContextService } from '../../common/services/contextService';
import { IOpenerService } from '../../common/services/openerService';
import { IViewManagerService } from '../../common/services/viewManagerService';
import { ExtensionContext } from '../../common/vscode/extensionContext';
import { ExtensionContext as VSCodeExtensionContext } from '../../common/vscode/types';
import { ISnykCodeServiceOld } from '../../snykCode/codeServiceOld';
import { IStatusBarItem } from '../statusBarItem/statusBarItem';
import { ILoadingBadge } from '../views/loadingBadge';

export interface IBaseSnykModule {
  readonly loadingBadge: ILoadingBadge;
  statusBarItem: IStatusBarItem;
  contextService: IContextService;
  openerService: IOpenerService;
  viewManagerService: IViewManagerService;
  snykCodeOld: ISnykCodeServiceOld;
  readonly workspaceTrust: IWorkspaceTrust;

  // Abstract methods
  runScan(): Promise<void>;
  runCodeScan(manual?: boolean): Promise<void>;
  runOssScan(manual?: boolean): Promise<void>;
}

export interface ISnykLib {
  enableCode(): Promise<void>;
  checkAdvancedMode(): Promise<void>;
}

export interface IExtension extends IBaseSnykModule, ISnykLib {
  context: ExtensionContext | undefined;
  activate(context: VSCodeExtensionContext): void;
  restartLanguageServer(): Promise<void>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type errorType = Error | any;
