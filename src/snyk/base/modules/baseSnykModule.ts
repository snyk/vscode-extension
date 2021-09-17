import { CliDownloadService } from '../../cli/services/cliDownloadService';
import { CommandController } from '../../common/commands/commandController';
import { configuration } from '../../common/configuration/instance';
import { ContextService, IContextService } from '../../common/services/contextService';
import { INotificationService, NotificationService } from '../../common/services/notificationService';
import { IOpenerService, OpenerService } from '../../common/services/openerService';
import { IViewManagerService, ViewManagerService } from '../../common/services/viewManagerService';
import { ExtensionContext } from '../../common/vscode/extensionContext';
import { vsCodeWindow } from '../../common/vscode/window';
import { vsCodeWorkspace } from '../../common/vscode/workspace';
import { IWatcher } from '../../common/watchers/interfaces';
import SettingsWatcher from '../../common/watchers/settingsWatcher';
import { ISnykCodeService, SnykCodeService } from '../../snykCode/codeService';
import SnykEditorsWatcher from '../../snykCode/watchers/editorsWatcher';
import { OssService } from '../../snykOss/services/ossService';
import { ScanModeService } from '../services/scanModeService';
import SnykStatusBarItem, { IStatusBarItem } from '../statusBarItem/statusBarItem';
import { errorType, IBaseSnykModule } from './interfaces';

export default abstract class BaseSnykModule implements IBaseSnykModule {
  context: ExtensionContext;

  readonly statusBarItem: IStatusBarItem;

  protected readonly editorsWatcher: IWatcher;
  readonly settingsWatcher: IWatcher;

  readonly contextService: IContextService;
  readonly openerService: IOpenerService;
  readonly viewManagerService: IViewManagerService;
  protected cliDownloadService: CliDownloadService;
  protected ossService?: OssService;
  protected commandController: CommandController;
  protected scanModeService: ScanModeService;

  protected readonly notificationService: INotificationService;

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
      vsCodeWorkspace,
      this.processError.bind(this),
    );
    this.scanModeService = new ScanModeService(this.contextService);
    this.notificationService = new NotificationService(vsCodeWindow);
  }

  abstract processError(error: errorType, options?: { [key: string]: any }): Promise<void>;

  abstract runScan(): Promise<void>;
  abstract runCodeScan(): Promise<void>;
  abstract runOssScan(): Promise<void>;
}
