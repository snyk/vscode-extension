import { ChatRequest, ChatResponseStream, CommandDetail, CommandProvider, GeminiCodeAssist } from './geminiApi';
import { ErrorHandler } from '../error/errorHandler';
import path from 'path';
import { UriAdapter } from '../vscode/uri';
import { SNYK_NAME, SNYK_NAME_EXTENSION } from '../constants/general';
import { CancellationToken } from '../vscode/types';
import { DiagnosticsIssueProvider } from '../services/diagnosticsService';
import { MarkdownStringAdapter } from '../vscode/markdownString';
import {
  CodeIssueData,
  IacIssueData,
  Issue,
  OssIssueData,
  Scan,
  ScanProduct,
  ScanStatus,
} from '../languageServer/types';
import { vsCodeCommands } from '../vscode/commands';
import {
  SNYK_EXECUTE_MCP_TOOL_COMMAND,
  SNYK_OPEN_ISSUE_COMMAND,
  SNYK_WORKSPACE_SCAN_COMMAND,
} from '../constants/commands';
import { integer } from 'vscode-languageclient';
import { configuration } from '../configuration/instance';
import { ILog } from '../logger/interfaces';
import { ExtensionContext } from '../vscode/extensionContext';
import { Subject } from 'rxjs';

export class GeminiIntegrationService {
  constructor(
    private readonly logger: ILog,
    private readonly extensionContext: ExtensionContext,
    private readonly scan$: Subject<Scan<CodeIssueData | OssIssueData | IacIssueData>>,
  ) {}

  async connectGeminiToMCPServer() {
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
        issueMsg += '| Severity | Title | \n';
        issueMsg += '| :------: | ----- | \n';
        for (const issue of codeIssues) {
          issueMsg += this.enrichMessageWithIssueData(issue);
        }
      }
      if (ossIssues.length > 0) {
        issueMsg += '\n\n## Snyk ' + ScanProduct.OpenSource + 'Issues\n';
        issueMsg += '| Severity | Title | \n';
        issueMsg += '| :------: | ----- | \n';
        for (const issue of ossIssues) {
          issueMsg += this.enrichMessageWithIssueData(issue);
        }
      }
      if (iacIssues.length > 0) {
        issueMsg += '\n\n## Snyk ' + ScanProduct.InfrastructureAsCode + 'Issues\n';
        issueMsg += '| Severity | Title | \n';
        issueMsg += '| :------: | ----- | \n';
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
    const params = encodeURI(JSON.stringify(issue));
    // const openLink = '[' + issue.title + '](command:' + SNYK_OPEN_ISSUE_COMMAND + '?' + params + ')';
    const openLink = issue.title;
    let emoji = '';
    if (issue.severity == 'medium') {
      emoji = '🟠';
    } else if (issue.severity == 'high' || issue.severity == 'critical') {
      emoji = '🔴';
    } else {
      emoji = '⚪️';
    }
    return '|   ' + emoji + ' | ' + openLink + '(`' + baseName + '`)' + ' | \n';
  }
}
