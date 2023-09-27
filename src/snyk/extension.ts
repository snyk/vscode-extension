import * as vscode from 'vscode';
import AdvisorProvider from './advisor/services/advisorProvider';
import { AdvisorService } from './advisor/services/advisorService';
import { IExtension } from './base/modules/interfaces';
import SnykLib from './base/modules/snykLib';
import { AuthenticationService } from './base/services/authenticationService';
import { ScanModeService } from './base/services/scanModeService';
import { EmptyTreeDataProvider } from './base/views/emptyTreeDataProvider';
import { SupportProvider } from './base/views/supportProvider';
import { messages } from './cli/messages/messages';
import { Iteratively } from './common/analytics/itly';
import { CommandController } from './common/commands/commandController';
import { OpenIssueCommandArg } from './common/commands/types';
import { configuration } from './common/configuration/instance';
import { SnykConfiguration } from './common/configuration/snykConfiguration';
import {
  SNYK_DCIGNORE_COMMAND,
  SNYK_ENABLE_CODE_COMMAND,
  SNYK_IGNORE_ISSUE_COMMAND,
  SNYK_INITIATE_LOGIN_COMMAND,
  SNYK_OPEN_BROWSER_COMMAND,
  SNYK_OPEN_ISSUE_COMMAND,
  SNYK_OPEN_LOCAL_COMMAND,
  SNYK_SET_TOKEN_COMMAND,
  SNYK_SETTINGS_COMMAND,
  SNYK_SHOW_LS_OUTPUT_COMMAND,
  SNYK_SHOW_OUTPUT_COMMAND,
  SNYK_START_COMMAND,
  SNYK_WORKSPACE_SCAN_COMMAND,
} from './common/constants/commands';
import { MEMENTO_FIRST_INSTALL_DATE_KEY } from './common/constants/globalState';
import {
  SNYK_CONTEXT,
  SNYK_VIEW_ANALYSIS_CODE_ENABLEMENT,
  SNYK_VIEW_ANALYSIS_CODE_QUALITY,
  SNYK_VIEW_ANALYSIS_CODE_SECURITY,
  SNYK_VIEW_ANALYSIS_IAC,
  SNYK_VIEW_ANALYSIS_OSS,
  SNYK_VIEW_SUPPORT,
  SNYK_VIEW_WELCOME,
} from './common/constants/views';
import { ErrorHandler } from './common/error/errorHandler';
import { ErrorReporter } from './common/error/errorReporter';
import { ExperimentService } from './common/experiment/services/experimentService';
import { LanguageServer } from './common/languageServer/languageServer';
import { StaticLsApi } from './common/languageServer/staticLsApi';
import { Logger } from './common/logger/logger';
import { DownloadService } from './common/services/downloadService';
import { LearnService } from './common/services/learnService';
import { NotificationService } from './common/services/notificationService';
import { User } from './common/user';
import { CodeActionAdapter, CodeActionKindAdapter } from './common/vscode/codeAction';
import { vsCodeCommands } from './common/vscode/commands';
import { vsCodeEnv } from './common/vscode/env';
import { extensionContext } from './common/vscode/extensionContext';
import { HoverAdapter } from './common/vscode/hover';
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
import { OssService } from './snykOss/services/ossService';
import { OssVulnerabilityCountService } from './snykOss/services/vulnerabilityCount/ossVulnerabilityCountService';
import { ModuleVulnerabilityCountProvider } from './snykOss/services/vulnerabilityCount/vulnerabilityCountProvider';
import { OssVulnerabilityTreeProvider } from './snykOss/views/ossVulnerabilityTreeProvider';
import { OssSuggestionWebviewProvider } from './snykOss/views/suggestion/ossSuggestionWebviewProvider';
import { DailyScanJob } from './snykOss/watchers/dailyScanJob';

class SnykExtension extends SnykLib implements IExtension {
  public async activate(vscodeContext: vscode.ExtensionContext): Promise<void> {
    extensionContext.setContext(vscodeContext);
    this.context = extensionContext;

    const snykConfiguration = await this.getSnykConfiguration();
    if (snykConfiguration) {
      await ErrorReporter.init(configuration, snykConfiguration, extensionContext.extensionPath, vsCodeEnv, Logger);
    }

    try {
      await this.initializeExtension(vscodeContext, snykConfiguration);
    } catch (e) {
      ErrorHandler.handle(e, Logger);
    }
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
    await this.contextService.setContext(SNYK_CONTEXT.NOT_LOADING, false);

    // default to true, as the check is async and can only be done after startup of LS
    // if set to true, the option to enable code is not shown in the initialization phase
    await this.contextService.setContext(SNYK_CONTEXT.CODE_ENABLED, true);

    // set the workspace context so that the text to add folders is only shown if really the case
    // initializing after LS startup and just before scan is too late
    const workspacePaths = vsCodeWorkspace.getWorkspaceFolders();
    await this.setWorkspaceContext(workspacePaths);

    this.user = await User.getAnonymous(this.context, Logger);

    this.analytics = new Iteratively(
      this.user,
      Logger,
      configuration.shouldReportEvents,
      configuration.isFedramp,
      configuration.isDevelopment,
      snykConfiguration,
    );

    SecretStorageAdapter.init(vscodeContext);

    this.configurationWatcher = new ConfigurationWatcher(this.analytics, Logger);
    this.notificationService = new NotificationService(
      vsCodeWindow,
      vsCodeCommands,
      configuration,
      this.analytics,
      Logger,
    );

    this.statusBarItem.show();

    const languageClientAdapter = new LanguageClientAdapter();
    this.authService = new AuthenticationService(
      this.contextService,
      this,
      configuration,
      vsCodeWindow,
      this.analytics,
      Logger,
      languageClientAdapter,
      vsCodeCommands,
    );

    this.learnService = new LearnService(vsCodeCommands);

    this.codeSettings = new CodeSettings(this.contextService, configuration, this.openerService, vsCodeCommands);

    this.scanModeService = new ScanModeService(this.contextService, configuration, this.analytics);

    this.advisorService = new AdvisorProvider(this.advisorApiClient, Logger);
    this.downloadService = new DownloadService(
      this.context,
      configuration,
      new StaticLsApi(vsCodeWorkspace, configuration, Logger),
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
    );

    const codeSuggestionProvider = new CodeSuggestionWebviewProvider(
      vsCodeWindow,
      extensionContext,
      Logger,
      vsCodeLanguages,
      vsCodeWorkspace,
      this.learnService,
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
      Logger,
      this.analytics,
    );

    this.ossService = new OssService(
      this.context,
      Logger,
      configuration,
      new OssSuggestionWebviewProvider(this.context, vsCodeWindow, Logger, this.learnService),
      vsCodeWorkspace,
      this.viewManagerService,
      this.downloadService,
      new DailyScanJob(this),
      this.notificationService,
      this.analytics,
      this.languageServer,
      this.workspaceTrust,
    );

    const iacSuggestionProvider = new IacSuggestionWebviewProvider(
      vsCodeWindow,
      extensionContext,
      Logger,
      vsCodeLanguages,
      vsCodeWorkspace,
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
      Logger,
      this.analytics,
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
      this.analytics,
    );
    this.registerCommands(vscodeContext);

    const codeSecurityIssueProvider = new CodeSecurityIssueTreeProvider(
        this.viewManagerService,
        this.contextService,
        this.snykCode,
        configuration,
        vsCodeLanguages,
      ),
      codeQualityIssueProvider = new CodeQualityIssueTreeProvider(
        this.viewManagerService,
        this.contextService,
        this.snykCode,
        configuration,
        vsCodeLanguages,
      );

    const codeSecurityTree = vscode.window.createTreeView(SNYK_VIEW_ANALYSIS_CODE_SECURITY, {
      treeDataProvider: codeSecurityIssueProvider,
    });
    const codeQualityTree = vscode.window.createTreeView(SNYK_VIEW_ANALYSIS_CODE_QUALITY, {
      treeDataProvider: codeQualityIssueProvider,
    });

    vscodeContext.subscriptions.push(
      vscode.window.registerTreeDataProvider(SNYK_VIEW_ANALYSIS_CODE_SECURITY, codeSecurityIssueProvider),
      vscode.window.registerTreeDataProvider(SNYK_VIEW_ANALYSIS_CODE_QUALITY, codeQualityIssueProvider),
      codeSecurityTree,
      codeQualityTree,
    );

    const ossVulnerabilityProvider = new OssVulnerabilityTreeProvider(
      this.viewManagerService,
      this.contextService,
      this.ossService,
      configuration,
    );

    vscodeContext.subscriptions.push(
      vscode.window.registerTreeDataProvider(SNYK_VIEW_ANALYSIS_OSS, ossVulnerabilityProvider),
      vscode.window.registerTreeDataProvider(SNYK_VIEW_SUPPORT, new SupportProvider()),
    );

    const welcomeTree = vscode.window.createTreeView(SNYK_VIEW_WELCOME, {
      treeDataProvider: new EmptyTreeDataProvider(),
    });
    const codeEnablementTree = vscode.window.createTreeView(SNYK_VIEW_ANALYSIS_CODE_ENABLEMENT, {
      treeDataProvider: new EmptyTreeDataProvider(),
    });

    const ossTree = vscode.window.createTreeView(SNYK_VIEW_ANALYSIS_OSS, {
      treeDataProvider: ossVulnerabilityProvider,
    });

    vscodeContext.subscriptions.push(
      ossTree.onDidChangeVisibility(e => this.onDidChangeOssTreeVisibility(e.visible)),
      welcomeTree.onDidChangeVisibility(e => this.onDidChangeWelcomeViewVisibility(e.visible)),
      codeEnablementTree,
    );

    const iacIssueProvider = new IacIssueTreeProvider(
      this.viewManagerService,
      this.contextService,
      this.iacService,
      configuration,
      vsCodeLanguages,
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
        this.snykCode.resetResult(folder.uri.path);
      });
      this.runScan(false);
    });

    this.editorsWatcher.activate(this);
    this.configurationWatcher.activate(this);
    this.snykCode.activateWebviewProviders();
    this.ossService.activateSuggestionProvider();
    this.ossService.activateManifestFileWatcher(this);
    this.iacService.activateWebviewProviders();

    // noinspection ES6MissingAwait
    void this.notificationService.init();

    this.checkAdvancedMode().catch(err => ErrorReporter.capture(err));

    this.analytics.load();
    this.experimentService.load();

    this.logPluginIsInstalled();

    this.initDependencyDownload();

    this.ossVulnerabilityCountService = new OssVulnerabilityCountService(
      vsCodeWorkspace,
      vsCodeWindow,
      vsCodeLanguages,
      new ModuleVulnerabilityCountProvider(
        this.ossService,
        languageClientAdapter,
        new UriAdapter(),
        new TextDocumentAdapter(),
      ),
      this.ossService,
      Logger,
      new EditorDecorator(vsCodeWindow, vsCodeLanguages, new ThemeColorAdapter()),
      new CodeActionKindAdapter(),
      this.analytics,
      configuration,
    );
    this.ossVulnerabilityCountService.activate();

    this.advisorScoreDisposable = new AdvisorService(
      vsCodeWindow,
      vsCodeLanguages,
      this.advisorService,
      Logger,
      vsCodeWorkspace,
      this.advisorApiClient,
      new ThemeColorAdapter(),
      new HoverAdapter(),
      this.markdownStringAdapter,
      configuration,
    );

    // noinspection ES6MissingAwait
    void this.advisorScoreDisposable.activate();

    // Wait for LS startup to finish before updating the codeEnabled context
    // The codeEnabled context depends on an LS command
    await this.languageServer.start();

    // initialize contexts
    const loggedIn = await configuration.getToken();
    if (loggedIn != undefined) {
      await this.contextService.setContext(SNYK_CONTEXT.LOGGEDIN, true);
    }
    await this.contextService.setContext(SNYK_CONTEXT.NOT_LOADING, true);
    await this.codeSettings.updateIsCodeEnabled();

    // Actually start analysis
    this.runScan();
  }

  public async deactivate(): Promise<void> {
    this.ossVulnerabilityCountService.dispose();
    await this.languageServer.stop();
    await this.analytics.flush();
    await ErrorReporter.flush();
  }

  public async restartLanguageServer(): Promise<void> {
    await this.languageServer.stop();
    await this.languageServer.start();
  }

  private logPluginIsInstalled(): void {
    // Use memento until lifecycle hooks are implemented
    // https://github.com/microsoft/vscode/issues/98732
    if (!this.context.getGlobalStateValue(MEMENTO_FIRST_INSTALL_DATE_KEY)) {
      this.analytics.logPluginIsInstalled();
      void this.context.updateGlobalStateValue(MEMENTO_FIRST_INSTALL_DATE_KEY, Date.now());
    }
  }

  private initDependencyDownload(): DownloadService {
    this.downloadService.downloadOrUpdate().catch(err => {
      Logger.error(`${messages.lsDownloadFailed} ${ErrorHandler.stringifyError(err)}`);
      this.ossService?.handleLsDownloadFailure();
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
      vscode.commands.registerCommand(SNYK_ENABLE_CODE_COMMAND, () =>
        this.commandController.executeCommand(SNYK_ENABLE_CODE_COMMAND, () => this.enableCode()),
      ),
      vscode.commands.registerCommand(SNYK_START_COMMAND, async () => {
        await vscode.commands.executeCommand(SNYK_WORKSPACE_SCAN_COMMAND);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        await this.commandController.executeCommand(SNYK_START_COMMAND, () => this.runScan(true)); // todo: remove once OSS scans replaced with LS
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
    );
  }
}

export default SnykExtension;
