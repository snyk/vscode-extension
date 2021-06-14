import { emitter, ISupportedFiles } from '@snyk/code-client';
import { EmitterDC } from '@snyk/code-client/dist/emitter';
import * as _ from 'lodash';
import open from 'open';
import * as vscode from 'vscode';
import { ExtensionInterface } from '../interfaces/SnykInterfaces';
import {
  SNYK_DCIGNORE_COMMAND,
  SNYK_ENABLE_CODE_COMMAND,
  SNYK_LOGIN_COMMAND,
  SNYK_OPEN_BROWSER_COMMAND,
  SNYK_OPEN_ISSUE_COMMAND,
  SNYK_OPEN_LOCAL_COMMAND,
  SNYK_SETMODE_COMMAND,
  SNYK_SETTINGS_COMMAND,
  SNYK_START_COMMAND,
} from './constants/commands';
import { COMMAND_DEBOUNCE_INTERVAL } from './constants/general';
import { SNYK_ANALYSIS_STATUS, SNYK_VIEW_ANALYSIS, SNYK_VIEW_SUPPORT } from './constants/views';
import BundlesModule from './lib/modules/BundlesModule';
import SnykLib from './lib/modules/SnykLib';
import createFileWatcher from './lib/watchers/FilesWatcher';
import { errorsLogs } from './messages/errorsServerLogMessages';
import { NotificationService } from './services/notificationService';
import { severityAsText } from './utils/analysisUtils';
import { createDCIgnoreCommand, openSnykSettingsCommand } from './utils/vscodeCommandsUtils';
import { IssueProvider } from './view/IssueProvider';
import { SupportProvider } from './view/SupportProvider';

class SnykExtension extends SnykLib implements ExtensionInterface {
  context: vscode.ExtensionContext | undefined;
  private debouncedCommands: Record<string, _.DebouncedFunc<(...args: any[]) => Promise<any>>> = {};
  private emitter: EmitterDC;

  constructor() {
    super();
    this.emitter = emitter;
  }

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
    this.emitter.on(this.emitter.events.supportedFilesLoaded, this.onSupportedFilesLoaded.bind(this));
    this.emitter.on(this.emitter.events.scanFilesProgress, this.onScanFilesProgress.bind(this));
    this.emitter.on(this.emitter.events.createBundleProgress, this.onCreateBundleProgress.bind(this));
    this.emitter.on(this.emitter.events.uploadBundleProgress, this.onUploadBundleProgress.bind(this));
    this.emitter.on(this.emitter.events.analyseProgress, this.onAnalyseProgress.bind(this));
    this.emitter.on(this.emitter.events.apiRequestLog, BundlesModule.onAPIRequestLog.bind(this));
    this.emitter.on(this.emitter.events.error, this.onError.bind(this));

    this.statusBarItem.show();

    context.subscriptions.push(
      vscode.commands.registerCommand(
        SNYK_OPEN_BROWSER_COMMAND,
        this.executeCommand.bind(this, SNYK_OPEN_BROWSER_COMMAND, (url: string) => open(url)),
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
        this.executeCommand.bind(this, SNYK_START_COMMAND, this.startExtension.bind(this)),
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
            severity: number,
            uri: vscode.Uri,
            range: vscode.Range,
            openUri?: vscode.Uri,
            openRange?: vscode.Range,
          ) => {
            const suggestion = this.analyzer.findSuggestion(message);
            if (!suggestion) return;
            // Set openUri = null to avoid opening the file (e.g. in the ActionProvider)
            if (openUri !== null)
              await vscode.commands.executeCommand(SNYK_OPEN_LOCAL_COMMAND, openUri || uri, openRange || range);
            this.suggestionProvider.show(suggestion.id, uri, range);
            suggestion.id = decodeURIComponent(suggestion.id);
            await this.trackViewSuggestion(suggestion.id, severity);

            this.analytics.logEvent('Issue Is Viewed', {
              ide: 'Visual Studio Code',
              issueId: suggestion.id,
              issueType: 'Code Security Vulnerability',
              severity: severityAsText(suggestion.severity),
              userId: this.userId,
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

    vscode.window.registerTreeDataProvider(SNYK_VIEW_SUPPORT, new SupportProvider(this));

    vscode.window.registerTreeDataProvider(SNYK_VIEW_ANALYSIS, new IssueProvider(this));

    vscode.workspace.onDidChangeWorkspaceFolders(this.startExtension.bind(this));

    this.editorsWatcher.activate(this);
    this.settingsWatcher.activate(this);
    this.analyzer.activate(this);
    this.suggestionProvider.activate(this);

    void NotificationService.init(this.processEvent.bind(this), this.processError.bind(this));

    this.checkAdvancedMode().catch(err =>
      this.processError(err, {
        message: errorsLogs.checkAdvancedMode,
      }),
    );

    // Actually start analysis
    this.startExtension();
  }

  public deactivate(): void {
    this.emitter.removeAllListeners();
  }

  onSupportedFilesLoaded(data: ISupportedFiles | null) {
    const msg = data ? 'Ignore rules loading' : 'Loading';

    this.updateStatus(SNYK_ANALYSIS_STATUS.FILTERS, msg);

    // Setup file watcher
    if (!this.filesWatcher && data) {
      this.filesWatcher = createFileWatcher(this, data);
    }
  }
}

export default SnykExtension;
