import { CliDownloadService } from '../../cli/services/cliDownloadService';
import { analytics } from '../../common/analytics/analytics';
import { IAnalytics } from '../../common/analytics/itly';
import { CommandController } from '../../common/commands/commandController';
import { configuration } from '../../common/configuration/instance';
import { Logger } from '../../common/logger/logger';
import { ContextService, IContextService } from '../../common/services/contextService';
import { INotificationService, NotificationService } from '../../common/services/notificationService';
import { IOpenerService, OpenerService } from '../../common/services/openerService';
import { IViewManagerService, ViewManagerService } from '../../common/services/viewManagerService';
import { vsCodeComands } from '../../common/vscode/commands';
import { ExtensionContext } from '../../common/vscode/extensionContext';
import { vsCodeWindow } from '../../common/vscode/window';
import { IWatcher } from '../../common/watchers/interfaces';
import SettingsWatcher from '../../common/watchers/settingsWatcher';
import { ISnykCodeService } from '../../snykCode/codeService';
import SnykEditorsWatcher from '../../snykCode/watchers/editorsWatcher';
import { OssService } from '../../snykOss/services/ossService';
import { OssVulnerabilityCountService } from '../../snykOss/services/vulnerabilityCount/ossVulnerabilityCountService';
import { AuthenticationService, IAuthenticationService } from '../services/authenticationService';
import { ScanModeService } from '../services/scanModeService';
import SnykStatusBarItem, { IStatusBarItem } from '../statusBarItem/statusBarItem';
import { ILoadingBadge, LoadingBadge } from '../views/loadingBadge';
import { errorType, IBaseSnykModule } from './interfaces';

export default abstract class BaseSnykModule implements IBaseSnykModule {
  context: ExtensionContext;

  readonly statusBarItem: IStatusBarItem;

  protected readonly editorsWatcher: IWatcher;
  readonly settingsWatcher: IWatcher;

  readonly contextService: IContextService;
  readonly openerService: IOpenerService;
  readonly viewManagerService: IViewManagerService;
  protected authService: IAuthenticationService;
  protected cliDownloadService: CliDownloadService;
  protected ossService?: OssService;
  protected commandController: CommandController;
  protected scanModeService: ScanModeService;
  protected ossVulnerabilityCountService: OssVulnerabilityCountService;

  protected readonly notificationService: INotificationService;
  protected readonly analytics: IAnalytics;

  snykCode: ISnykCodeService;

  readonly loadingBadge: ILoadingBadge;

  constructor() {
    this.analytics = analytics;
    this.statusBarItem = new SnykStatusBarItem();
    this.editorsWatcher = new SnykEditorsWatcher();
    this.settingsWatcher = new SettingsWatcher();
    this.viewManagerService = new ViewManagerService();
    this.contextService = new ContextService();
    this.openerService = new OpenerService();
    this.scanModeService = new ScanModeService(this.contextService, configuration);
    this.notificationService = new NotificationService(vsCodeWindow, vsCodeComands, configuration, this.analytics);
    this.loadingBadge = new LoadingBadge();
    this.authService = new AuthenticationService(
      this.contextService,
      this.openerService,
      this,
      configuration,
      analytics,
      Logger,
    );
  }

  abstract processError(error: errorType, options?: { [key: string]: any }): Promise<void>;

  abstract runScan(): Promise<void>;
  abstract runCodeScan(): Promise<void>;
  abstract runOssScan(): Promise<void>;
}
