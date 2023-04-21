import { AdvisorApiClient, IAdvisorApiClient } from '../../advisor/services/advisorApiClient';
import AdvisorProvider from '../../advisor/services/advisorProvider';
import { AdvisorService } from '../../advisor/services/advisorService';
import { IAnalytics } from '../../common/analytics/itly';
import { ISnykApiClient, SnykApiClient } from '../../common/api/apiСlient';
import { CommandController } from '../../common/commands/commandController';
import { configuration } from '../../common/configuration/instance';
import { IWorkspaceTrust, WorkspaceTrust } from '../../common/configuration/trustedFolders';
import { ExperimentService } from '../../common/experiment/services/experimentService';
import { CodeScanOrchestrator } from '../../common/languageServer/experiments/codeScanOrchestrator';
import { ILanguageServer } from '../../common/languageServer/languageServer';
import { CodeIssueData, IacIssueData } from '../../common/languageServer/types';
import { Logger } from '../../common/logger/logger';
import { ContextService, IContextService } from '../../common/services/contextService';
import { DownloadService } from '../../common/services/downloadService';
import { INotificationService } from '../../common/services/notificationService';
import { IOpenerService, OpenerService } from '../../common/services/openerService';
import { IProductService } from '../../common/services/productService';
import { IViewManagerService, ViewManagerService } from '../../common/services/viewManagerService';
import { User } from '../../common/user';
import { CodeActionKindAdapter, ICodeActionKindAdapter } from '../../common/vscode/codeAction';
import { ExtensionContext } from '../../common/vscode/extensionContext';
import { IMarkdownStringAdapter, MarkdownStringAdapter } from '../../common/vscode/markdownString';
import { vsCodeWorkspace } from '../../common/vscode/workspace';
import { IWatcher } from '../../common/watchers/interfaces';
import { ISnykCodeServiceOld } from '../../snykCode/codeServiceOld';
import { CodeSettings, ICodeSettings } from '../../snykCode/codeSettings';
import { ISnykCodeErrorHandler, SnykCodeErrorHandler } from '../../snykCode/error/snykCodeErrorHandler';
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
  protected configurationWatcher: IWatcher;

  readonly contextService: IContextService;
  readonly openerService: IOpenerService;
  readonly viewManagerService: IViewManagerService;
  protected authService: IAuthenticationService;
  protected downloadService: DownloadService;
  protected ossService?: OssService;
  protected advisorService?: AdvisorProvider;
  protected commandController: CommandController;
  protected scanModeService: ScanModeService;
  protected ossVulnerabilityCountService: OssVulnerabilityCountService;
  protected advisorScoreDisposable: AdvisorService;
  protected languageServer: ILanguageServer;

  protected notificationService: INotificationService;
  protected analytics: IAnalytics;

  protected snykApiClient: ISnykApiClient;
  protected advisorApiClient: IAdvisorApiClient;
  protected falsePositiveApi: IFalsePositiveApi;
  snykCodeOld: ISnykCodeServiceOld;
  snykCode: IProductService<CodeIssueData>;
  protected codeSettings: ICodeSettings;
  protected codeScanOrchestrator: CodeScanOrchestrator;

  iacService: IProductService<IacIssueData>;

  readonly loadingBadge: ILoadingBadge;
  protected user: User;
  protected experimentService: ExperimentService;
  protected snykCodeErrorHandler: ISnykCodeErrorHandler;

  protected markdownStringAdapter: IMarkdownStringAdapter;
  readonly workspaceTrust: IWorkspaceTrust;
  readonly codeActionKindAdapter: ICodeActionKindAdapter;

  constructor() {
    this.statusBarItem = new SnykStatusBarItem();
    this.editorsWatcher = new SnykEditorsWatcher();
    this.viewManagerService = new ViewManagerService();
    this.contextService = new ContextService();
    this.openerService = new OpenerService();
    this.loadingBadge = new LoadingBadge();
    this.snykApiClient = new SnykApiClient(configuration, vsCodeWorkspace, Logger);
    this.falsePositiveApi = new FalsePositiveApi(configuration, vsCodeWorkspace, Logger);
    this.snykCodeErrorHandler = new SnykCodeErrorHandler(
      this.contextService,
      this.loadingBadge,
      Logger,
      this,
      configuration,
    );
    this.codeSettings = new CodeSettings(this.snykApiClient, this.contextService, configuration, this.openerService);
    this.advisorApiClient = new AdvisorApiClient(configuration, Logger);
    this.markdownStringAdapter = new MarkdownStringAdapter();
    this.workspaceTrust = new WorkspaceTrust();
    this.codeActionKindAdapter = new CodeActionKindAdapter();
  }

  abstract runScan(): Promise<void>;

  abstract runCodeScan(): Promise<void>;

  abstract runOssScan(): Promise<void>;
}
