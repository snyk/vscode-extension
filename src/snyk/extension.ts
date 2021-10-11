import * as vscode from 'vscode';
import { snykMessages } from './base/messages/snykMessages';
import { IExtension } from './base/modules/interfaces';
import SnykLib from './base/modules/snykLib';
import { EmptyTreeDataProvider } from './base/views/emptyTreeDataProvider';
import { FeaturesViewProvider } from './base/views/featureSelection/featuresViewProvider';
import { SupportProvider } from './base/views/supportProvider';
import { StaticCliApi } from './cli/api/staticCliApi';
import { messages as cliMessages } from './cli/messages/messages';
import { CliDownloadService } from './cli/services/cliDownloadService';
import { analytics } from './common/analytics/analytics';
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
  SNYK_VIEW_ANALYSIS_CODE_QUALITY,
  SNYK_VIEW_ANALYSIS_CODE_SECURITY,
  SNYK_VIEW_ANALYSIS_OSS,
  SNYK_VIEW_FEATURES,
  SNYK_VIEW_SUPPORT,
  SNYK_VIEW_WELCOME,
} from './common/constants/views';
import { Logger } from './common/logger/logger';
import { errorsLogs } from './common/messages/errorsServerLogMessages';
import { extensionContext } from './common/vscode/extensionContext';
import { vsCodeWindow } from './common/vscode/window';
import { vsCodeWorkspace } from './common/vscode/workspace';
import { IgnoreCommand } from './snykCode/codeActionsProvider/ignoreCommand';
import { SnykCodeService } from './snykCode/codeService';
import { CodeQualityIssueTreeProvider } from './snykCode/views/qualityIssueTreeProvider';
import { CodeSecurityIssueTreeProvider } from './snykCode/views/securityIssueTreeProvider';
import { OssService } from './snykOss/services/ossService';
import { OssVulnerabilityTreeProvider } from './snykOss/views/ossVulnerabilityTreeProvider';
import { OssSuggestionWebviewProvider } from './snykOss/views/suggestion/ossSuggestionWebviewProvider';
import { DailyScanJob } from './snykOss/watchers/dailyScanJob';

class SnykExtension extends SnykLib implements IExtension {
  public activate(vscodeContext: vscode.ExtensionContext): void {
    extensionContext.setContext(vscodeContext);
    this.context = extensionContext;

    this.statusBarItem.show();

    this.snykCode = new SnykCodeService(
      this.context,
      configuration,
      this.openerService,
      this.viewManagerService,
      vsCodeWorkspace,
      this.processError.bind(this),
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
      analytics,
    );

    this.commandController = new CommandController(
      this.openerService,
      this.snykCode,
      this.ossService,
      this.scanModeService,
      Logger,
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

    analytics.load();

    // Use memento until lifecycle hooks are implemented
    // https://github.com/microsoft/vscode/issues/98732
    if (!this.context.getGlobalStateValue(MEMENTO_FIRST_INSTALL_DATE_KEY)) {
      analytics.logPluginIsInstalled();
      void this.context.updateGlobalStateValue(MEMENTO_FIRST_INSTALL_DATE_KEY, Date.now());
    }

    this.initCliDownload();

    // Actually start analysis
    this.runScan();
  }

  public async deactivate(): Promise<void> {
    this.snykCode.dispose();
    await analytics.flush();
  }

  private initCliDownload(): CliDownloadService {
    this.cliDownloadService.downloadOrUpdateCli().catch(err => {
      const errorMsg = cliMessages.cliDownloadFailed;
      Logger.error(`${errorMsg} ${err}`);
      void this.notificationService.showErrorNotification(`${errorMsg} ${snykMessages.errorQuery}`);
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
      vscode.commands.registerCommand(SNYK_LOGIN_COMMAND, () =>
        this.commandController.executeCommand(SNYK_LOGIN_COMMAND, this.initiateLogin.bind(this)),
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
