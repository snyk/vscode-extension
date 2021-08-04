import { IContextService } from '../../common/services/contextService';
import { IOpenerService } from '../../common/services/openerService';
import { IViewManagerService } from '../../common/services/viewManagerService';
import { ISnykCode } from '../../snykCode/code';
import { IStatusBarItem } from '../statusBarItem/statusBarItem';
import { ExtensionContext, FileSystemWatcher } from 'vscode';
import { IWatcher } from '../../common/watchers/interfaces';

export interface IBaseSnykModule {
  statusBarItem: IStatusBarItem;
  filesWatcher: FileSystemWatcher;
  settingsWatcher: IWatcher;
  contextService: IContextService;
  openerService: IOpenerService;
  viewManagerService: IViewManagerService;
  snykCode: ISnykCode;

  // Abstract methods
  processError(error: errorType, options?: { [key: string]: any }): Promise<void>;
  startExtension(): Promise<void>;
}

export interface IReportModule {
  resetTransientErrors(): void;
}

export interface ILoginModule {
  initiateLogin(): Promise<void>;
  checkSession(): Promise<string>;
  checkCodeEnabled(): Promise<boolean>;
  checkAdvancedMode(): Promise<void>;
}

export interface ISnykLib {
  setMode(mode: string): void;
  enableCode(): Promise<void>;
}

export interface IExtension extends IBaseSnykModule, IReportModule, ILoginModule, ISnykLib {
  context: ExtensionContext | undefined;
  activate(context: ExtensionContext): void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type errorType = Error | any;
