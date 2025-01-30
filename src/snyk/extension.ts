import * as vscode from 'vscode';
import { IExtension } from './base/modules/interfaces';
import SnykLib from './base/modules/snykLib';
import { AuthenticationService } from './base/services/authenticationService';
import { ScanModeService } from './base/services/scanModeService';
import { EmptyTreeDataProvider } from './base/views/emptyTreeDataProvider';
import { SupportProvider } from './base/views/supportProvider';
import { CommandController } from './common/commands/commandController';
import { OpenIssueCommandArg } from './common/commands/types';
import { configuration } from './common/configuration/instance';
import { SnykConfiguration } from './common/configuration/snykConfiguration';
import {
  SNYK_CLEAR_PERSISTED_CACHE_COMMAND,
  SNYK_DCIGNORE_COMMAND,
  SNYK_ENABLE_CODE_COMMAND,
  SNYK_IGNORE_ISSUE_COMMAND,
  SNYK_INITIATE_LOGIN_COMMAND,
  SNYK_OPEN_BROWSER_COMMAND,
  SNYK_OPEN_ISSUE_COMMAND,
  SNYK_OPEN_LOCAL_COMMAND,
  SNYK_SET_BASE_BRANCH_COMMAND,
  SNYK_SET_TOKEN_COMMAND,
  SNYK_SETTINGS_COMMAND,
  SNYK_SHOW_ERROR_FROM_CONTEXT_COMMAND,
  SNYK_SHOW_LS_OUTPUT_COMMAND,
  SNYK_SHOW_OUTPUT_COMMAND,
  SNYK_START_COMMAND,
  SNYK_TOGGLE_DELTA,
  SNYK_WORKSPACE_SCAN_COMMAND,
} from './common/constants/commands';
import {
  SNYK_CONTEXT,
  SNYK_VIEW_ANALYSIS_CODE_ENABLEMENT,
  SNYK_VIEW_ANALYSIS_CODE_QUALITY,
  SNYK_VIEW_ANALYSIS_CODE_SECURITY,
  SNYK_VIEW_ANALYSIS_IAC,
  SNYK_VIEW_ANALYSIS_OSS,
  SNYK_VIEW_SUMMARY,
  SNYK_VIEW_SUPPORT,
  SNYK_VIEW_WELCOME,
} from './common/constants/views';
import { ErrorHandler } from './common/error/errorHandler';
import { ExperimentService } from './common/experiment/services/experimentService';
import { LanguageServer } from './common/languageServer/languageServer';
import { StaticCliApi } from './cli/staticCliApi';
import { Logger } from './common/logger/logger';
import { DownloadService } from './common/services/downloadService';
import { LearnService } from './common/services/learnService';
import { NotificationService } from './common/services/notificationService';
import { User } from './common/user';
import { CodeActionAdapter } from './common/vscode/codeAction';
import { vsCodeCommands } from './common/vscode/commands';
import { extensionContext } from './common/vscode/extensionContext';
import { LanguageClientAdapter } from './common/vscode/languageClient';
import { vsCodeLanguages } from './common/vscode/languages';
import SecretStorageAdapter from './common/vscode/secretStorage';
import { TextDocumentAdapter } from './common/vscode/textdocument';
import { ThemeColorAdapter } from './common/vscode/theme';
import { Range, Uri } from './common/vscode/types';
import { UriAdapter } from './common/vscode/uri';
import { vsCodeWindow } from './common/vscode/window';
import { vsCodeWorkspace } from './common/vscode/workspace';
import ConfigurationWatcher from './common/watchers/configurationWatcher';
import { IgnoreCommand } from './snykCode/codeActions/ignoreCommand';
import { SnykCodeService } from './snykCode/codeService';
import { CodeSettings } from './snykCode/codeSettings';
import { CodeQualityIssueTreeProvider } from './snykCode/views/qualityIssueTreeProvider';
import CodeSecurityIssueTreeProvider from './snykCode/views/securityIssueTreeProvider';
import { CodeSuggestionWebviewProvider } from './snykCode/views/suggestion/codeSuggestionWebviewProvider';
import { IacService } from './snykIac/iacService';
import IacIssueTreeProvider from './snykIac/views/iacIssueTreeProvider';
import { IacSuggestionWebviewProvider } from './snykIac/views/suggestion/iacSuggestionWebviewProvider';
import { EditorDecorator } from './snykOss/editor/editorDecorator';
import { OssService } from './snykOss/ossService';
import { OssDetailPanelProvider } from './snykOss/providers/ossDetailPanelProvider';
import { OssVulnerabilityCountProvider } from './snykOss/providers/ossVulnerabilityCountProvider';
import OssIssueTreeProvider from './snykOss/providers/ossVulnerabilityTreeProvider';
import { OssVulnerabilityCountService } from './snykOss/services/vulnerabilityCount/ossVulnerabilityCountService';
import { FeatureFlagService } from './common/services/featureFlagService';
import { DiagnosticsIssueProvider } from './common/services/diagnosticsService';
import { CodeIssueData, IacIssueData, OssIssueData } from './common/languageServer/types';
import { ClearCacheService } from './common/services/CacheService';
import { InMemory, Persisted } from './common/constants/general';
import { GitAPI, GitExtension, Repository } from './common/git';
import { AnalyticsSender } from './common/analytics/AnalyticsSender';
import { MEMENTO_ANALYTICS_PLUGIN_INSTALLED_SENT } from './common/constants/globalState';
import { AnalyticsEvent } from './common/analytics/AnalyticsEvent';
import { SummaryWebviewViewProvider } from './common/views/summaryWebviewProvider';
import { SummaryProviderService } from './base/summary/summaryProviderService';

class SnykExtension extends SnykLib implements IExtension {
  public async activate(vscodeContext: vscode.ExtensionContext): Promise<void> {
    const summaryWebviewViewProvider = SummaryWebviewViewProvider.getInstance(vscodeContext);
    if (!summaryWebviewViewProvider) {
      console.log('Summary panel not initialized.');
    } else {
      this.summaryProviderService = new SummaryProviderService(Logger, summaryWebviewViewProvider);
      vscodeContext.subscriptions.push(
        vscode.window.registerWebviewViewProvider(SNYK_VIEW_SUMMARY, summaryWebviewViewProvider),
      );
    }

    SummaryWebviewViewProvider.getInstance(vscodeContext);
    extensionContext.setContext(vscodeContext);
    this.context = extensionContext;
    const snykConfiguration = await this.getSnykConfiguration();

    try {
      await this.initializeExtension(vscodeContext, snykConfiguration);
      this.configureGitHandlers();
    } catch (e) {
      ErrorHandler.handle(e, Logger);
    }
  }

  private configureGitHandlers(): void {
    // Get the Git extension
    const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git')?.exports;

    if (!gitExtension) {
      return;
    }

    // Get the API from the Git extension
    const git: GitAPI = gitExtension.getAPI(1);

    // Check if there are any repositories
    const repositories: Repository[] = git?.repositories;
    if (!repositories || repositories.length === 0) {
      return;
    }
    const previousBranches = new Map<Repository, string | undefined>();
    // Register event listener for changes in each repository
    repositories.forEach((repo: Repository) => {
      const previousBranch = repo.state.HEAD?.name;
      previousBranches.set(repo, previousBranch);
      repo.state.onDidChange(async () => {
        const currentBranch = repo.state.HEAD?.name;
        const storedPreviousBranch = previousBranches.get(repo);
        if (currentBranch !== storedPreviousBranch) {
          await this.cacheService.clearCache(repo.rootUri.toString(), InMemory);
          previousBranches.set(repo, currentBranch);
        }
      });
    });
  }

  private async getSnykConfiguration(): Promise<SnykConfiguration | undefined> {
    try {
      return await SnykConfiguration.get(extensionContext.extensionPath, configuration.isDevelopment);
    } catch (e) {
      ErrorHandler.handle(e, Logger);
    }
  }

  private async initializeExtension(vscodeContext: vscode.ExtensionContext, snykConfiguration?: SnykConfiguration) {
    // initialize context correctly
    // see package.json when each view is shown, based on context value
    await this.contextService.setContext(SNYK_CONTEXT.INITIALIZED, false);

    // default to true, as the check is async and can only be done after startup of LS
    // if set to true, the option to enable code is not shown in the initialization phase
    await this.contextService.setContext(SNYK_CONTEXT.CODE_ENABLED, true);

    // set the workspace context so that the text to add folders is only shown if really the case
    // initializing after LS startup and just before scan is too late
    const workspacePaths = vsCodeWorkspace.getWorkspaceFolders();
    await this.setWorkspaceContext(workspacePaths);

    this.user = await User.getAnonymous(this.context, Logger);

    SecretStorageAdapter.init(vscodeContext);
    configuration.setExtensionId(vscodeContext.extension.id);
    this.configurationWatcher = new ConfigurationWatcher(Logger);
    this.notificationService = new NotificationService(vsCodeWindow, vsCodeCommands, configuration, Logger);

    this.statusBarItem.show();

    const languageClientAdapter = new LanguageClientAdapter();
    this.authService = new AuthenticationService(
      this.contextService,
      this,
      configuration,
      vsCodeWindow,
      Logger,
      languageClientAdapter,
      vsCodeCommands,
    );

    this.learnService = new LearnService(vsCodeCommands);
    this.cacheService = new ClearCacheService(vsCodeCommands);

    this.codeSettings = new CodeSettings(this.contextService, configuration, this.openerService, vsCodeCommands);

    this.scanModeService = new ScanModeService(this.contextService, configuration);

    this.downloadService = new DownloadService(
      this.context,
      configuration,
      new StaticCliApi(vsCodeWorkspace, configuration, Logger),
      vsCodeWindow,
      Logger,
    );

    this.experimentService = new ExperimentService(this.user, Logger, configuration, snykConfiguration);

    this.languageServer = new LanguageServer(
      this.user,
      configuration,
      languageClientAdapter,
      vsCodeWorkspace,
      vsCodeWindow,
      this.authService,
      Logger,
      this.downloadService,
      this.context,
      this.summaryProviderService,
    );

    const codeSuggestionProvider = new CodeSuggestionWebviewProvider(
      vsCodeWindow,
      extensionContext,
      Logger,
      vsCodeLanguages,
      vsCodeWorkspace,
      this.learnService,
      vsCodeCommands,
    );

    this.snykCode = new SnykCodeService(
      this.context,
      configuration,
      codeSuggestionProvider,
      new CodeActionAdapter(),
      this.codeActionKindAdapter,
      this.viewManagerService,
      vsCodeWorkspace,
      this.workspaceTrust,
      this.languageServer,
      vsCodeLanguages,
      new DiagnosticsIssueProvider<CodeIssueData>(),
      Logger,
    );

    const ossSuggestionProvider = new OssDetailPanelProvider(
      vsCodeWindow,
      extensionContext,
      Logger,
      vsCodeLanguages,
      vsCodeWorkspace,
      vsCodeCommands,
    );

    this.ossService = new OssService(
      extensionContext,
      configuration,
      ossSuggestionProvider,
      new CodeActionAdapter(),
      this.codeActionKindAdapter,
      this.viewManagerService,
      vsCodeWorkspace,
      this.workspaceTrust,
      this.languageServer,
      vsCodeLanguages,
      new DiagnosticsIssueProvider<OssIssueData>(),
      Logger,
    );

    const iacSuggestionProvider = new IacSuggestionWebviewProvider(
      vsCodeWindow,
      extensionContext,
      Logger,
      vsCodeLanguages,
      vsCodeWorkspace,
      vsCodeCommands,
    );

    this.iacService = new IacService(
      this.context,
      configuration,
      iacSuggestionProvider,
      new CodeActionAdapter(),
      this.codeActionKindAdapter,
      this.viewManagerService,
      vsCodeWorkspace,
      this.workspaceTrust,
      this.languageServer,
      vsCodeLanguages,
      new DiagnosticsIssueProvider<IacIssueData>(),
      Logger,
    );

    this.commandController = new CommandController(
      this.openerService,
      this.authService,
      this.snykCode,
      this.iacService,
      this.ossService,
      this.scanModeService,
      vsCodeWorkspace,
      vsCodeCommands,
      vsCodeWindow,
      this.languageServer,
      Logger,
      configuration,
      this.folderConfigs,
    );
    this.registerCommands(vscodeContext);

    const codeSecurityIssueProvider = new CodeSecurityIssueTreeProvider(
      this.viewManagerService,
      this.contextService,
      this.snykCode,
      configuration,
      vsCodeLanguages,
      this.folderConfigs,
    );

    const codeQualityIssueProvider = new CodeQualityIssueTreeProvider(
      this.viewManagerService,
      this.contextService,
      this.snykCode,
      configuration,
      vsCodeLanguages,
      this.folderConfigs,
    );

    const securityCodeView = SNYK_VIEW_ANALYSIS_CODE_SECURITY;
    const codeQualityView = SNYK_VIEW_ANALYSIS_CODE_QUALITY;

    const codeSecurityTree = vscode.window.createTreeView(securityCodeView, {
      treeDataProvider: codeSecurityIssueProvider,
    });

    const codeQualityTree = vscode.window.createTreeView(codeQualityView, {
      treeDataProvider: codeQualityIssueProvider,
    });

    vscodeContext.subscriptions.push(
      vscode.window.registerTreeDataProvider(securityCodeView, codeSecurityIssueProvider),
      vscode.window.registerTreeDataProvider(codeQualityView, codeQualityIssueProvider),
      codeSecurityTree,
      codeQualityTree,
    );

    vscodeContext.subscriptions.push(vscode.window.registerTreeDataProvider(SNYK_VIEW_SUPPORT, new SupportProvider()));

    const welcomeTree = vscode.window.createTreeView(SNYK_VIEW_WELCOME, {
      treeDataProvider: new EmptyTreeDataProvider(),
    });
    const codeEnablementTree = vscode.window.createTreeView(SNYK_VIEW_ANALYSIS_CODE_ENABLEMENT, {
      treeDataProvider: new EmptyTreeDataProvider(),
    });

    vscodeContext.subscriptions.push(codeEnablementTree);

    const ossIssueProvider = new OssIssueTreeProvider(
      this.viewManagerService,
      this.contextService,
      this.ossService,
      configuration,
      vsCodeLanguages,
      this.folderConfigs,
    );

    const ossSecurityTree = vscode.window.createTreeView(SNYK_VIEW_ANALYSIS_OSS, {
      treeDataProvider: ossIssueProvider,
    });

    vscodeContext.subscriptions.push(
      vscode.window.registerTreeDataProvider(SNYK_VIEW_ANALYSIS_OSS, ossIssueProvider),
      ossSecurityTree,
    );

    const iacIssueProvider = new IacIssueTreeProvider(
      this.viewManagerService,
      this.contextService,
      this.iacService,
      configuration,
      vsCodeLanguages,
      this.folderConfigs,
    );

    const iacSecurityTree = vscode.window.createTreeView(SNYK_VIEW_ANALYSIS_IAC, {
      treeDataProvider: iacIssueProvider,
    });

    vscodeContext.subscriptions.push(
      vscode.window.registerTreeDataProvider(SNYK_VIEW_ANALYSIS_IAC, iacIssueProvider),
      iacSecurityTree,
    );

    // Fill the view container to expose views for tests
    const viewContainer = this.viewManagerService.viewContainer;
    viewContainer.set(SNYK_VIEW_WELCOME, welcomeTree);

    vscode.workspace.onDidChangeWorkspaceFolders(e => {
      this.workspaceTrust.resetTrustedFoldersCache();
      e.removed.forEach(folder => {
        this.snykCode.resetResult(folder.uri.fsPath);
      });
      this.runScan();
    });

    this.editorsWatcher.activate(this);
    this.configurationWatcher.activate(this);
    this.snykCode.activateWebviewProviders();
    this.iacService.activateWebviewProviders();
    this.ossService.activateWebviewProviders();

    // noinspection ES6MissingAwait
    void this.notificationService.init();
    // eslint-disable-next-line  @typescript-eslint/no-unsafe-argument
    this.checkAdvancedMode().catch(err => Logger.error(err));

    this.experimentService.load();

    this.initDependencyDownload();

    this.ossVulnerabilityCountService = new OssVulnerabilityCountService(
      vsCodeWorkspace,
      vsCodeWindow,
      vsCodeLanguages,
      new OssVulnerabilityCountProvider(
        this.ossService,
        languageClientAdapter,
        new UriAdapter(),
        new TextDocumentAdapter(),
      ),
      this.ossService,
      Logger,
      new EditorDecorator(vsCodeWindow, vsCodeLanguages, new ThemeColorAdapter()),
      configuration,
    );
    this.ossVulnerabilityCountService.activate();

    // Wait for LS startup to finish before updating the codeEnabled context
    // The codeEnabled context depends on an LS command
    await this.languageServer.start();

    // initialize contexts
    await this.contextService.setContext(SNYK_CONTEXT.INITIALIZED, true);

    // Fetch feature flag to determine whether to use the new LSP-based rendering.
    // feature flags depend on the language server
    this.featureFlagService = new FeatureFlagService(vsCodeCommands);
    await this.setupFeatureFlags();

    // Fetch feature flag to determine whether to use the new LSP-based rendering.

    // initialize contexts
    await this.contextService.setContext(SNYK_CONTEXT.INITIALIZED, true);
    this.sendPluginInstalledEvent();

    // Actually start analysis
    this.runScan();
  }

  private sendPluginInstalledEvent() {
    // start analytics sender and send plugin installed event
    const analyticsSender = AnalyticsSender.getInstance(Logger, configuration, vsCodeCommands, this.contextService);

    const pluginInstalledSent =
      extensionContext.getGlobalStateValue<boolean>(MEMENTO_ANALYTICS_PLUGIN_INSTALLED_SENT) ?? false;

    if (!pluginInstalledSent) {
      const category = [];
      category.push('install');
      const pluginInstalleEvent = new AnalyticsEvent(this.user.anonymousId, 'plugin installed', category);
      analyticsSender.logEvent(pluginInstalleEvent, () => {
        void extensionContext.updateGlobalStateValue(MEMENTO_ANALYTICS_PLUGIN_INSTALLED_SENT, true);
      });
    }
  }

  public async deactivate(): Promise<void> {
    this.ossVulnerabilityCountService.dispose();
    await this.languageServer.stop();
  }

  public async stopLanguageServer(): Promise<void> {
    await this.languageServer.stop();
  }

  public async restartLanguageServer(): Promise<void> {
    await this.languageServer.stop();
    await this.languageServer.start();
  }

  public initDependencyDownload(): DownloadService {
    this.downloadService.downloadOrUpdate().catch(err => {
      void ErrorHandler.handleGlobal(err, Logger, this.contextService, this.loadingBadge);
      void this.notificationService.showErrorNotification((err as Error).message);
    });
    return this.downloadService;
  }

  private registerCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.commands.registerCommand(SNYK_OPEN_BROWSER_COMMAND, (url: string) =>
        this.commandController.openBrowser(url),
      ),
      vscode.commands.registerCommand(SNYK_OPEN_LOCAL_COMMAND, (path: Uri, range?: Range | undefined) =>
        this.commandController.openLocal(path, range),
      ),
      vscode.commands.registerCommand(SNYK_INITIATE_LOGIN_COMMAND, () => this.commandController.initiateLogin()),
      vscode.commands.registerCommand(SNYK_SET_TOKEN_COMMAND, () => this.commandController.setToken()),
      vscode.commands.registerCommand(
        SNYK_CLEAR_PERSISTED_CACHE_COMMAND,
        async () => await this.cacheService.clearCache('', Persisted),
      ),
      vscode.commands.registerCommand(SNYK_ENABLE_CODE_COMMAND, () =>
        this.commandController.executeCommand(SNYK_ENABLE_CODE_COMMAND, () => this.enableCode()),
      ),
      vscode.commands.registerCommand(SNYK_START_COMMAND, async () => {
        await vscode.commands.executeCommand(SNYK_WORKSPACE_SCAN_COMMAND);
        await vscode.commands.executeCommand('setContext', 'scanSummaryHtml', 'scanSummary');
      }),
      vscode.commands.registerCommand(SNYK_SETTINGS_COMMAND, () => this.commandController.openSettings()),
      vscode.commands.registerCommand(SNYK_DCIGNORE_COMMAND, (custom: boolean, path?: string) =>
        this.commandController.createDCIgnore(custom, new UriAdapter(), path),
      ),
      vscode.commands.registerCommand(SNYK_OPEN_ISSUE_COMMAND, (arg: OpenIssueCommandArg) =>
        this.commandController.openIssueCommand(arg),
      ),
      vscode.commands.registerCommand(SNYK_SHOW_OUTPUT_COMMAND, () => this.commandController.showOutputChannel()),
      vscode.commands.registerCommand(SNYK_SHOW_LS_OUTPUT_COMMAND, () => this.commandController.showLsOutputChannel()),
      vscode.commands.registerCommand(SNYK_IGNORE_ISSUE_COMMAND, IgnoreCommand.ignoreIssues),
      vscode.commands.registerCommand(SNYK_SET_BASE_BRANCH_COMMAND, (folderPath: string) =>
        this.commandController.setBaseBranch(folderPath),
      ),
      vscode.commands.registerCommand(SNYK_TOGGLE_DELTA, (isEnabled: boolean) =>
        this.commandController.toggleDelta(isEnabled),
      ),
      vscode.commands.registerCommand(SNYK_SHOW_ERROR_FROM_CONTEXT_COMMAND, () => {
        const err = this.contextService.viewContext[SNYK_CONTEXT.ERROR] as Error;
        void this.notificationService.showErrorNotification(err.message);
      }),
    );
  }
}

export default SnykExtension;
