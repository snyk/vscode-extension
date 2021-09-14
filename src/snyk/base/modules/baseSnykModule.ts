import * as vscode from 'vscode';
import { ContextService, IContextService } from '../../common/services/contextService';
import { IOpenerService, OpenerService } from '../../common/services/openerService';
import { IViewManagerService, ViewManagerService } from '../../common/services/viewManagerService';
import SnykEditorsWatcher from '../../snykCode/watchers/editorsWatcher';
import { ISnykCodeService, SnykCodeService } from '../../snykCode/codeService';
import SnykStatusBarItem, { IStatusBarItem } from '../statusBarItem/statusBarItem';
import SettingsWatcher from '../../common/watchers/settingsWatcher';
import { IWatcher } from '../../common/watchers/interfaces';
import { IBaseSnykModule, errorType } from './interfaces';
import { configuration } from '../../common/configuration/instance';
import { CliDownloadService } from '../../cli/services/cliDownloadService';
import { ExtensionContext } from '../../common/vscode/extensionContext';
import { OssService } from '../../snykOss/services/ossService';
import { CommandController } from '../../common/commands/commandController';

export default abstract class BaseSnykModule implements IBaseSnykModule {
  context: ExtensionContext;

  readonly statusBarItem: IStatusBarItem;

  readonly filesWatcher: vscode.FileSystemWatcher;
  protected readonly editorsWatcher: IWatcher;
  readonly settingsWatcher: IWatcher;

  readonly contextService: IContextService;
  readonly openerService: IOpenerService;
  readonly viewManagerService: IViewManagerService;
  protected cliDownloadService: CliDownloadService;
  protected ossService?: OssService;
  protected commandController: CommandController;

  snykCode: ISnykCodeService;

  constructor() {
    this.statusBarItem = new SnykStatusBarItem();
    this.editorsWatcher = new SnykEditorsWatcher();
    this.settingsWatcher = new SettingsWatcher();
    this.viewManagerService = new ViewManagerService();
    this.contextService = new ContextService();
    this.openerService = new OpenerService();
    this.snykCode = new SnykCodeService(
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
