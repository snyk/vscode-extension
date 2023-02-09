import { AdvisorApiClient, IAdvisorApiClient } from '../../advisor/services/advisorApiClient';
import AdvisorProvider from '../../advisor/services/advisorProvider';
import { AdvisorService } from '../../advisor/services/advisorService';
import { IAnalytics } from '../../common/analytics/itly';
import { ISnykApiClient, SnykApiClient } from '../../common/api/apiСlient';
import { CommandController } from '../../common/commands/commandController';
import { configuration } from '../../common/configuration/instance';
import { IWorkspaceTrust, WorkspaceTrust } from '../../common/configuration/trustedFolders';
import { ExperimentService } from '../../common/experiment/services/experimentService';
import { ILanguageServer } from '../../common/languageServer/languageServer';
import { Logger } from '../../common/logger/logger';
import { ContextService, IContextService } from '../../common/services/contextService';
import { DownloadService } from '../../common/services/downloadService';
import { LearnService } from '../../common/services/learnService';
import { INotificationService } from '../../common/services/notificationService';
import { IViewManagerService, ViewManagerService } from '../../common/services/viewManagerService';
import { User } from '../../common/user';
import { CodeActionKindAdapter, ICodeActionKindAdapter } from '../../common/vscode/codeAction';
import { ExtensionContext } from '../../common/vscode/extensionContext';
import { IMarkdownStringAdapter, MarkdownStringAdapter } from '../../common/vscode/markdownString';
import { vsCodeWorkspace } from '../../common/vscode/workspace';
import { IWatcher } from '../../common/watchers/interfaces';
import { ISnykCodeService } from '../../snykCode/codeService';
import { OssService } from '../../snykOss/services/ossService';
import { OssVulnerabilityCountService } from '../../snykOss/services/vulnerabilityCount/ossVulnerabilityCountService';
import { IAuthenticationService } from '../services/authenticationService';
import SnykStatusBarItem, { IStatusBarItem } from '../statusBarItem/statusBarItem';
import { ILoadingBadge, LoadingBadge } from '../views/loadingBadge';
import { IBaseSnykModule } from './interfaces';

export default abstract class BaseSnykModule implements IBaseSnykModule {
  context: ExtensionContext;

  readonly statusBarItem: IStatusBarItem;

  protected configurationWatcher: IWatcher;

  readonly contextService: IContextService;
  readonly viewManagerService: IViewManagerService;
  protected authService: IAuthenticationService;
  protected downloadService: DownloadService;
  protected ossService?: OssService;
  protected advisorService?: AdvisorProvider;
  protected learnService: LearnService;
  protected commandController: CommandController;
  protected ossVulnerabilityCountService: OssVulnerabilityCountService;
  protected advisorScoreDisposable: AdvisorService;
  protected languageServer: ILanguageServer;

  protected notificationService: INotificationService;
  protected analytics: IAnalytics;

  protected snykApiClient: ISnykApiClient;
  protected advisorApiClient: IAdvisorApiClient;
  snykCode: ISnykCodeService;

  readonly loadingBadge: ILoadingBadge;
  protected user: User;
  protected experimentService: ExperimentService;

  protected markdownStringAdapter: IMarkdownStringAdapter;
  readonly workspaceTrust: IWorkspaceTrust;
  readonly codeActionKindAdapter: ICodeActionKindAdapter;

  constructor() {
    this.statusBarItem = new SnykStatusBarItem();
    this.viewManagerService = new ViewManagerService();
    this.contextService = new ContextService();
    this.loadingBadge = new LoadingBadge();
    this.learnService = new LearnService(configuration, Logger);
    this.snykApiClient = new SnykApiClient(configuration, vsCodeWorkspace, Logger);
    this.advisorApiClient = new AdvisorApiClient(configuration, Logger);
    this.markdownStringAdapter = new MarkdownStringAdapter();
    this.workspaceTrust = new WorkspaceTrust();
    this.codeActionKindAdapter = new CodeActionKindAdapter();
  }

  abstract runScan(): Promise<void>;

  abstract runOssScan(): Promise<void>;
}
