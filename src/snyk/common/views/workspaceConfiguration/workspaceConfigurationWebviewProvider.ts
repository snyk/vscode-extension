// ABOUTME: WebviewProvider for displaying the workspace configuration HTML settings page
// ABOUTME: from snyk-ls instead of VS Code's native settings (refactored with service layer)
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { WebviewProvider } from '../webviewProvider';
import { ExtensionContext } from '../../vscode/extensionContext';
import { ILog } from '../../logger/interfaces';
import { IVSCodeCommands } from '../../vscode/commands';
import { IVSCodeWorkspace } from '../../vscode/workspace';
import { ErrorHandler } from '../../error/errorHandler';
import { SNYK_WORKSPACE_CONFIGURATION_COMMAND } from '../../constants/commands';
import { IConfiguration } from '../../configuration/configuration';
import { IWorkspaceConfigurationWebviewProvider } from './types/workspaceConfiguration.types';
import { IHtmlInjectionService } from './services/htmlInjectionService';
import { IConfigurationMappingService } from './services/configurationMappingService';
import { IScopeDetectionService } from './services/scopeDetectionService';
import { IMessageHandlerFactory } from './handlers/messageHandlerFactory';

const SNYK_VIEW_WORKSPACE_CONFIGURATION = 'snyk.views.workspaceConfiguration';
const WORKSPACE_CONFIGURATION_PANEL_TITLE = 'Snyk Workspace Configuration';

export class WorkspaceConfigurationWebviewProvider
  extends WebviewProvider<void>
  implements IWorkspaceConfigurationWebviewProvider
{
  constructor(
    protected readonly context: ExtensionContext,
    protected readonly logger: ILog,
    private readonly commandExecutor: IVSCodeCommands,
    private readonly workspace: IVSCodeWorkspace,
    private readonly configuration: IConfiguration,
    private readonly htmlInjectionService: IHtmlInjectionService,
    private readonly configMappingService: IConfigurationMappingService,
    private readonly scopeDetectionService: IScopeDetectionService,
    private readonly messageHandlerFactory: IMessageHandlerFactory,
  ) {
    super(context, logger);
  }

  activate(): void {}

  getWebviewOptions(): vscode.WebviewPanelOptions & vscode.WebviewOptions {
    return {
      ...super.getWebviewOptions(),
      retainContextWhenHidden: true,
    };
  }

  async showPanel(): Promise<void> {
    try {
      if (this.panel) {
        this.panel.title = WORKSPACE_CONFIGURATION_PANEL_TITLE;
        this.panel.reveal(vscode.ViewColumn.Active, false);
        return;
      }

      this.panel = vscode.window.createWebviewPanel(
        SNYK_VIEW_WORKSPACE_CONFIGURATION,
        WORKSPACE_CONFIGURATION_PANEL_TITLE,
        {
          viewColumn: vscode.ViewColumn.Active,
          preserveFocus: false,
        },
        this.getWebviewOptions(),
      );
      this.registerListeners();

      this.panel.iconPath = vscode.Uri.joinPath(
        vscode.Uri.file(this.context.extensionPath),
        'media',
        'images',
        'snyk_extension_icon_new.svg',
      );

      const html = await this.fetchConfigurationHtml();

      if (html) {
        const htmlWithScopes = this.scopeDetectionService.populateScopeIndicators(html, this.configMappingService);
        this.panel.webview.html = this.htmlInjectionService.injectIdeScripts(htmlWithScopes);
      } else {
        const fallbackHtml = await this.getFallbackHtml();
        this.panel.webview.html = this.htmlInjectionService.injectIdeScripts(fallbackHtml);
      }
    } catch (e) {
      ErrorHandler.handle(e, this.logger, 'Failed to show workspace configuration panel');
    }
  }

  private async fetchConfigurationHtml(): Promise<string | undefined> {
    return this.fetchWithRetry(1, 3, 3000);
  }

  private async fetchWithRetry(attempt: number, maxRetries: number, timeoutMs: number): Promise<string | undefined> {
    try {
      this.logger.debug(`Fetching configuration HTML from LS (attempt ${attempt}/${maxRetries})`);

      const result = await Promise.race([
        this.commandExecutor.executeCommand<string>(SNYK_WORKSPACE_CONFIGURATION_COMMAND),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Request timeout')), timeoutMs)),
      ]);

      return result;
    } catch (e) {
      if (attempt === maxRetries) {
        ErrorHandler.handle(
          e,
          this.logger,
          'Failed to fetch configuration HTML from language server after all retries',
        );
        return undefined;
      }
      this.logger.warn(`Failed to fetch configuration HTML (attempt ${attempt}/${maxRetries}): ${e}`);
      return this.fetchWithRetry(attempt + 1, maxRetries, timeoutMs);
    }
  }

  private async getFallbackHtml(): Promise<string> {
    try {
      const fallbackPath = path.join(
        this.context.extensionPath,
        'media',
        'views',
        'common',
        'configuration',
        'settings-fallback.html',
      );

      let html = fs.readFileSync(fallbackPath, 'utf-8');

      const manageBinaries = this.configuration.isAutomaticDependencyManagementEnabled();
      const cliBaseDownloadUrl = this.configuration.getCliBaseDownloadUrl();
      const cliPath = await this.configuration.getCliPath();
      const cliReleaseChannel = await this.configuration.getCliReleaseChannel();
      const insecure = this.configuration.getInsecure();

      html = html.replace(/\{\{MANAGE_BINARIES_CHECKED\}\}/g, manageBinaries ? 'checked' : '');
      html = html.replace(/\{\{CLI_BASE_DOWNLOAD_URL\}\}/g, cliBaseDownloadUrl);
      html = html.replace(/\{\{CLI_PATH\}\}/g, cliPath);
      html = html.replace(/\{\{CHANNEL_STABLE_SELECTED\}\}/g, cliReleaseChannel === 'stable' ? 'selected' : '');
      html = html.replace(/\{\{CHANNEL_RC_SELECTED\}\}/g, cliReleaseChannel === 'rc' ? 'selected' : '');
      html = html.replace(/\{\{CHANNEL_PREVIEW_SELECTED\}\}/g, cliReleaseChannel === 'preview' ? 'selected' : '');
      html = html.replace(/\{\{INSECURE_CHECKED\}\}/g, insecure ? 'checked' : '');

      return html;
    } catch (e) {
      this.logger.error(`Failed to load fallback HTML: ${e}`);
      throw e;
    }
  }

  protected registerListeners(): void {
    if (!this.panel) return;

    this.panel.onDidDispose(() => this.onPanelDispose(), null, this.disposables);
    this.panel.onDidChangeViewState(() => this.checkVisibility(), undefined, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      (msg: unknown) => this.messageHandlerFactory.handleMessage(msg),
      undefined,
      this.disposables,
    );
  }

  public setAuthToken(token: string): void {
    if (!this.panel) {
      this.logger.debug('Cannot set auth token: webview panel not initialized');
      return;
    }

    this.panel.webview
      .postMessage({
        type: 'setAuthToken',
        token: token,
      })
      .then(
        success => {
          if (success) {
            this.logger.debug('Successfully sent auth token to workspace configuration webview');
          } else {
            this.logger.warn('Failed to send auth token to workspace configuration webview');
          }
        },
        error => {
          this.logger.error(`Error sending auth token to workspace configuration webview: ${error}`);
        },
      );
  }
}
