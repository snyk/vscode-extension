import * as vscode from 'vscode';
import { IExtension } from './base/modules/interfaces';
import SnykLib from './base/modules/snykLib';
import { AuthenticationService } from './base/services/authenticationService';
import { EmptyTreeDataProvider } from './base/views/emptyTreeDataProvider';
import { FeaturesViewProvider } from './base/views/featureSelection/featuresViewProvider';
import { SupportProvider } from './base/views/supportProvider';
import { StaticCliApi } from './cli/api/staticCliApi';
import { CliDownloadService } from './cli/services/cliDownloadService';
import { Iteratively } from './common/analytics/itly';
import { CommandController } from './common/commands/commandController';
import { configuration } from './common/configuration/instance';
import {
  SNYK_COPY_AUTH_LINK_COMMAND,
  SNYK_DCIGNORE_COMMAND,
  SNYK_ENABLE_CODE_COMMAND,
  SNYK_IGNORE_ISSUE_COMMAND,
  SNYK_LOGIN_COMMAND,
  SNYK_OPEN_BROWSER_COMMAND,
  SNYK_OPEN_ISSUE_COMMAND,
  SNYK_OPEN_LOCAL_COMMAND,
  SNYK_SETMODE_COMMAND,
  SNYK_SETTINGS_COMMAND,
  SNYK_SHOW_OUTPUT_COMMAND,
  SNYK_START_COMMAND,
} from './common/constants/commands';
import { MEMENTO_FIRST_INSTALL_DATE_KEY } from './common/constants/globalState';
import {
  SNYK_VIEW_ANALYSIS_CODE_ENABLEMENT,
  SNYK_VIEW_ANALYSIS_CODE_QUALITY,
  SNYK_VIEW_ANALYSIS_CODE_SECURITY,
  SNYK_VIEW_ANALYSIS_OSS,
  SNYK_VIEW_FEATURES,
  SNYK_VIEW_SUPPORT,
  SNYK_VIEW_WELCOME,
} from './common/constants/views';
import { ExperimentService } from './common/experiment/services/experimentService';
import { Logger } from './common/logger/logger';
import { errorsLogs } from './common/messages/errorsServerLogMessages';
import { NotificationService } from './common/services/notificationService';
import { User } from './common/user';
import { CodeActionKindAdapter } from './common/vscode/codeAction';
import { vsCodeComands } from './common/vscode/commands';
import { extensionContext } from './common/vscode/extensionContext';
import { vsCodeLanguages, VSCodeLanguages } from './common/vscode/languages';
import { ThemeColorAdapter } from './common/vscode/theme';
import { vsCodeWindow } from './common/vscode/window';
import { vsCodeWorkspace } from './common/vscode/workspace';
import SettingsWatcher from './common/watchers/settingsWatcher';
import { IgnoreCommand } from './snykCode/codeActions/ignoreCommand';
import { SnykCodeService } from './snykCode/codeService';
import { CodeQualityIssueTreeProvider } from './snykCode/views/qualityIssueTreeProvider';
import { CodeSecurityIssueTreeProvider } from './snykCode/views/securityIssueTreeProvider';
import { EditorDecorator } from './snykOss/editor/editorDecorator';
import { OssService } from './snykOss/services/ossService';
import { NpmModuleInfoFetchService } from './snykOss/services/vulnerabilityCount/npmModuleInfoFetchService';
import { OssVulnerabilityCountService } from './snykOss/services/vulnerabilityCount/ossVulnerabilityCountService';
import { ModuleVulnerabilityCountProvider } from './snykOss/services/vulnerabilityCount/vulnerabilityCountProvider';
import { OssVulnerabilityTreeProvider } from './snykOss/views/ossVulnerabilityTreeProvider';
import { OssSuggestionWebviewProvider } from './snykOss/views/suggestion/ossSuggestionWebviewProvider';
import { DailyScanJob } from './snykOss/watchers/dailyScanJob';

class SnykExtension extends SnykLib implements IExtension {
  public async activate(vscodeContext: vscode.ExtensionContext): Promise<void> {
    extensionContext.setContext(vscodeContext);
    this.context = extensionContext;

    this.user = await User.get(this.context);

    this.analytics = new Iteratively(this.user, Logger, configuration.shouldReportEvents, configuration.isDevelopment);

    this.settingsWatcher = new SettingsWatcher(this.analytics);
    this.notificationService = new NotificationService(vsCodeWindow, vsCodeComands, configuration, this.analytics);

    this.statusBarItem.show();

    this.authService = new AuthenticationService(
      this.contextService,
      this.openerService,
      this,
      configuration,
      this.analytics,
      Logger,
    );

    this.snykCode = new SnykCodeService(
      this.context,
      configuration,
      this.openerService,
      this.viewManagerService,
      this.contextService,
      vsCodeWorkspace,
      this.snykApiClient,
      Logger,
      this.analytics,
      new VSCodeLanguages(),
    );

    this.cliDownloadService = new CliDownloadService(this.context, new StaticCliApi(), vsCodeWindow, Logger);
    this.ossService = new OssService(
      this.context,
      Logger,
      configuration,
      new OssSuggestionWebviewProvider(this.context, vsCodeWindow),
      vsCodeWorkspace,
      this.viewManagerService,
      this.cliDownloadService,
      new DailyScanJob(this),
      this.notificationService,
      this.analytics,
    );

    this.commandController = new CommandController(
      this.openerService,
      this.authService,
      this.snykCode,
      this.ossService,
      this.scanModeService,
      Logger,
      this.analytics,
    );
    this.registerCommands(vscodeContext);

    const codeSecurityIssueProvider = new CodeSecurityIssueTreeProvider(
        this.viewManagerService,
        this.contextService,
        this.snykCode,
        configuration,
      ),
      codeQualityIssueProvider = new CodeQualityIssueTreeProvider(
        this.viewManagerService,
        this.contextService,
        this.snykCode,
        configuration,
      );

    const ossVulnerabilityProvider = new OssVulnerabilityTreeProvider(
      this.viewManagerService,
      this.contextService,
      this.ossService,
      configuration,
    );

    const featuresViewProvider = new FeaturesViewProvider(vscodeContext.extensionUri, this.contextService);

    vscodeContext.subscriptions.push(
      vscode.window.registerWebviewViewProvider(SNYK_VIEW_FEATURES, featuresViewProvider),
      vscode.window.registerTreeDataProvider(SNYK_VIEW_ANALYSIS_OSS, ossVulnerabilityProvider),
      vscode.window.registerTreeDataProvider(SNYK_VIEW_ANALYSIS_CODE_SECURITY, codeSecurityIssueProvider),
      vscode.window.registerTreeDataProvider(SNYK_VIEW_ANALYSIS_CODE_QUALITY, codeQualityIssueProvider),
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
    const codeSecurityTree = vscode.window.createTreeView(SNYK_VIEW_ANALYSIS_CODE_SECURITY, {
      treeDataProvider: codeSecurityIssueProvider,
    });
    const codeQualityTree = vscode.window.createTreeView(SNYK_VIEW_ANALYSIS_CODE_QUALITY, {
      treeDataProvider: codeQualityIssueProvider,
    });
    vscodeContext.subscriptions.push(
      ossTree.onDidChangeVisibility(e => this.onDidChangeOssTreeVisibility(e.visible)),
      codeSecurityTree,
      codeQualityTree,
      welcomeTree.onDidChangeVisibility(e => this.onDidChangeWelcomeViewVisibility(e.visible)),
      codeEnablementTree,
    );

    // Fill the view container to expose views for tests
    const viewContainer = this.viewManagerService.viewContainer;
    viewContainer.set(SNYK_VIEW_WELCOME, welcomeTree);
    viewContainer.set(SNYK_VIEW_FEATURES, featuresViewProvider);

    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      this.runScan(false);
    });

    this.editorsWatcher.activate(this);
    this.settingsWatcher.activate(this);
    this.snykCode.suggestionProvider.activate(this); // todo: wire the same way as OSS
    this.ossService.activateSuggestionProvider();
    this.ossService.activateManifestFileWatcher(this);

    void this.notificationService.init(this.processError.bind(this));

    this.checkAdvancedMode().catch(err =>
      this.processError(err, {
        message: errorsLogs.checkAdvancedMode,
      }),
    );

    await this.analytics.load();
    this.experimentService = new ExperimentService(this.user, this.context, Logger, configuration);
    await this.experimentService.load();

    this.logPluginIsInstalled();

    this.initCliDownload();

    const npmModuleInfoFetchService = new NpmModuleInfoFetchService(configuration, Logger);
    this.ossVulnerabilityCountService = new OssVulnerabilityCountService(
      vsCodeWorkspace,
      vsCodeWindow,
      vsCodeLanguages,
      new ModuleVulnerabilityCountProvider(this.ossService, npmModuleInfoFetchService),
      this.ossService,
      Logger,
      new EditorDecorator(vsCodeWindow, vsCodeLanguages, new ThemeColorAdapter()),
      new CodeActionKindAdapter(),
      this.analytics,
    );
    this.ossVulnerabilityCountService.activate();

    // Actually start analysis
    this.runScan();
  }

  public async deactivate(): Promise<void> {
    this.snykCode.dispose();
    this.ossVulnerabilityCountService.dispose();
    await this.analytics.flush();
  }

  private logPluginIsInstalled(): void {
    // Use memento until lifecycle hooks are implemented
    // https://github.com/microsoft/vscode/issues/98732
    if (!this.context.getGlobalStateValue(MEMENTO_FIRST_INSTALL_DATE_KEY)) {
      this.analytics.logPluginIsInstalled();
      void this.context.updateGlobalStateValue(MEMENTO_FIRST_INSTALL_DATE_KEY, Date.now());
    }
  }

  private initCliDownload(): CliDownloadService {
    this.cliDownloadService.downloadOrUpdateCli().catch(err => {
      this.ossService?.handleCliDownloadFailure(err);
    });

    return this.cliDownloadService;
  }

  private registerCommands(context: vscode.ExtensionContext): void {
    // todo: move common callbacks to the CommandController, verify if all commands work
    context.subscriptions.push(
      vscode.commands.registerCommand(
        SNYK_OPEN_BROWSER_COMMAND,
        this.commandController.openBrowser.bind(this.commandController),
      ),
      vscode.commands.registerCommand(
        SNYK_COPY_AUTH_LINK_COMMAND,
        this.commandController.copyAuthLink.bind(this.commandController),
      ),
      vscode.commands.registerCommand(SNYK_OPEN_LOCAL_COMMAND, this.commandController.openLocal.bind(this)),
      vscode.commands.registerCommand(
        SNYK_LOGIN_COMMAND,
        this.commandController.initiateLogin.bind(this.commandController),
      ),
      vscode.commands.registerCommand(SNYK_ENABLE_CODE_COMMAND, () =>
        this.commandController.executeCommand(SNYK_ENABLE_CODE_COMMAND, this.enableCode.bind(this)),
      ),
      vscode.commands.registerCommand(SNYK_START_COMMAND, () =>
        this.commandController.executeCommand(SNYK_START_COMMAND, this.runScan.bind(this), true),
      ),
      vscode.commands.registerCommand(SNYK_SETMODE_COMMAND, this.commandController.setScanMode.bind(this)),
      vscode.commands.registerCommand(SNYK_SETTINGS_COMMAND, this.commandController.openSettings.bind(this)),
      vscode.commands.registerCommand(SNYK_DCIGNORE_COMMAND, this.commandController.createDCIgnore.bind(this)),
      vscode.commands.registerCommand(SNYK_OPEN_ISSUE_COMMAND, this.commandController.openIssueCommand.bind(this)),
      vscode.commands.registerCommand(
        SNYK_SHOW_OUTPUT_COMMAND,
        this.commandController.showOutputChannel.bind(this.commandController),
      ),
      vscode.commands.registerCommand(SNYK_IGNORE_ISSUE_COMMAND, IgnoreCommand.ignoreIssues),
    );
  }
}

export default SnykExtension;
