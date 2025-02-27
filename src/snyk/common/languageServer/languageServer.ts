import _ from 'lodash';
import { firstValueFrom, ReplaySubject, Subject } from 'rxjs';
import { IAuthenticationService } from '../../base/services/authenticationService';
import { FolderConfig, IConfiguration } from '../configuration/configuration';
import {
  SNYK_ADD_TRUSTED_FOLDERS,
  SNYK_FOLDERCONFIG,
  SNYK_HAS_AUTHENTICATED,
  SNYK_LANGUAGE_SERVER_NAME,
  SNYK_MCPSERVERURL,
  SNYK_SCAN,
  SNYK_SCANSUMMARY,
} from '../constants/languageServer';
import { CONFIGURATION_IDENTIFIER } from '../constants/settings';
import { ErrorHandler } from '../error/errorHandler';
import { ILog } from '../logger/interfaces';
import { getProxyEnvVariable, getProxyOptions } from '../proxy';
import { DownloadService } from '../services/downloadService';
import { User } from '../user';
import { ILanguageClientAdapter } from '../vscode/languageClient';
import { CancellationToken, LanguageClient, LanguageClientOptions, ServerOptions } from '../vscode/types';
import { IVSCodeWindow } from '../vscode/window';
import { IVSCodeWorkspace } from '../vscode/workspace';
import { LanguageClientMiddleware } from './middleware';
import { LanguageServerSettings, ServerSettings } from './settings';
import { CodeIssueData, IacIssueData, Issue, OssIssueData, Scan, ScanProduct, ScanStatus } from './types';
import { ExtensionContext } from '../vscode/extensionContext';
import { ISummaryProviderService } from '../../base/summary/summaryProviderService';
import { ChatRequest, ChatResponseStream, CommandDetail, CommandProvider, GeminiCodeAssist } from '../llm/geminiApi';
import { SNYK_EXECUTE_MCP_TOOL_COMMAND, SNYK_WORKSPACE_SCAN_COMMAND } from '../constants/commands';
import { MarkdownStringAdapter } from '../vscode/markdownString';
import { SNYK_NAME, SNYK_NAME_EXTENSION } from '../constants/general';
import { UriAdapter } from '../vscode/uri';
import path from 'path';
import { vsCodeCommands } from '../vscode/commands';
import { DiagnosticsIssueProvider } from '../services/diagnosticsService';
import { configuration } from '../configuration/instance';
import { integer } from 'vscode-languageclient';

export interface ILanguageServer {
  start(): Promise<void>;

  stop(): Promise<void>;

  showOutputChannel(): void;

  cliReady$: ReplaySubject<string>;
  scan$: Subject<Scan<CodeIssueData | OssIssueData | IacIssueData>>;
}

export class LanguageServer implements ILanguageServer {
  private client: LanguageClient;
  readonly cliReady$ = new ReplaySubject<string>(1);
  readonly scan$ = new Subject<Scan<CodeIssueData | OssIssueData | IacIssueData>>();

  constructor(
    private user: User,
    private configuration: IConfiguration,
    private languageClientAdapter: ILanguageClientAdapter,
    private workspace: IVSCodeWorkspace,
    private window: IVSCodeWindow,
    private authenticationService: IAuthenticationService,
    private readonly logger: ILog,
    private downloadService: DownloadService,
    private extensionContext: ExtensionContext,
    private summaryProvider: ISummaryProviderService,
  ) {
    this.downloadService = downloadService;
  }

  // Starts the language server and the client. LS will be downloaded if missing.
  // Returns a promise that resolves when the language server is ready to receive requests.
  async start(): Promise<void> {
    // wait until Snyk LS is downloaded
    await firstValueFrom(this.downloadService.downloadReady$);
    this.logger.info('Starting Snyk Language Server');

    // proxy settings
    const proxyOptions = await getProxyOptions(this.workspace, this.configuration, this.logger);
    const proxyEnvVariable = getProxyEnvVariable(proxyOptions);

    let processEnv = process.env;

    if (proxyEnvVariable) {
      processEnv = {
        ...processEnv,
        // eslint-disable-next-line camelcase
        https_proxy: proxyEnvVariable,
        // eslint-disable-next-line camelcase
        http_proxy: proxyEnvVariable,
      };
    }

    const cliBinaryPath = await this.configuration.getCliPath();

    // log level is set to info by default
    let logLevel = 'info';
    const additionalCliParameters = this.configuration.getAdditionalCliParameters();
    if (
      additionalCliParameters != null &&
      additionalCliParameters.length > 0 &&
      (additionalCliParameters.includes('-d') || additionalCliParameters.includes('--debug'))
    ) {
      logLevel = 'debug';
    }
    logLevel = process.env.SNYK_LOG_LEVEL ?? logLevel;

    const args = ['language-server', '-l', logLevel];
    this.logger.info(`Snyk Language Server - path: ${cliBinaryPath}`);
    this.logger.info(`Snyk Language Server - args: ${args}`);
    const serverOptions: ServerOptions = {
      command: cliBinaryPath,
      args: args,
      options: {
        env: processEnv,
      },
    };

    // Options to control the language client
    const clientOptions: LanguageClientOptions = {
      documentSelector: [{ scheme: 'file', language: '' }],
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      initializationOptions: await this.getInitializationOptions(),
      synchronize: {
        configurationSection: CONFIGURATION_IDENTIFIER,
      },
      middleware: new LanguageClientMiddleware(this.configuration, this.user, this.extensionContext),
      /**
       * We reuse the output channel here as it's not properly disposed of by the language client (vscode-languageclient@8.0.0-next.2)
       * See: https://github.com/microsoft/vscode-languageserver-node/blob/cdf4d6fdaefe329ce417621cf0f8b14e0b9bb39d/client/src/common/client.ts#L2789
       */
      outputChannel: this.client?.outputChannel ?? this.window.createOutputChannel(SNYK_LANGUAGE_SERVER_NAME),
    };

    // Create the language client and start the client.
    this.client = this.languageClientAdapter.create('SnykLS', SNYK_LANGUAGE_SERVER_NAME, serverOptions, clientOptions);

    try {
      // register listeners before starting the client
      this.registerListeners(this.client);

      // Start the client. This will also launch the server
      await this.client.start();
      this.logger.info('Snyk Language Server started');
    } catch (error) {
      return ErrorHandler.handle(error, this.logger, error instanceof Error ? error.message : 'An error occurred');
    }
  }

  private registerListeners(client: LanguageClient): void {
    client.onNotification(SNYK_HAS_AUTHENTICATED, ({ token, apiUrl }: { token: string; apiUrl: string }) => {
      this.authenticationService.updateTokenAndEndpoint(token, apiUrl).catch((error: Error) => {
        ErrorHandler.handle(error, this.logger, error.message);
      });
    });

    client.onNotification(SNYK_FOLDERCONFIG, ({ folderConfigs }: { folderConfigs: FolderConfig[] }) => {
      this.configuration.setFolderConfigs(folderConfigs).catch((error: Error) => {
        ErrorHandler.handle(error, this.logger, error.message);
      });
    });

    client.onNotification(SNYK_ADD_TRUSTED_FOLDERS, ({ trustedFolders }: { trustedFolders: string[] }) => {
      this.configuration.setTrustedFolders(trustedFolders).catch((error: Error) => {
        ErrorHandler.handle(error, this.logger, error.message);
      });
    });

    client.onNotification(SNYK_SCAN, (scan: Scan<CodeIssueData | OssIssueData | IacIssueData>) => {
      this.logger.info(`${_.capitalize(scan.product)} scan for ${scan.folderPath}: ${scan.status}.`);
      this.scan$.next(scan);
    });

    client.onNotification(SNYK_SCANSUMMARY, ({ scanSummary }: { scanSummary: string }) => {
      this.summaryProvider.updateSummaryPanel(scanSummary);
    });

    client.onNotification(SNYK_MCPSERVERURL, ({ url }: { url: string }) => {
      this.logger.info('Received MCP Server address ' + url);
      void this.connectGeminiToMCPServer(url);
    });
  }

  // Initialization options are not semantically equal to server settings, thus separated here
  // https://github.com/microsoft/language-server-protocol/issues/567
  async getInitializationOptions(): Promise<ServerSettings> {
    return await LanguageServerSettings.fromConfiguration(this.configuration, this.user);
  }

  showOutputChannel(): void {
    if (!this.client) {
      return;
    }

    this.client.outputChannel.show();
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping Snyk Language Server...');
    if (!this.client) {
      return Promise.resolve();
    }

    if (this.client?.needsStop()) {
      await this.client.stop();
    }

    this.logger.info('Snyk Language Server stopped');
  }

  async connectGeminiToMCPServer(url: string) {
    this.logger.info('Received MCP Server address ' + url);
    try {
      const geminiCodeAssistExtension = this.extensionContext.getExtension('google.geminicodeassist');
      const isInstalled = !!geminiCodeAssistExtension;

      if (!isInstalled) {
        return Promise.resolve();
      }
      this.logger.info('found Gemini Code Assist extension');

      this.logger.debug('waiting for activation of gca');

      while (geminiCodeAssistExtension && !geminiCodeAssistExtension.isActive) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      this.registerWithGeminiCodeAssist(geminiCodeAssistExtension?.exports as GeminiCodeAssist);
    } catch (error) {
      return ErrorHandler.handle(error, this.logger, error instanceof Error ? error.message : 'An error occurred');
    }

    return Promise.resolve();
  }

  private registerWithGeminiCodeAssist(googleExtension: GeminiCodeAssist) {
    this.logger.info('Registering with Gemini Code Assist');
    try {
      const iconPath = path.join(this.extensionContext.extensionPath, 'media/images/readme/snyk_extension_icon.png');
      const iconURI = new UriAdapter().file(iconPath);
      const geminiTool = googleExtension.registerTool('snyk', SNYK_NAME, SNYK_NAME_EXTENSION, iconURI);

      geminiTool.registerChatHandler(this.getChatRequestHandler());

      const commandProvider = {
        listCommands(): Promise<CommandDetail[]> {
          const commands: CommandDetail[] = [
            {
              command: 'scan',
              description: 'Perform a workspace scan with the Snyk Security Extension',
              icon: iconPath,
            } as CommandDetail,
            {
              command: 'show',
              description: 'Show issues know to the Snyk Security Extension',
              icon: iconPath,
            } as CommandDetail,
          ];
          return Promise.resolve(commands);
        },
      } as CommandProvider;

      geminiTool.registerCommandProvider(commandProvider);
    } catch (error) {
      return ErrorHandler.handle(error, this.logger, error instanceof Error ? error.message : 'An error occurred');
    }
  }

  private getChatRequestHandler() {
    return async (request: ChatRequest, responseStream: ChatResponseStream, token: CancellationToken) => {
      this.logger.debug('received chat request from gemini: ' + request.prompt.fullPrompt());
      if (token.isCancellationRequested) return Promise.resolve();

      if (!request.prompt.fullPrompt().includes('/scan') && !request.prompt.fullPrompt().includes('show')) {
        return Promise.resolve();
      }

      const diagnosticsIssueProvider = new DiagnosticsIssueProvider();
      const mdsa = new MarkdownStringAdapter();

      if (request.prompt.fullPrompt().includes('/scan')) {
        responseStream.push(mdsa.get('Scanning workspace with Snyk...'));

        let openScansCount = this.countEnabledProducts();

        // subscribe to snyk scan topic to get issue data
        this.scan$.subscribe((scan: Scan<CodeIssueData | OssIssueData | IacIssueData>) => {
          const msg = 'Scan status for ' + scan.folderPath + ': ' + scan.status + '.';
          responseStream.push(mdsa.get(msg));

          if (scan.status == ScanStatus.Success || scan.status == ScanStatus.Error) {
            openScansCount--;
          }
        });

        await vsCodeCommands.executeCommand(SNYK_EXECUTE_MCP_TOOL_COMMAND, SNYK_WORKSPACE_SCAN_COMMAND);
        while (openScansCount > 0) {
          // eslint-disable-next-line no-await-in-loop
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // show
      const markdown = mdsa.get(this.getIssueMarkDownFromDiagnostics(diagnosticsIssueProvider), true);
      responseStream.push(markdown);
      responseStream.close();
      return Promise.resolve();
    };
  }

  private countEnabledProducts(): integer {
    const enabledProducts = [];
    if (configuration.getFeaturesConfiguration()?.ossEnabled) enabledProducts.push(ScanProduct.OpenSource);
    if (
      configuration.getFeaturesConfiguration()?.codeSecurityEnabled ||
      configuration.getFeaturesConfiguration()?.codeQualityEnabled
    )
      enabledProducts.push(ScanProduct.Code);

    if (configuration.getFeaturesConfiguration()?.iacEnabled) enabledProducts.push(ScanProduct.InfrastructureAsCode);
    return enabledProducts.length;
  }

  private getIssueMarkDownFromDiagnostics(diagnosticsIssueProvider: DiagnosticsIssueProvider<unknown>): string {
    let issueMsg = 'No issues found.';
    try {
      const codeIssues = diagnosticsIssueProvider.getIssuesFromDiagnostics(ScanProduct.Code);
      const ossIssues = diagnosticsIssueProvider.getIssuesFromDiagnostics(ScanProduct.OpenSource);
      const iacIssues = diagnosticsIssueProvider.getIssuesFromDiagnostics(ScanProduct.InfrastructureAsCode);
      if (codeIssues.length > 0 || ossIssues.length > 0 || iacIssues.length > 0) {
        issueMsg = '';
      }
      if (codeIssues.length > 0) {
        issueMsg += '\n\n## Snyk ' + ScanProduct.Code + 'Issues\n';
        issueMsg += '| Severity | Title | Filename |\n|----------|----------|----------|\n';
        for (const issue of codeIssues) {
          issueMsg += this.enrichMessageWithIssueData(issue);
        }
      }
      if (ossIssues.length > 0) {
        issueMsg += '\n\n## Snyk ' + ScanProduct.OpenSource + 'Issues\n';
        issueMsg += '| Severity | Title | Filename |\n|----------|----------|----------|\n';
        for (const issue of ossIssues) {
          issueMsg += this.enrichMessageWithIssueData(issue);
        }
      }
      if (iacIssues.length > 0) {
        issueMsg += '\n\n## Snyk ' + ScanProduct.InfrastructureAsCode + 'Issues\n';
        issueMsg += '| Severity | Title | Filename |\n|----------|----------|----------|\n';
        for (const issue of iacIssues) {
          issueMsg += this.enrichMessageWithIssueData(issue);
        }
      }
    } catch (e) {
      ErrorHandler.handle(e, this.logger, e instanceof Error ? e.message : 'An error occurred');
    }
    return issueMsg;
  }

  private enrichMessageWithIssueData(issue: Issue<unknown>) {
    // todo nicer format
    const baseName = path.basename(issue.filePath);
    return '| ' + issue.severity + ' | ' + issue.title + ' | ' + baseName + ' | \n';
  }
}
