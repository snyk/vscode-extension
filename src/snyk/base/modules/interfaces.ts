import { IContextService } from '../../common/services/contextService';
import { IOpenerService } from '../../common/services/openerService';
import { IViewManagerService } from '../../common/services/viewManagerService';
import { ISnykCodeService } from '../../snykCode/codeService';
import { IStatusBarItem } from '../statusBarItem/statusBarItem';
import * as vscode from 'vscode';
import { IWatcher } from '../../common/watchers/interfaces';
import { ExtensionContext } from '../../common/vscode/extensionContext';

export interface IBaseSnykModule {
  statusBarItem: IStatusBarItem;
  filesWatcher: vscode.FileSystemWatcher;
  settingsWatcher: IWatcher;
  contextService: IContextService;
  openerService: IOpenerService;
  viewManagerService: IViewManagerService;
  snykCode: ISnykCodeService;

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
  activate(context: vscode.ExtensionContext): void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type errorType = Error | any;
