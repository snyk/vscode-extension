import { CliDownloadService } from '../../cli/services/cliDownloadService';
import { IAnalytics } from '../../common/analytics/itly';
import { ISnykApiClient, SnykApiClient } from '../../common/api/apiСlient';
import { CommandController } from '../../common/commands/commandController';
import { configuration } from '../../common/configuration/instance';
import { ISnykCodeErrorHandler, SnykCodeErrorHandler } from '../../common/error/snykCodeErrorHandler';
import { ExperimentService } from '../../common/experiment/services/experimentService';
import { Logger } from '../../common/logger/logger';
import { ContextService, IContextService } from '../../common/services/contextService';
import { INotificationService } from '../../common/services/notificationService';
import { IOpenerService, OpenerService } from '../../common/services/openerService';
import { IViewManagerService, ViewManagerService } from '../../common/services/viewManagerService';
import { User } from '../../common/user';
import { ExtensionContext } from '../../common/vscode/extensionContext';
import { IWatcher } from '../../common/watchers/interfaces';
import { ISnykCodeService } from '../../snykCode/codeService';
import { FalsePositiveApi, IFalsePositiveApi } from '../../snykCode/falsePositive/api/falsePositiveApi';
import SnykEditorsWatcher from '../../snykCode/watchers/editorsWatcher';
import { OssService } from '../../snykOss/services/ossService';
import { OssVulnerabilityCountService } from '../../snykOss/services/vulnerabilityCount/ossVulnerabilityCountService';
import { IAuthenticationService } from '../services/authenticationService';
import { ScanModeService } from '../services/scanModeService';
import SnykStatusBarItem, { IStatusBarItem } from '../statusBarItem/statusBarItem';
import { ILoadingBadge, LoadingBadge } from '../views/loadingBadge';
import { IBaseSnykModule } from './interfaces';

export default abstract class BaseSnykModule implements IBaseSnykModule {
  context: ExtensionContext;

  readonly statusBarItem: IStatusBarItem;

  protected readonly editorsWatcher: IWatcher;
  protected settingsWatcher: IWatcher;

  readonly contextService: IContextService;
  readonly openerService: IOpenerService;
  readonly viewManagerService: IViewManagerService;
  protected authService: IAuthenticationService;
  protected cliDownloadService: CliDownloadService;
  protected ossService?: OssService;
  protected commandController: CommandController;
  protected scanModeService: ScanModeService;
  protected ossVulnerabilityCountService: OssVulnerabilityCountService;

  protected notificationService: INotificationService;
  protected analytics: IAnalytics;

  protected snykApiClient: ISnykApiClient;
  protected falsePositiveApi: IFalsePositiveApi;
  snykCode: ISnykCodeService;

  readonly loadingBadge: ILoadingBadge;
  protected user: User;
  protected experimentService: ExperimentService;
  protected snykCodeErrorHandler: ISnykCodeErrorHandler;

  constructor() {
    this.statusBarItem = new SnykStatusBarItem();
    this.editorsWatcher = new SnykEditorsWatcher();
    this.viewManagerService = new ViewManagerService();
    this.contextService = new ContextService();
    this.openerService = new OpenerService();
    this.scanModeService = new ScanModeService(this.contextService, configuration);
    this.loadingBadge = new LoadingBadge();
    this.snykApiClient = new SnykApiClient(configuration);
    this.falsePositiveApi = new FalsePositiveApi(configuration);
    this.snykCodeErrorHandler = new SnykCodeErrorHandler(this.contextService, this.loadingBadge, Logger, this);
  }

  abstract runScan(): Promise<void>;
  abstract runCodeScan(): Promise<void>;
  abstract runOssScan(): Promise<void>;
}
