import { CommandController } from '../../common/commands/commandController';
import { FolderConfigs, IFolderConfigs } from '../../common/configuration/folderConfigs';
import { IWorkspaceTrust, WorkspaceTrust } from '../../common/configuration/trustedFolders';
import { ExperimentService } from '../../common/experiment/services/experimentService';
import { ILanguageServer } from '../../common/languageServer/languageServer';
import { CodeIssueData, IacIssueData } from '../../common/languageServer/types';
import { IClearCacheService } from '../../common/services/CacheService';
import { ContextService, IContextService } from '../../common/services/contextService';
import { DownloadService } from '../../common/services/downloadService';
import { FeatureFlagService } from '../../common/services/featureFlagService';
import { LearnService } from '../../common/services/learnService';
import { INotificationService } from '../../common/services/notificationService';
import { IOpenerService, OpenerService } from '../../common/services/openerService';
import { IProductService } from '../../common/services/productService';
import { IViewManagerService, ViewManagerService } from '../../common/services/viewManagerService';
import { User } from '../../common/user';
import { CodeActionKindAdapter, ICodeActionKindAdapter } from '../../common/vscode/codeAction';
import { ExtensionContext } from '../../common/vscode/extensionContext';
import { IMarkdownStringAdapter, MarkdownStringAdapter } from '../../common/vscode/markdownString';
import { IWatcher } from '../../common/watchers/interfaces';
import { ICodeSettings } from '../../snykCode/codeSettings';
import SnykEditorsWatcher from '../../snykCode/watchers/editorsWatcher';
import { OssService } from '../../snykOss/ossService';
import { OssVulnerabilityCountService } from '../../snykOss/services/vulnerabilityCount/ossVulnerabilityCountService';
import { IAuthenticationService } from '../services/authenticationService';
import { ScanModeService } from '../services/scanModeService';
import SnykStatusBarItem, { IStatusBarItem } from '../statusBarItem/statusBarItem';
import { ISummaryProviderService } from '../summary/summaryProviderService';
import { ILoadingBadge, LoadingBadge } from '../views/loadingBadge';
import { IBaseSnykModule } from './interfaces';

export default abstract class BaseSnykModule implements IBaseSnykModule {
  context: ExtensionContext;

  readonly statusBarItem: IStatusBarItem;

  protected readonly editorsWatcher: IWatcher;
  protected configurationWatcher: IWatcher;
  protected summaryProviderService: ISummaryProviderService;
  readonly contextService: IContextService;
  cacheService: IClearCacheService;
  readonly openerService: IOpenerService;
  readonly viewManagerService: IViewManagerService;
  protected authService: IAuthenticationService;
  protected downloadService: DownloadService;
  protected ossService?: OssService;
  protected featureFlagService: FeatureFlagService;

  protected commandController: CommandController;
  protected scanModeService: ScanModeService;
  protected ossVulnerabilityCountService: OssVulnerabilityCountService;

  protected languageServer: ILanguageServer;

  protected notificationService: INotificationService;

  snykCode: IProductService<CodeIssueData>;
  protected codeSettings: ICodeSettings;

  iacService: IProductService<IacIssueData>;

  readonly loadingBadge: ILoadingBadge;
  protected user: User;
  protected experimentService: ExperimentService;
  protected learnService: LearnService;

  protected markdownStringAdapter: IMarkdownStringAdapter;
  readonly workspaceTrust: IWorkspaceTrust;
  readonly codeActionKindAdapter: ICodeActionKindAdapter;
  readonly folderConfigs: IFolderConfigs;

  constructor() {
    this.statusBarItem = new SnykStatusBarItem();
    this.editorsWatcher = new SnykEditorsWatcher();
    this.viewManagerService = new ViewManagerService();
    this.contextService = new ContextService();
    this.openerService = new OpenerService();
    this.loadingBadge = new LoadingBadge();
    this.markdownStringAdapter = new MarkdownStringAdapter();
    this.workspaceTrust = new WorkspaceTrust();
    this.codeActionKindAdapter = new CodeActionKindAdapter();
    this.folderConfigs = new FolderConfigs();
  }

  abstract runScan(): Promise<void>;
}
