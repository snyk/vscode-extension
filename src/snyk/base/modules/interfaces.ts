import * as vscode from 'vscode';
import { IContextService } from '../../common/services/contextService';
import { IOpenerService } from '../../common/services/openerService';
import { IViewManagerService } from '../../common/services/viewManagerService';
import { ExtensionContext } from '../../common/vscode/extensionContext';
import { IWatcher } from '../../common/watchers/interfaces';
import { ISnykCodeService } from '../../snykCode/codeService';
import { IStatusBarItem } from '../statusBarItem/statusBarItem';
import { ILoadingBadge } from '../views/loadingBadge';

export interface IBaseSnykModule {
  readonly loadingBadge: ILoadingBadge;
  statusBarItem: IStatusBarItem;
  contextService: IContextService;
  openerService: IOpenerService;
  viewManagerService: IViewManagerService;
  snykCode: ISnykCodeService;

  // Abstract methods
  processError(error: errorType, options?: { [key: string]: any }): Promise<void>;
  runScan(): Promise<void>;
  runCodeScan(manual?: boolean): Promise<void>;
  runOssScan(manual?: boolean): Promise<void>;
}

export interface IReportModule {
  resetTransientErrors(): void;
}

export interface ISnykLib {
  enableCode(): Promise<void>;
  checkAdvancedMode(): Promise<void>;
}

export interface IExtension extends IBaseSnykModule, IReportModule, ISnykLib {
  context: ExtensionContext | undefined;
  activate(context: vscode.ExtensionContext): void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type errorType = Error | any;
