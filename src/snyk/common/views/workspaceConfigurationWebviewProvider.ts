// ABOUTME: WebviewProvider for displaying the workspace configuration HTML settings page
// ABOUTME: from snyk-ls instead of VS Code's native settings
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { WebviewProvider } from './webviewProvider';
import { ExtensionContext } from '../vscode/extensionContext';
import { ILog } from '../logger/interfaces';
import { IVSCodeCommands } from '../vscode/commands';
import { IVSCodeWorkspace } from '../vscode/workspace';
import { ErrorHandler } from '../error/errorHandler';
import { CONFIGURATION_IDENTIFIER } from '../constants/settings';
import { hasPropertyOfType, hasOptionalPropertyOfType } from '../tsUtil';
import { getNonce } from './nonce';

const SNYK_VIEW_WORKSPACE_CONFIGURATION = 'snyk.views.workspaceConfiguration';
const WORKSPACE_CONFIGURATION_PANEL_TITLE = 'Snyk Workspace Configuration';

// Configuration data types matching the structure from Language Server HTML
export interface IssueViewOptions {
  openIssues?: boolean;
  ignoredIssues?: boolean;
}

export interface FilterSeverity {
  critical?: boolean;
  high?: boolean;
  medium?: boolean;
  low?: boolean;
}

export interface FolderConfigData {
  additionalParameters?: string;
  additionalEnv?: string;
  preferredOrg?: string;
  autoDeterminedOrg?: string;
  orgSetByUser?: boolean;
  scanCommandConfig?: Record<string, unknown>;
}

export interface IdeConfigData {
  // Scan Settings
  activateSnykOpenSource?: boolean;
  activateSnykCode?: boolean;
  activateSnykIac?: boolean;
  scanningMode?: string;

  // Issue View Settings
  issueViewOptions?: IssueViewOptions;
  enableDeltaFindings?: boolean;

  // Authentication Settings
  authenticationMethod?: string;

  // Connection Settings
  endpoint?: string;
  token?: string;
  organization?: string;
  insecure?: boolean;

  // Trusted Folders
  trustedFolders?: string[];

  // CLI Settings
  cliPath?: string;
  manageBinariesAutomatically?: boolean;
  baseUrl?: string;
  cliReleaseChannel?: string;

  // Filter Settings
  filterSeverity?: FilterSeverity;
  riskScoreThreshold?: number;

  // Folder Configs
  folderConfigs?: FolderConfigData[];
}

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

  getWebviewOptions(): vscode.WebviewPanelOptions & vscode.WebviewOptions {
    return {
      ...super.getWebviewOptions(),
      retainContextWhenHidden: true, // Preserve webview state when switching tabs
    };
  }

  async showPanel(): Promise<void> {
    try {
      if (this.panel) {
        this.panel.title = WORKSPACE_CONFIGURATION_PANEL_TITLE;
        this.panel.reveal(vscode.ViewColumn.Active, false);
        return; // Don't regenerate HTML, preserve webview state
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

      // Fetch HTML from language server (only on first creation)
      const html = await this.fetchConfigurationHtml();

      if (html) {
        // Populate scope indicators before injecting scripts
        const htmlWithScopes = this.populateScopeIndicators(html);
        this.panel.webview.html = this.injectIdeScripts(htmlWithScopes);
      } else {
        // Use fallback HTML when LS is not available (no scope indicators needed)
        const fallbackHtml = this.getFallbackHtml();
        this.panel.webview.html = this.injectIdeScripts(fallbackHtml);
      }
    } catch (e) {
      ErrorHandler.handle(e, this.logger, 'Failed to show workspace configuration panel');
    }
  }

  private injectIdeScripts(html: string): string {
    // Generate nonce for CSP
    const nonce = getNonce();

    // Add CSS for scope indicators and VSCode theme variables
    const scopeStyles = `
      <style nonce="${nonce}">
        :root {
          --text-color: var(--vscode-foreground);
          --background-color: var(--vscode-editor-background);
          --section-background-color: var(--vscode-sideBar-background);
          --border-color: var(--vscode-panel-border);
          --focus-color: var(--vscode-focusBorder);
          --link-color: var(--vscode-textLink-foreground);
          --input-background-color: var(--vscode-input-background);
          --default-font: var(--vscode-font-family);
        }
        .scope-indicator {
          font-style: italic;
          opacity: 0.6;
          font-size: 0.9em;
          margin-left: 4px;
        }
      </style>
    `;

    // Inject IDE-specific JavaScript functions that the webview can call
    const ideScript = `
      <script nonce="${nonce}">
        (function() {
          const vscode = acquireVsCodeApi();

          window.__saveIdeConfig__ = function(jsonString) {
            vscode.postMessage({
              type: 'saveConfig',
              config: jsonString
            });
          };

          window.__IS_IDE_AUTOSAVE_ENABLED__ = true;

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

    // Replace nonce-ideNonce placeholder with actual nonce (if HTML from LS uses this pattern)
    html = html.replace(/ideNonce/g, `${nonce}`);

    // Inject styles before closing head tag
    html = html.replace('</head>', `${scopeStyles}</head>`);

    // Inject scripts before closing body tag
    return html.replace('</body>', `${ideScript}</body>`);
  }

  private async fetchConfigurationHtml(): Promise<string | undefined> {
    const maxRetries = 3;
    const timeoutMs = 3000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.debug(`Fetching configuration HTML from LS (attempt ${attempt}/${maxRetries})`);

        const result = await Promise.race([
          this.commandExecutor.executeCommand<string>('snyk.workspace.configuration', 'ls'),
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

      // Get current settings from workspace using typed configuration methods
      const manageBinaries =
        this.workspace.getConfiguration<boolean>(CONFIGURATION_IDENTIFIER, 'advanced.automaticDependencyManagement') ??
        false;
      const cliBaseDownloadUrl =
        this.workspace.getConfiguration<string>(CONFIGURATION_IDENTIFIER, 'advanced.cliBaseDownloadUrl') ??
        'https://downloads.snyk.io';
      const cliPath = this.workspace.getConfiguration<string>(CONFIGURATION_IDENTIFIER, 'advanced.cliPath') ?? '';
      const cliReleaseChannel =
        this.workspace.getConfiguration<string>(CONFIGURATION_IDENTIFIER, 'advanced.cliReleaseChannel') ?? 'stable';
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

    // Handle messages from the webview
    this.panel.webview.onDidReceiveMessage((msg: unknown) => this.handleMessage(msg), undefined, this.disposables);
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
      const config = JSON.parse(configJson) as IdeConfigData;
      this.logger.info('Saving workspace configuration');

      await this.saveConfigToVSCodeSettings(config);

      this.logger.info('Workspace configuration saved successfully');
    } catch (e) {
      this.logger.error(`Failed to save workspace configuration: ${e}`);
      throw e;
    }
  }

  private async saveConfigToVSCodeSettings(config: IdeConfigData): Promise<void> {
    this.logger.info('Writing configuration to VS Code settings');

    const settingsMap = this.mapConfigToSettings(config);

    const updates = Object.entries(settingsMap).map(async ([settingKey, value]) => {
      try {
        // Parse the setting key to extract configuration identifier and setting name
        const parts = settingKey.split('.');
        const configurationId = parts[0];
        const settingName = parts.slice(1).join('.');

        // Detect current scope
        const scope = this.getSettingScope(settingKey);

        // Skip writing if value is at default and hasn't been explicitly set by user
        if (scope === 'default') {
          const inspection = this.workspace.inspectConfiguration(configurationId, settingName);
          const isDefaultValue = inspection && JSON.stringify(value) === JSON.stringify(inspection.defaultValue);

          if (isDefaultValue) {
            this.logger.debug(`Skipping ${settingKey}: value is at default and not explicitly set`);
            return;
          }
        }

        await this.workspace.updateConfiguration(configurationId, settingName, value, scope !== 'workspace');

        this.logger.debug(`Updated setting: ${settingKey} at ${scope} level`);
      } catch (e) {
        this.logger.error(`Failed to update setting ${settingKey}: ${e}`);
      }
    });

    await Promise.all(updates);

    this.logger.info('Successfully wrote all settings to VS Code configuration');
  }

  private mapConfigToSettings(config: IdeConfigData): Record<string, unknown> {
    const settings: Record<string, unknown> = {};

    // Scan Settings
    if (config.activateSnykOpenSource !== undefined) {
      settings['snyk.features.openSourceSecurity'] = config.activateSnykOpenSource;
    }
    if (config.activateSnykCode !== undefined) {
      settings['snyk.features.codeSecurity'] = config.activateSnykCode;
    }
    if (config.activateSnykIac !== undefined) {
      settings['snyk.features.infrastructureAsCode'] = config.activateSnykIac;
    }
    if (config.scanningMode !== undefined && config.scanningMode !== '') {
      settings['snyk.scanningMode'] = config.scanningMode;
    }

    // Issue View Settings
    if (config.issueViewOptions !== undefined) {
      settings['snyk.issueViewOptions'] = config.issueViewOptions;
    }
    if (config.enableDeltaFindings !== undefined) {
      settings['snyk.allIssuesVsNetNewIssues'] = config.enableDeltaFindings ? 'Net new issues' : 'All issues';
    }

    // Authentication Settings
    if (config.authenticationMethod !== undefined && config.authenticationMethod !== '') {
      settings['snyk.advanced.authenticationMethod'] = config.authenticationMethod;
    }

    // Connection Settings
    if (config.endpoint !== undefined && config.endpoint !== '') {
      settings['snyk.advanced.customEndpoint'] = config.endpoint;
    }
    if (config.organization !== undefined && config.organization !== '') {
      settings['snyk.advanced.organization'] = config.organization;
    }
    if (config.insecure !== undefined) {
      // insecure maps to http.proxyStrictSSL with inverted value
      settings['http.proxyStrictSSL'] = !config.insecure;
    }

    // Trusted Folders
    if (config.trustedFolders !== undefined && config.trustedFolders.length > 0) {
      settings['snyk.trustedFolders'] = config.trustedFolders;
    }

    // CLI Settings
    if (config.cliPath !== undefined && config.cliPath !== '') {
      settings['snyk.advanced.cliPath'] = config.cliPath;
    }
    if (config.manageBinariesAutomatically !== undefined) {
      settings['snyk.advanced.automaticDependencyManagement'] = config.manageBinariesAutomatically;
    }
    if (config.baseUrl !== undefined && config.baseUrl !== '') {
      settings['snyk.advanced.cliBaseDownloadUrl'] = config.baseUrl;
    }
    if (config.cliReleaseChannel !== undefined && config.cliReleaseChannel !== '') {
      settings['snyk.advanced.cliReleaseChannel'] = config.cliReleaseChannel;
    }

    // Filter Settings
    if (config.filterSeverity !== undefined) {
      settings['snyk.severity'] = config.filterSeverity;
    }

    if (config.riskScoreThreshold !== undefined) {
      settings['snyk.riskScoreThreshold'] = config.riskScoreThreshold;
    }

    // Folder Configs
    if (config.folderConfigs !== undefined && config.folderConfigs.length > 0) {
      settings['snyk.folderConfigs'] = config.folderConfigs;
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

  private getSettingScope(settingKey: string): 'user' | 'workspace' | 'workspaceFolder' | 'default' {
    // Parse the setting key to extract configuration identifier and setting name
    const parts = settingKey.split('.');
    const configurationId = parts[0];
    const settingName = parts.slice(1).join('.');

    const inspection = this.workspace.inspectConfiguration(configurationId, settingName);

    if (!inspection) return 'default';

    // Priority: workspaceFolderValue > workspaceValue > globalValue
    if (inspection.workspaceFolderValue !== undefined) return 'workspaceFolder';
    if (inspection.workspaceValue !== undefined) return 'workspace';
    if (inspection.globalValue !== undefined) return 'user';
    return 'default';
  }

  private mapHtmlKeyToVSCodeSetting(htmlKey: string): string | undefined {
    // Handle special cases like filterSeverity_critical
    if (htmlKey.startsWith('filterSeverity_')) {
      const severity = htmlKey.replace('filterSeverity_', '');
      return `snyk.severity.${severity}`;
    }

    // Comprehensive field mappings from IdeConfigData to VS Code settings
    const fieldMappings: Record<string, string> = {
      // Scan Settings
      activateSnykOpenSource: 'snyk.features.openSourceSecurity',
      activateSnykCode: 'snyk.features.codeSecurity',
      activateSnykIac: 'snyk.features.infrastructureAsCode',
      scanningMode: 'snyk.scanningMode',

      // Issue View Settings
      issueViewOptions: 'snyk.issueViewOptions',
      enableDeltaFindings: 'snyk.allIssuesVsNetNewIssues',

      // Authentication Settings
      authenticationMethod: 'snyk.advanced.authenticationMethod',

      // Connection Settings
      endpoint: 'snyk.advanced.customEndpoint',
      organization: 'snyk.advanced.organization',
      insecure: 'http.proxyStrictSSL',

      // Trusted Folders
      trustedFolders: 'snyk.trustedFolders',

      // CLI Settings
      cliPath: 'snyk.advanced.cliPath',
      manageBinariesAutomatically: 'snyk.advanced.automaticDependencyManagement',
      cliBaseDownloadURL: 'snyk.advanced.cliBaseDownloadUrl',
      cliReleaseChannel: 'snyk.advanced.cliReleaseChannel',

      // Filter Settings
      filterSeverity: 'snyk.severity',

      // Miscellaneous Settings
      additionalParams: 'snyk.advanced.additionalParameters',
      riskScoreThreshold: 'snyk.riskScoreThreshold',

      // Folder Configs
      folderConfigs: 'snyk.folderConfigs',
    };

    return fieldMappings[htmlKey];
  }

  private populateScopeIndicators(html: string): string {
    // Parse HTML to find all config-scope-slot elements
    const slotRegex = /<span[^>]*class="config-scope-slot"[^>]*data-setting-key="([^"]*)"[^>]*><\/span>/g;

    return html.replace(slotRegex, (v, settingKey) => {
      const vscodeSetting = this.mapHtmlKeyToVSCodeSetting(settingKey);
      if (!vscodeSetting) return v;
      const scope = this.getSettingScope(vscodeSetting);

      if (scope !== 'workspace') {
        return v;
      }

      // Create scope indicator text like VS Code does
      return `<span class="config-scope-slot" data-config-scope-slot="true" data-setting-key="${settingKey}">
      <span class="scope-indicator">(Modified in Workspace)</span>
    </span>`;
    });
  }

  protected onPanelDispose(): void {
    super.onPanelDispose();
  }
}
