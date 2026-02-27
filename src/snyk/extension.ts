import * as vscode from 'vscode';
import { IExtension } from './base/modules/interfaces';
import SnykLib from './base/modules/snykLib';
import { AuthenticationService } from './base/services/authenticationService';
import { ScanModeService } from './base/services/scanModeService';
import { EmptyTreeDataProvider } from './base/views/emptyTreeDataProvider';
import { SupportProvider } from './base/views/supportProvider';
import { CommandController } from './common/commands/commandController';
import { OpenIssueCommandArg } from './common/commands/types';
import { PresentableError } from './common/languageServer/types';
import { configuration } from './common/configuration/instance';
import { SnykConfiguration } from './common/configuration/snykConfiguration';
import {
  SNYK_CLEAR_PERSISTED_CACHE_COMMAND,
  SNYK_DCIGNORE_COMMAND,
  SNYK_ENABLE_CODE_COMMAND,
  SNYK_IGNORE_ISSUE_COMMAND,
  SNYK_INITIATE_LOGIN_COMMAND,
  SNYK_INITIATE_LOGOUT_COMMAND,
  SNYK_OPEN_BROWSER_COMMAND,
  SNYK_OPEN_ISSUE_COMMAND,
  SNYK_OPEN_LOCAL_COMMAND,
  SNYK_SET_DELTA_REFERENCE_COMMAND,
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
  SNYK_VIEW_ANALYSIS_CODE_SECURITY,
  SNYK_VIEW_ANALYSIS_IAC,
  SNYK_VIEW_ANALYSIS_OSS,
  SNYK_VIEW_SUMMARY,
  SNYK_VIEW_SUPPORT,
  SNYK_VIEW_TREEVIEW,
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
import { extensionContext, IExtensionRetriever } from './common/vscode/extensionContext';
import { LanguageClientAdapter } from './common/vscode/languageClient';
import { vsCodeLanguages } from './common/vscode/languages';
import SecretStorageAdapter from './common/vscode/secretStorage';
import { TextDocumentAdapter } from './common/vscode/textdocument';
import { ThemeColorAdapter } from './common/vscode/theme';
import { Range, Uri } from './common/vscode/types';
import { vsCodeEnv } from './common/vscode/env';
import { UriAdapter } from './common/vscode/uri';
import { vsCodeWindow } from './common/vscode/window';
import { vsCodeWorkspace } from './common/vscode/workspace';
import ConfigurationWatcher from './common/watchers/configurationWatcher';
import { IgnoreCommand } from './snykCode/codeActions/ignoreCommand';
import { SnykCodeService } from './snykCode/codeService';
import { CodeSettings } from './snykCode/codeSettings';
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
import {
  CodeIssueData,
  IacIssueData,
  LsScanProduct,
  OssIssueData,
  SecretsIssueData,
} from './common/languageServer/types';
import { ClearCacheService } from './common/services/CacheService';
import { FileLockService } from './common/services/fileLockService';
import { InMemory, Persisted } from './common/constants/general';
import { GitAPI, GitExtension, Repository } from './common/git';
import { AnalyticsSender } from './common/analytics/AnalyticsSender';
import {
  MEMENTO_ANALYTICS_PLUGIN_INSTALLED_SENT,
  MEMENTO_SECURE_AT_INCEPTION_MODAL,
} from './common/constants/globalState';
import { AnalyticsEvent } from './common/analytics/AnalyticsEvent';
import { SummaryWebviewViewProvider } from './common/views/summaryWebviewProvider';
import { WorkspaceConfigurationWebviewProvider } from './common/views/workspaceConfiguration/workspaceConfigurationWebviewProvider';
import { ScopeDetectionService } from './common/views/workspaceConfiguration/services/scopeDetectionService';
import { ConfigurationMappingService } from './common/views/workspaceConfiguration/services/configurationMappingService';
import { HtmlInjectionService } from './common/views/workspaceConfiguration/services/htmlInjectionService';
import { ConfigurationPersistenceService } from './common/views/workspaceConfiguration/services/configurationPersistenceService';
import { MessageHandlerFactory } from './common/views/workspaceConfiguration/handlers/messageHandlerFactory';
import { SummaryProviderService } from './base/summary/summaryProviderService';
import { TreeViewProviderService } from './base/treeView/treeViewProviderService';
import { TreeViewWebviewProvider } from './common/views/treeViewWebviewProvider';
import { ProductTreeViewService } from './common/services/productTreeViewService';
import { Extension } from './common/vscode/extension';
import { MarkdownStringAdapter } from './common/vscode/markdownString';
import { McpProvider } from './common/vscode/mcpProvider';
import { HTML_SETTINGS, HTML_TREE_VIEW } from './common/constants/settings';
import { SecretsService } from './snykSecrets/secretsService';
import { SecretsSuggestionWebviewProvider } from './snykSecrets/views/suggestion/secretsSuggestionWebviewProvider';

class SnykExtension extends SnykLib implements IExtension {
  private workspaceConfigurationProvider?: WorkspaceConfigurationWebviewProvider;

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
    const workspacePaths = vsCodeWorkspace.getWorkspaceFolderPaths();
    await this.setWorkspaceContext(workspacePaths);

    this.user = await User.getAnonymous(this.context, Logger);

    SecretStorageAdapter.init(vscodeContext);
    configuration.setExtensionId(vscodeContext.extension.id);
    this.configurationWatcher = new ConfigurationWatcher(Logger, this.user, vscodeContext);
    this.notificationService = new NotificationService(vsCodeWindow, vsCodeCommands, configuration, Logger);

    this.statusBarItem.show();

    const languageClientAdapter = new LanguageClientAdapter();
    const mcpProvider = new McpProvider();

    configuration.setViewManagerService(this.viewManagerService);
    configuration.setLanguageClientAdapter(languageClientAdapter);

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

    const htmlTreeViewEnabled = configuration.getPreviewFeature(HTML_TREE_VIEW);
    await this.contextService.setContext(SNYK_CONTEXT.HTML_TREE_VIEW_ENABLED, htmlTreeViewEnabled);

    if (htmlTreeViewEnabled) {
      const treeViewWebviewProvider = TreeViewWebviewProvider.getInstance(vscodeContext, vsCodeCommands);
      if (treeViewWebviewProvider) {
        this.treeViewProviderService = new TreeViewProviderService(Logger, treeViewWebviewProvider);
        vscodeContext.subscriptions.push(
          vscode.window.registerWebviewViewProvider(SNYK_VIEW_TREEVIEW, treeViewWebviewProvider),
        );
      }
    }

    this.languageServer = new LanguageServer(
      this.user,
      configuration,
      languageClientAdapter,
      vsCodeWorkspace,
      vsCodeWindow,
      this.authService,
      Logger,
      this.downloadService,
      mcpProvider,
      {
        extensionPath: extensionContext.extensionPath,
        getExtension(id: string): Extension | undefined {
          return vscode.extensions.all.find(ext => ext.id === id);
        },
      } as IExtensionRetriever,
      this.summaryProviderService,
      new UriAdapter(),
      new MarkdownStringAdapter(),
      vsCodeCommands,
      new DiagnosticsIssueProvider(),
      this.treeViewProviderService,
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
      this.folderConfigs,
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

    const secretsSuggestionProvider = new SecretsSuggestionWebviewProvider(
      vsCodeWindow,
      extensionContext,
      Logger,
      vsCodeLanguages,
      vsCodeWorkspace,
      vsCodeCommands,
    );

    this.secretsService = new SecretsService(
      extensionContext,
      configuration,
      secretsSuggestionProvider,
      this.viewManagerService,
      vsCodeWorkspace,
      this.workspaceTrust,
      this.languageServer,
      vsCodeLanguages,
      new DiagnosticsIssueProvider<SecretsIssueData>(),
      Logger,
    );

    // Initialize workspace configuration services
    const scopeDetectionService = new ScopeDetectionService(vsCodeWorkspace);
    const configMappingService = new ConfigurationMappingService();
    const htmlInjectionService = new HtmlInjectionService();
    const configPersistenceService = new ConfigurationPersistenceService(
      vsCodeWorkspace,
      configuration,
      scopeDetectionService,
      configMappingService,
      languageClientAdapter,
      Logger,
    );
    const messageHandlerFactory = new MessageHandlerFactory(vsCodeCommands, configPersistenceService, Logger);

    this.workspaceConfigurationProvider = new WorkspaceConfigurationWebviewProvider(
      extensionContext,
      Logger,
      vsCodeCommands,
      vsCodeWorkspace,
      configuration,
      htmlInjectionService,
      configMappingService,
      scopeDetectionService,
      messageHandlerFactory,
    );

    // Connect the workspace configuration provider to the language server
    // so it can update the token in the webview when authentication completes
    this.languageServer.setWorkspaceConfigurationProvider(this.workspaceConfigurationProvider);

    this.commandController = new CommandController(
      this.openerService,
      this.authService,
      this.snykCode,
      this.iacService,
      this.ossService,
      vsCodeWorkspace,
      vsCodeCommands,
      vsCodeWindow,
      vsCodeEnv,
      this.languageServer,
      Logger,
      configuration,
      this.folderConfigs,
    );
    this.registerCommands(vscodeContext);

    const codeSecurityIssueProvider = new CodeSecurityIssueTreeProvider(
      Logger,
      this.viewManagerService,
      this.contextService,
      this.snykCode,
      configuration,
      vsCodeLanguages,
      this.folderConfigs,
    );

    const securityCodeView = SNYK_VIEW_ANALYSIS_CODE_SECURITY;
    const codeSecurityTree = vscode.window.createTreeView(securityCodeView, {
      treeDataProvider: codeSecurityIssueProvider,
    });

    const codeSecurityTreeViewService = new ProductTreeViewService(
      codeSecurityTree,
      codeSecurityIssueProvider,
      this.languageServer,
      LsScanProduct.Code,
    );
    vscodeContext.subscriptions.push(
      vscode.window.registerTreeDataProvider(securityCodeView, codeSecurityIssueProvider),
      codeSecurityTree,
      codeSecurityTreeViewService,
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
      Logger,
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

    const ossSecurityTreeViewService = new ProductTreeViewService(
      ossSecurityTree,
      ossIssueProvider,
      this.languageServer,
      LsScanProduct.OpenSource,
    );

    vscodeContext.subscriptions.push(
      vscode.window.registerTreeDataProvider(SNYK_VIEW_ANALYSIS_OSS, ossIssueProvider),
      ossSecurityTree,
      ossSecurityTreeViewService,
    );

    const iacIssueProvider = new IacIssueTreeProvider(
      Logger,
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

    const iacSecurityTreeViewService = new ProductTreeViewService(
      iacSecurityTree,
      iacIssueProvider,
      this.languageServer,
      LsScanProduct.InfrastructureAsCode,
    );

    vscodeContext.subscriptions.push(
      vscode.window.registerTreeDataProvider(SNYK_VIEW_ANALYSIS_IAC, iacIssueProvider),
      iacSecurityTree,
      iacSecurityTreeViewService,
    );

    // Fill the view container to expose views for tests
    const viewContainer = this.viewManagerService.viewContainer;
    viewContainer.set(SNYK_VIEW_WELCOME, welcomeTree);

    vscode.workspace.onDidChangeWorkspaceFolders(e => {
      this.workspaceTrust.resetTrustedFoldersCache();
      e.removed.forEach(folder => {
        this.snykCode.resetResult(folder.uri.fsPath);
      });
      void this.runScan();
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

    // Skip LS initialization during integration tests to prevent LS interferening with tests
    if (process.env.SNYK_INTEGRATION_TEST_MODE === 'true') return;

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

    await this.sendPluginInstalledEvent();

    // Actually start analysis
    void this.runScan();
  }

  private async sendPluginInstalledEvent() {
    // Use file locking to prevent race conditions when multiple windows activate simultaneously
    const lockService = new FileLockService(extensionContext.globalStoragePath);

    let shouldShowModal = false;

    try {
      await lockService.withLock('plugin-installed-event', async () => {
        // Check if plugin installed event was already sent (while holding lock)
        const pluginInstalledSent =
          extensionContext.getGlobalStateValue<boolean>(MEMENTO_ANALYTICS_PLUGIN_INSTALLED_SENT) ?? false;

        if (pluginInstalledSent) {
          return;
        }

        // Start analytics sender and send plugin installed event
        const analyticsSender = AnalyticsSender.getInstance(Logger, configuration, vsCodeCommands, this.contextService);

        const category = ['install'];
        const pluginInstalledEvent = new AnalyticsEvent(this.user.anonymousId, 'plugin installed', category);
        void extensionContext.updateGlobalStateValue(MEMENTO_ANALYTICS_PLUGIN_INSTALLED_SENT, true);
        analyticsSender.logEvent(pluginInstalledEvent, () => {});

        // Check if secure at inception modal was already shown (while holding lock)
        const secureAtInceptionModal =
          extensionContext.getGlobalStateValue<boolean>(MEMENTO_SECURE_AT_INCEPTION_MODAL) ?? false;

        if (!secureAtInceptionModal) {
          await extensionContext.updateGlobalStateValue(MEMENTO_SECURE_AT_INCEPTION_MODAL, true);
          shouldShowModal = true;
        }
      });
    } catch (err) {
      // If we fail to acquire lock (e.g., another window is handling this), just skip
      Logger.debug(`Failed to acquire lock for plugin installed event: ${err}`);
      return;
    }

    // Show modal outside of lock (doesn't need protection, only one window will reach here)
    if (shouldShowModal) {
      await this.configureSecureAtInception();
    }
  }

  async configureSecureAtInception() {
    await extensionContext.updateGlobalStateValue(MEMENTO_SECURE_AT_INCEPTION_MODAL, true);
    const options = ['Yes'] as const;
    const picked = await vscode.window.showInformationMessage(
      'Do you want to enable Snyk to automatically scan and secure AI generated code?',
      {
        modal: true,
        detail:
          ' Consider enabling this if you’re using an AI agent in your IDE. You can customize the scan frequency on Snyk Security’s settings page.',
      },
      ...options,
    );

    if (picked) {
      await configuration.setAutoConfigureMcpServer(true);
      await configuration.setSecureAtInceptionExecutionFrequency('On Code Generation');
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
      vscode.commands.registerCommand(SNYK_INITIATE_LOGOUT_COMMAND, () => this.commandController.initiateLogout()),
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
      vscode.commands.registerCommand(SNYK_SETTINGS_COMMAND, async () => {
        const useHTMLSettings = configuration.getPreviewFeature(HTML_SETTINGS);
        if (useHTMLSettings) {
          await this.workspaceConfigurationProvider?.showPanel();
        } else {
          this.commandController.openSettings();
        }
      }),
      vscode.commands.registerCommand(SNYK_DCIGNORE_COMMAND, (custom: boolean, path?: string) =>
        this.commandController.createDCIgnore(custom, new UriAdapter(), path),
      ),
      vscode.commands.registerCommand(SNYK_OPEN_ISSUE_COMMAND, (arg: OpenIssueCommandArg) =>
        this.commandController.openIssueCommand(arg),
      ),
      vscode.commands.registerCommand(SNYK_SHOW_OUTPUT_COMMAND, () => this.commandController.showOutputChannel()),
      vscode.commands.registerCommand(SNYK_SHOW_LS_OUTPUT_COMMAND, (presentableError?: PresentableError) =>
        this.commandController.showLsOutputChannel(presentableError),
      ),
      vscode.commands.registerCommand(SNYK_IGNORE_ISSUE_COMMAND, IgnoreCommand.ignoreIssues),
      vscode.commands.registerCommand(SNYK_SET_DELTA_REFERENCE_COMMAND, async (folderPath: string) => {
        const referenceBranch = 'Select a reference branch';
        const referenceDirectory = 'Select a reference directory';
        const options = [referenceBranch, referenceDirectory];
        const selection = await vscode.window.showQuickPick(options, {
          placeHolder: 'Choose an option',
        });

        if (selection === referenceBranch) {
          return this.commandController.setBaseBranch(folderPath);
        } else if (selection === referenceDirectory) {
          return this.commandController.setReferenceFolder(folderPath);
        }
      }),

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
