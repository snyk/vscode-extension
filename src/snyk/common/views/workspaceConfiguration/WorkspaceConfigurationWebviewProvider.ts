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
import {
  ADVANCED_AUTOMATIC_DEPENDENCY_MANAGEMENT,
  ADVANCED_CLI_BASE_DOWNLOAD_URL,
  ADVANCED_CLI_PATH,
  ADVANCED_CLI_RELEASE_CHANNEL,
} from '../../constants/settings';
import { SNYK_WORKSPACE_CONFIGURATION_COMMAND } from '../../constants/commands';
import { IConfiguration, Configuration } from '../../configuration/configuration';
import { IWorkspaceConfigurationWebviewProvider } from './types/workspaceConfiguration.types';
import { IHtmlInjectionService } from './services/HtmlInjectionService';
import { IConfigurationMappingService } from './services/ConfigurationMappingService';
import { IScopeDetectionService } from './services/ScopeDetectionService';
import { IMessageHandlerFactory } from './handlers/MessageHandlerFactory';

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
        'icon.png',
      );

      const html = await this.fetchConfigurationHtml();

      if (html) {
        const htmlWithScopes = this.scopeDetectionService.populateScopeIndicators(
          html,
          this.configMappingService.mapHtmlKeyToVSCodeSetting.bind(this.configMappingService),
        );
        this.panel.webview.html = this.htmlInjectionService.injectIdeScripts(htmlWithScopes);
      } else {
        const fallbackHtml = this.getFallbackHtml();
        this.panel.webview.html = this.htmlInjectionService.injectIdeScripts(fallbackHtml);
      }
    } catch (e) {
      ErrorHandler.handle(e, this.logger, 'Failed to show workspace configuration panel');
    }
  }

  private async fetchConfigurationHtml(): Promise<string | undefined> {
    const maxRetries = 3;
    const timeoutMs = 3000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.debug(`Fetching configuration HTML from LS (attempt ${attempt}/${maxRetries})`);

        const result = await Promise.race([
          this.commandExecutor.executeCommand<string>(SNYK_WORKSPACE_CONFIGURATION_COMMAND, 'ls'),
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
      }
    }
    return undefined;
  }

  private getFallbackHtml(): string {
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

      const { configurationId: manageBinConfigId, section: manageBinSection } = Configuration.getConfigName(
        ADVANCED_AUTOMATIC_DEPENDENCY_MANAGEMENT,
      );
      const manageBinaries = this.workspace.getConfiguration<boolean>(manageBinConfigId, manageBinSection) ?? false;

      const { configurationId: cliBaseUrlConfigId, section: cliBaseUrlSection } =
        Configuration.getConfigName(ADVANCED_CLI_BASE_DOWNLOAD_URL);
      const cliBaseDownloadUrl =
        this.workspace.getConfiguration<string>(cliBaseUrlConfigId, cliBaseUrlSection) ?? 'https://downloads.snyk.io';

      const { configurationId: cliPathConfigId, section: cliPathSection } =
        Configuration.getConfigName(ADVANCED_CLI_PATH);
      const cliPath = this.workspace.getConfiguration<string>(cliPathConfigId, cliPathSection) ?? '';

      const { configurationId: cliReleaseConfigId, section: cliReleaseSection } =
        Configuration.getConfigName(ADVANCED_CLI_RELEASE_CHANNEL);
      const cliReleaseChannel =
        this.workspace.getConfiguration<string>(cliReleaseConfigId, cliReleaseSection) ?? 'stable';

      const strictSSL = this.workspace.getConfiguration<boolean>('http', 'proxyStrictSSL') ?? true;
      const insecure = !strictSSL;

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
      return this.getErrorHtml('Failed to load settings fallback page.');
    }
  }

  private getErrorHtml(errorMessage: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-errorForeground);
      background-color: var(--vscode-editor-background);
      padding: 16px;
    }
  </style>
</head>
<body>
  <h2>Configuration Error</h2>
  <p>${errorMessage}</p>
</body>
</html>`;
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

  protected onPanelDispose(): void {
    super.onPanelDispose();
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
