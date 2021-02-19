import * as vscode from 'vscode';
import * as _ from 'lodash';
import open from 'open';

import { emitter, ISupportedFiles } from '@snyk/code-client';
import { ExtensionInterface } from '../interfaces/SnykInterfaces';
import SnykLib from './lib/modules/SnykLib';
import createFileWatcher from './lib/watchers/FilesWatcher';
import { COMMAND_DEBOUNCE_INTERVAL } from './constants/general';
import {
  SNYK_START_COMMAND,
  SNYK_SETMODE_COMMAND,
  SNYK_SETTINGS_COMMAND,
  SNYK_DCIGNORE_COMMAND,
  SNYK_LOGIN_COMMAND,
  SNYK_APPROVE_COMMAND,
  SNYK_OPEN_BROWSER_COMMAND,
  SNYK_OPEN_LOCAL_COMMAND,
  SNYK_OPEN_ISSUE_COMMAND,
} from './constants/commands';
import { SNYK_VIEW_SUPPORT, SNYK_VIEW_ANALYSIS, SNYK_ANALYSIS_STATUS } from './constants/views';
import { openSnykSettingsCommand, createDCIgnoreCommand } from './utils/vscodeCommandsUtils';
import { errorsLogs } from './messages/errorsServerLogMessages';
import { SupportProvider } from './view/SupportProvider';
import { IssueProvider } from './view/IssueProvider';

class SnykExtension extends SnykLib implements ExtensionInterface {
  context: vscode.ExtensionContext | undefined;
  private debouncedCommands: Record<string, _.DebouncedFunc<(...args: any[]) => Promise<any>>> = {};

  private async executeCommand(name: string, fn: (...args: any[]) => Promise<any>, ...args: any[]): Promise<any> {
    if (!this.debouncedCommands[name])
      this.debouncedCommands[name] = _.debounce(
        async (...args: any[]): Promise<any> => {
          try {
            return await fn(...args);
          } catch (error) {
            await this.processError(error, {
              message: errorsLogs.command(name),
            });
          }
        },
        COMMAND_DEBOUNCE_INTERVAL,
        { leading: true, trailing: false },
      );
    return this.debouncedCommands[name](...args);
  }

  public activate(context: vscode.ExtensionContext): void {
    this.context = context;
    emitter.on(emitter.events.supportedFilesLoaded, this.onSupportedFilesLoaded.bind(this));
    emitter.on(emitter.events.scanFilesProgress, this.onScanFilesProgress.bind(this));
    emitter.on(emitter.events.createBundleProgress, this.onCreateBundleProgress.bind(this));
    emitter.on(emitter.events.uploadBundleProgress, this.onUploadBundleProgress.bind(this));
    emitter.on(emitter.events.analyseProgress, this.onAnalyseProgress.bind(this));
    emitter.on(emitter.events.apiRequestLog, this.onAPIRequestLog.bind(this));
    emitter.on(emitter.events.error, this.onError.bind(this));

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
          () => {},
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
        SNYK_APPROVE_COMMAND,
        this.executeCommand.bind(this, SNYK_APPROVE_COMMAND, this.approveUpload.bind(this)),
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
            await this.trackViewSuggestion(suggestion.id, severity);
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

    this.checkWelcomeNotification().catch(err =>
      this.processError(err, {
        message: errorsLogs.welcomeNotification,
      }),
    );
    this.checkAdvancedMode().catch(err =>
      this.processError(err, {
        message: errorsLogs.checkAdvancedMode,
      }),
    );

    // Actually start analysis
    this.startExtension();
  }

  public deactivate(): void {
    emitter.removeAllListeners();
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
