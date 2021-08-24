import * as vscode from 'vscode';
import { ContextService, IContextService } from '../../common/services/contextService';
import { IOpenerService, OpenerService } from '../../common/services/openerService';
import { IViewManagerService, ViewManagerService } from '../../common/services/viewManagerService';
import SnykEditorsWatcher from '../../snykCode/watchers/editorsWatcher';
import { ISnykCode, SnykCode } from '../../snykCode/code';
import SnykStatusBarItem, { IStatusBarItem } from '../statusBarItem/statusBarItem';
import SettingsWatcher from '../../common/watchers/settingsWatcher';
import { IWatcher } from '../../common/watchers/interfaces';
import { IBaseSnykModule, errorType } from './interfaces';
import { configuration } from '../../common/configuration/instance';
import { CliService } from '../../cli/cliService';
import { ExtensionContext } from '../../common/vscode/extensionContext';

export default abstract class BaseSnykModule implements IBaseSnykModule {
  context: ExtensionContext;
  statusBarItem: IStatusBarItem;
  filesWatcher: vscode.FileSystemWatcher;
  editorsWatcher: IWatcher;
  settingsWatcher: IWatcher;
  contextService: IContextService;
  openerService: IOpenerService;
  viewManagerService: IViewManagerService;
  cliService?: CliService;

  snykCode: ISnykCode;

  constructor() {
    this.statusBarItem = new SnykStatusBarItem();
    this.editorsWatcher = new SnykEditorsWatcher();
    this.settingsWatcher = new SettingsWatcher();
    this.viewManagerService = new ViewManagerService();
    this.contextService = new ContextService();
    this.openerService = new OpenerService();
    this.snykCode = new SnykCode(
      configuration,
      this.openerService,
      this.viewManagerService,
      this.filesWatcher,
      this.processError.bind(this),
    );
  }

  abstract processError(error: errorType, options?: { [key: string]: any }): Promise<void>;

  abstract startExtension(): Promise<void>;
}
