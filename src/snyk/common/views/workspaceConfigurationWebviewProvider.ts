// ABOUTME: WebviewProvider for displaying the workspace configuration HTML settings page
// ABOUTME: from snyk-ls instead of VS Code's native settings
import * as vscode from 'vscode';
import { WebviewProvider } from './webviewProvider';
import { ExtensionContext } from '../vscode/extensionContext';
import { ILog } from '../logger/interfaces';
import { IVSCodeCommands } from '../vscode/commands';
import { IVSCodeWorkspace } from '../vscode/workspace';
import { ErrorHandler } from '../error/errorHandler';
import { CONFIGURATION_IDENTIFIER } from '../constants/settings';
import { hasPropertyOfType, hasOptionalPropertyOfType, isStringKeyedRecord } from '../tsUtil';

const SNYK_VIEW_WORKSPACE_CONFIGURATION = 'snyk.views.workspaceConfiguration';
const WORKSPACE_CONFIGURATION_PANEL_TITLE = 'Snyk Workspace Configuration';

export interface IWorkspaceConfigurationWebviewProvider {
  showPanel(): Promise<void>;
  disposePanel(): void;
}

export class WorkspaceConfigurationWebviewProvider
  extends WebviewProvider<void>
  implements IWorkspaceConfigurationWebviewProvider
{
  constructor(
    protected readonly context: ExtensionContext,
    protected readonly logger: ILog,
    private readonly commandExecutor: IVSCodeCommands,
    private readonly workspace: IVSCodeWorkspace,
  ) {
    super(context, logger);
  }

  activate(): void {
    // No serializer needed for now since we don't need to restore state
  }

  async showPanel(): Promise<void> {
    try {
      if (this.panel) {
        this.panel.title = WORKSPACE_CONFIGURATION_PANEL_TITLE;
        this.panel.reveal(vscode.ViewColumn.Active, false);
      } else {
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
      }

      this.panel.iconPath = vscode.Uri.joinPath(
        vscode.Uri.file(this.context.extensionPath),
        'media',
        'images',
        'icon.png',
      );

      // Fetch HTML from language server
      const html = await this.fetchConfigurationHtml();

      if (html) {
        this.panel.webview.html = this.injectIdeScripts(html);
      } else {
        this.panel.webview.html = this.getErrorHtml('Failed to load configuration from language server.');
      }
    } catch (e) {
      ErrorHandler.handle(e, this.logger, 'Failed to show workspace configuration panel');
    }
  }

  private injectIdeScripts(html: string): string {
    // Inject IDE-specific JavaScript functions that the webview can call
    const ideScript = `
      <script>
        (function() {
          const vscode = acquireVsCodeApi();

          window.__ideSaveConfig__ = function(jsonString) {
            vscode.postMessage({
              type: 'saveConfig',
              config: jsonString
            });
          };

          window.__ideLogin__ = function() {
            vscode.postMessage({
              type: 'login'
            });
          };

          window.__ideLogout__ = function() {
            vscode.postMessage({
              type: 'logout'
            });
          };
        })();
      </script>
    `;

    // Inject before closing body tag
    return html.replace('</body>', `${ideScript}</body>`);
  }

  private async fetchConfigurationHtml(): Promise<string | undefined> {
    try {
      const html = await this.commandExecutor.executeCommand<string>('snyk.workspace.configuration', 'ls');
      return html;
    } catch (e) {
      ErrorHandler.handle(e, this.logger, 'Failed to fetch configuration HTML from language server');
      return undefined;
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

    // Handle messages from the webview
    this.panel.webview.onDidReceiveMessage((msg: unknown) => this.handleMessage(msg), undefined, this.disposables);
  }

  private async refreshPanel(): Promise<void> {
    if (!this.panel) return;

    try {
      const html = await this.fetchConfigurationHtml();
      if (html) {
        this.panel.webview.html = this.injectIdeScripts(html);
        this.logger.info('Refreshed workspace configuration panel');
      }
    } catch (e) {
      this.logger.error(`Failed to refresh workspace configuration panel: ${e}`);
    }
  }

  private async handleMessage(message: unknown): Promise<void> {
    try {
      if (!this.isWebviewMessage(message)) {
        this.logger.warn('Received invalid message from workspace configuration webview');
        return;
      }

      switch (message.type) {
        case 'saveConfig':
          if (!message.config) {
            this.logger.warn('Received invalid configuration from workspace configuration webview');
            return;
          }
          await this.handleSaveConfig(message.config);
          break;
        case 'login':
          await this.handleLogin();
          break;
        case 'logout':
          await this.handleLogout();
          break;
        default:
          this.logger.warn(`Unknown message type from workspace configuration webview: ${message.type}`);
      }
    } catch (e) {
      this.logger.error(`Error handling message from workspace configuration webview: ${e}`);
    }
  }

  private isWebviewMessage(message: unknown): message is { type: string; config?: string } {
    return hasPropertyOfType(message, 'type', 'string') && hasOptionalPropertyOfType(message, 'config', 'string');
  }

  private async handleSaveConfig(configJson: string): Promise<void> {
    try {
      const config = JSON.parse(configJson) as unknown;
      if (!isStringKeyedRecord(config)) {
        throw new Error('Invalid configuration format: expected an object');
      }
      this.logger.info('Saving workspace configuration');

      await this.saveConfigToVSCodeSettings(config);

      this.logger.info('Workspace configuration saved successfully');
    } catch (e) {
      this.logger.error(`Failed to save workspace configuration: ${e}`);
      throw e;
    }
  }

  private async saveConfigToVSCodeSettings(config: Record<string, unknown>): Promise<void> {
    this.logger.info('Writing configuration to VS Code settings');

    const settingsMap = this.mapConfigToSettings(config);

    const updates = Object.entries(settingsMap).map(async ([settingKey, value]) => {
      try {
        // Extract the configuration section and key
        const settingName = settingKey.replace(`${CONFIGURATION_IDENTIFIER}.`, '');

        await this.workspace.updateConfiguration(
          CONFIGURATION_IDENTIFIER,
          settingName,
          value,
          true, // TODO - We will write back to the level it was previously set at.
        );

        this.logger.debug(`Updated setting: ${settingKey}`);
      } catch (e) {
        this.logger.error(`Failed to update setting ${settingKey}: ${e}`);
        throw new Error(`Failed to save setting ${settingKey}: ${e}`);
      }
    });

    await Promise.all(updates);

    this.logger.info('Successfully wrote all settings to VS Code configuration');
  }

  private mapConfigToSettings(config: Record<string, unknown>): Record<string, unknown> {
    const settings: Record<string, unknown> = {};

    const fieldMappings: Record<string, string> = {
      endpoint: 'snyk.advanced.customEndpoint',
      authenticationMethod: 'snyk.advanced.authenticationMethod',
      insecure: 'snyk.advanced.insecure',
      organization: 'snyk.advanced.organization',
      activateSnykOpenSource: 'snyk.features.openSourceSecurity',
      activateSnykCode: 'snyk.features.codeSecurity',
      activateSnykIac: 'snyk.features.infrastructureAsCode',
      scanningMode: 'snyk.scanningMode',
      additionalParams: 'snyk.advanced.additionalParameters',
    };

    for (const [htmlField, vscodeSetting] of Object.entries(fieldMappings)) {
      const fieldValue = config[htmlField];
      if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
        let value: unknown = fieldValue;
        if (value === 'true') value = true;
        if (value === 'false') value = false;
        settings[vscodeSetting] = value;
      }
    }

    const enableDeltaFindings = config.enableDeltaFindings;
    if (enableDeltaFindings !== undefined) {
      const value = enableDeltaFindings === 'true' || enableDeltaFindings === true;
      settings['snyk.allIssuesVsNetNewIssues'] = value ? 'Net new issues' : 'All issues';
    }

    const filterSeverity = config.filterSeverity;
    if (filterSeverity !== undefined && filterSeverity !== null) {
      settings['snyk.severity'] = filterSeverity;
    }

    const issueViewOptions = config.issueViewOptions;
    if (issueViewOptions !== undefined && issueViewOptions !== null) {
      settings['snyk.issueViewOptions'] = issueViewOptions;
    }

    const folderConfigs = config.folderConfigs;
    if (Array.isArray(folderConfigs) && folderConfigs.length > 0) {
      settings['snyk.folderConfigs'] = folderConfigs;
    }

    return settings;
  }

  private async handleLogin(): Promise<void> {
    this.logger.info('Triggering login from workspace configuration');
    await this.commandExecutor.executeCommand('snyk.initiateLogin');
  }

  private async handleLogout(): Promise<void> {
    this.logger.info('Triggering logout from workspace configuration');
    await this.commandExecutor.executeCommand('snyk.logout');
  }

  protected onPanelDispose(): void {
    super.onPanelDispose();
  }
}
