import { ISupportedFiles } from '@snyk/code-client';
import * as _ from 'lodash';
import * as vscode from 'vscode';
import {
  SNYK_COPY_AUTH_LINK_COMMAND,
  SNYK_DCIGNORE_COMMAND,
  SNYK_ENABLE_CODE_COMMAND,
  SNYK_LOGIN_COMMAND,
  SNYK_OPEN_BROWSER_COMMAND,
  SNYK_OPEN_ISSUE_COMMAND,
  SNYK_OPEN_LOCAL_COMMAND,
  SNYK_SETMODE_COMMAND,
  SNYK_SETTINGS_COMMAND,
  SNYK_START_COMMAND,
} from './common/constants/commands';
import { COMMAND_DEBOUNCE_INTERVAL } from './common/constants/general';
import { MEMENTO_FIRST_INSTALL_DATE_KEY } from './common/constants/globalState';
import {
  SNYK_VIEW_ANALYSIS_CODE_QUALITY,
  SNYK_VIEW_ANALYSIS_CODE_SECURITY,
  SNYK_VIEW_WELCOME,
  SNYK_VIEW_SUPPORT,
  SNYK_VIEW_FEATURES,
} from './common/constants/views';
import SnykLib from './base/modules/snykLib';
import { errorsLogs } from './common/messages/errorsServerLogMessages';
import { NotificationService } from './common/services/notificationService';
import { severityAsText } from './snykCode/utils/analysisUtils';
import { createDCIgnoreCommand, openSnykSettingsCommand } from './common/vscodeCommandsUtils';
import { EmptyTreeDataProvider } from './base/views/emptyTreeDataProvider';
import { CodeQualityIssueProvider } from './snykCode/views/qualityIssueProvider';
import { SupportProvider } from './base/views/supportProvider';
import { FeaturesViewProvider } from './base/views/welcome/welcomeViewProvider';
import { CodeSecurityIssueProvider } from './snykCode/views/securityIssueProvider';
import { analytics } from './common/analytics/analytics';
import { IExtension } from './base/modules/interfaces';

class SnykExtension extends SnykLib implements IExtension {
  context: vscode.ExtensionContext | undefined;
  private debouncedCommands: Record<string, _.DebouncedFunc<(...args: any[]) => Promise<any>>> = {};

  private async executeCommand(name: string, fn: (...args: any[]) => Promise<any>, ...args: any[]): Promise<any> {
    if (!this.debouncedCommands[name])
      this.debouncedCommands[name] = _.debounce(
        // eslint-disable-next-line no-shadow
        async (...args: any[]): Promise<any> => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return await fn(...args);
          } catch (error) {
            await this.processError(error, {
              message: errorsLogs.command(name),
            });
            return Promise.resolve();
          }
        },
        COMMAND_DEBOUNCE_INTERVAL,
        { leading: true, trailing: false },
      );
    return this.debouncedCommands[name](...args);
  }

  public activate(context: vscode.ExtensionContext): void {
    this.context = context;

    this.statusBarItem.show();

    this.registerCommands(context);

    const codeSecurityIssueProvider = new CodeSecurityIssueProvider(
        this.viewManagerService,
        this.contextService,
        this.snykCode,
      ),
      codeQualityIssueProvider = new CodeQualityIssueProvider(
        this.viewManagerService,
        this.contextService,
        this.snykCode,
      );

    const featuresViewProvider = new FeaturesViewProvider(context.extensionUri, this.contextService);

    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(SNYK_VIEW_FEATURES, featuresViewProvider),
      vscode.window.registerTreeDataProvider(SNYK_VIEW_ANALYSIS_CODE_SECURITY, codeSecurityIssueProvider),
      vscode.window.registerTreeDataProvider(SNYK_VIEW_ANALYSIS_CODE_QUALITY, codeQualityIssueProvider),
      vscode.window.registerTreeDataProvider(SNYK_VIEW_SUPPORT, new SupportProvider()),
    );

    const welcomeTree = vscode.window.createTreeView(SNYK_VIEW_WELCOME, {
      treeDataProvider: new EmptyTreeDataProvider(),
    });

    const codeSecurityTree = vscode.window.createTreeView(SNYK_VIEW_ANALYSIS_CODE_SECURITY, {
      treeDataProvider: codeSecurityIssueProvider,
    });
    const codeQualityTree = vscode.window.createTreeView(SNYK_VIEW_ANALYSIS_CODE_QUALITY, {
      treeDataProvider: codeQualityIssueProvider,
    });
    context.subscriptions.push(
      codeSecurityTree,
      codeQualityTree,
      welcomeTree.onDidChangeVisibility(e => this.onDidChangeWelcomeViewVisibility(e.visible)),
    );

    // Fill the view container to expose views for tests
    const viewContainer = this.viewManagerService.viewContainer;
    viewContainer.set(SNYK_VIEW_WELCOME, welcomeTree);
    viewContainer.set(SNYK_VIEW_FEATURES, featuresViewProvider);

    vscode.workspace.onDidChangeWorkspaceFolders(this.startExtension.bind(this));

    this.editorsWatcher.activate(this);
    this.settingsWatcher.activate(this);
    this.snykCode.suggestionProvider.activate(this);

    void NotificationService.init(this.processError.bind(this));

    this.checkAdvancedMode().catch(err =>
      this.processError(err, {
        message: errorsLogs.checkAdvancedMode,
      }),
    );

    analytics.load();

    // Use memento until lifecycle hooks are implemented
    // https://github.com/microsoft/vscode/issues/98732
    if (!context.globalState.get(MEMENTO_FIRST_INSTALL_DATE_KEY)) {
      analytics.logPluginIsInstalled();
      void context.globalState.update(MEMENTO_FIRST_INSTALL_DATE_KEY, Date.now());
    }

    // Actually start analysis
    this.startExtension();
  }

  public async deactivate(): Promise<void> {
    this.snykCode.dispose();
    await analytics.flush();
  }

  private registerCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        SNYK_OPEN_BROWSER_COMMAND,
        this.executeCommand.bind(this, SNYK_OPEN_BROWSER_COMMAND, (url: string) =>
          this.openerService.openBrowserUrl(url),
        ),
      ),
      vscode.commands.registerCommand(
        SNYK_COPY_AUTH_LINK_COMMAND,
        this.executeCommand.bind(
          this,
          SNYK_COPY_AUTH_LINK_COMMAND,
          this.openerService.copyOpenedUrl.bind(this.openerService),
        ),
      ),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(SNYK_OPEN_LOCAL_COMMAND, async (path: vscode.Uri, range?: vscode.Range) => {
        await vscode.window.showTextDocument(path, { viewColumn: vscode.ViewColumn.One, selection: range }).then(
          () => undefined,
          // no need to wait for processError since catch is called asynchronously as well
          err =>
            this.processError(err, {
              message: errorsLogs.command(SNYK_OPEN_LOCAL_COMMAND),
            }),
        );
      }),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        SNYK_LOGIN_COMMAND,
        this.executeCommand.bind(this, SNYK_LOGIN_COMMAND, this.initiateLogin.bind(this)),
      ),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        SNYK_ENABLE_CODE_COMMAND,
        this.executeCommand.bind(this, SNYK_ENABLE_CODE_COMMAND, this.enableCode.bind(this)),
      ),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        SNYK_START_COMMAND,
        this.executeCommand.bind(this, SNYK_START_COMMAND, this.startExtension.bind(this), true),
      ),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        SNYK_SETMODE_COMMAND,
        this.executeCommand.bind(this, SNYK_SETMODE_COMMAND, this.setMode.bind(this)),
      ),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        SNYK_SETTINGS_COMMAND,
        this.executeCommand.bind(this, SNYK_SETTINGS_COMMAND, openSnykSettingsCommand),
      ),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        SNYK_OPEN_ISSUE_COMMAND,
        this.executeCommand.bind(
          this,
          SNYK_OPEN_ISSUE_COMMAND,
          async (
            message: string,
            uri: vscode.Uri,
            range: vscode.Range,
            openUri?: vscode.Uri,
            openRange?: vscode.Range,
          ) => {
            const suggestion = this.snykCode.analyzer.findSuggestion(message);
            if (!suggestion) return;
            // Set openUri = null to avoid opening the file (e.g. in the ActionProvider)
            if (openUri !== null)
              await vscode.commands.executeCommand(SNYK_OPEN_LOCAL_COMMAND, openUri || uri, openRange || range);
            this.snykCode.suggestionProvider.show(suggestion.id, uri, range);
            suggestion.id = decodeURIComponent(suggestion.id);

            analytics.logIssueIsViewed({
              ide: 'Visual Studio Code',
              issueId: suggestion.id,
              issueType: 'Code Security Vulnerability',
              severity: severityAsText(suggestion.severity),
            });
          },
        ),
      ),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        SNYK_DCIGNORE_COMMAND,
        this.executeCommand.bind(this, SNYK_DCIGNORE_COMMAND, createDCIgnoreCommand),
      ),
    );
  }
}

export default SnykExtension;
