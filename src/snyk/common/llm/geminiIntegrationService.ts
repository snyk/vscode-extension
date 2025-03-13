import {
  ChatContext,
  ChatRequest,
  ChatRequestContext,
  ChatResponseStream,
  CommandDetail,
  CommandProvider,
  GeminiCodeAssist,
  SuggestedPromptProvider,
} from './geminiApi';
import { ErrorHandler } from '../error/errorHandler';
import path from 'path';
import { IUriAdapter } from '../vscode/uri';
import { SNYK_NAME, SNYK_NAME_EXTENSION } from '../constants/general';
import { CancellationToken } from '../vscode/types';
import { IDiagnosticsIssueProvider } from '../services/diagnosticsService';
import { IMarkdownStringAdapter } from '../vscode/markdownString';
import {
  CodeIssueData,
  IacIssueData,
  Issue,
  IssueSeverity,
  OssIssueData,
  Scan,
  ScanProduct,
  ScanStatus,
} from '../languageServer/types';
import { IVSCodeCommands } from '../vscode/commands';
import { SNYK_NAVIGATE_TO_RANGE, SNYK_WORKSPACE_SCAN_COMMAND } from '../constants/commands';
import { ILog } from '../logger/interfaces';
import { Subject } from 'rxjs';
import { generateUuid } from 'vscode-languageclient/lib/common/utils/uuid';
import { IExtensionRetriever } from '../vscode/extensionContext';
import { productToLsProduct } from '../services/mappings';
import { IConfiguration } from '../configuration/configuration';
import { readFileSync } from 'fs';

export class GeminiIntegrationService {
  private criticalBase64Image: string;
  private highBase64Image: string;
  private mediumBase64Image: string;
  private lowBase64Image: string;

  constructor(
    private readonly logger: ILog,
    private readonly configuration: IConfiguration,
    private readonly extensionContext: IExtensionRetriever,
    private readonly scan$: Subject<Scan<CodeIssueData | OssIssueData | IacIssueData>>,
    private readonly uriAdapter: IUriAdapter,
    private readonly markdownAdapter: IMarkdownStringAdapter,
    private readonly codeCommands: IVSCodeCommands,
    private readonly diagnosticsProvider: IDiagnosticsIssueProvider<unknown>,
  ) {}

  private getBase64FromFilePath(filepath: string): string {
    const fileContents = readFileSync(filepath);
    return fileContents.toString('base64');
  }

  private initImages() {
    const basePath = path.join(this.extensionContext.extensionPath, 'media/images');
    this.criticalBase64Image = this.getBase64FromFilePath(path.join(basePath, 'dark-critical-severity.svg'));
    this.highBase64Image = this.getBase64FromFilePath(path.join(basePath, 'dark-high-severity.svg'));
    this.mediumBase64Image = this.getBase64FromFilePath(path.join(basePath, 'dark-medium-severity.svg'));
    this.lowBase64Image = this.getBase64FromFilePath(path.join(basePath, 'dark-low-severity.svg'));
  }

  async connectGeminiToMCPServer() {
    try {
      const geminiCodeAssistExtension = this.extensionContext.getExtension('google.geminicodeassist');
      const isInstalled = !!geminiCodeAssistExtension;
      if (!isInstalled) {
        return Promise.resolve();
      }

      this.initImages();
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

  private registerWithGeminiCodeAssist(geminiCodeAssist: GeminiCodeAssist) {
    this.logger.info('Registering with Gemini Code Assist');
    try {
      const iconPath = path.join(this.extensionContext.extensionPath, 'media/images/readme/snyk_extension_icon.png');
      const iconURI = this.uriAdapter.file(iconPath);
      const geminiTool = geminiCodeAssist.registerTool('snyk', SNYK_NAME, SNYK_NAME_EXTENSION, iconURI);

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
      const suggestedPromptProvider = this.getSuggestedPromptProvider();
      geminiTool.registerSuggestedPromptProvider(suggestedPromptProvider);
    } catch (error) {
      return ErrorHandler.handle(error, this.logger, error instanceof Error ? error.message : 'An error occurred');
    }
  }

  private getSuggestedPromptProvider() {
    const suggestedPromptProvider: SuggestedPromptProvider = {
      provideSuggestedPrompts: () => {
        return ['/scan', '/show', '/scan for new', '/show new', '/scan all', '/show all'];
      },
    };
    return suggestedPromptProvider;
  }

  private getChatRequestHandler() {
    return async (request: ChatRequest, responseStream: ChatResponseStream, token: CancellationToken) => {
      this.logger.debug('received chat request from gemini: ' + request.prompt.fullPrompt());
      if (token.isCancellationRequested) return Promise.resolve();

      if (!request.prompt.fullPrompt().includes('/scan') && !request.prompt.fullPrompt().includes('show')) {
        return Promise.resolve();
      }

      await this.handleDelta(request, responseStream);

      if (request.prompt.fullPrompt().includes('/scan')) {
        responseStream.push(this.markdownAdapter.get('Scanning workspace with Snyk...'));

        let openScansCount = this.countEnabledProducts();

        // subscribe to snyk scan topic to get issue data
        this.scan$.subscribe((scan: Scan<CodeIssueData | OssIssueData | IacIssueData>) => {
          const msg = 'Scan status for ' + scan.folderPath + ': ' + scan.status + '.';
          responseStream.push(this.markdownAdapter.get(msg));

          if (scan.status == ScanStatus.Success || scan.status == ScanStatus.Error) {
            openScansCount--;
          }
        });

        await this.codeCommands.executeCommand(SNYK_WORKSPACE_SCAN_COMMAND);
        while (openScansCount > 0) {
          // eslint-disable-next-line no-await-in-loop
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // show
      const markdown = this.markdownAdapter.get(this.getIssueMarkDownFromDiagnostics(request.context), true);
      markdown.isTrusted = { enabledCommands: [SNYK_NAVIGATE_TO_RANGE] };
      markdown.supportHtml = true;
      responseStream.push(markdown);
      responseStream.close();
      return Promise.resolve();
    };
  }

  private async handleDelta(request: ChatRequest, responseStream: ChatResponseStream) {
    if (request.prompt.fullPrompt().includes('new') && !this.configuration.getDeltaFindingsEnabled()) {
      await this.configuration.setDeltaFindingsEnabled(true);
      responseStream.push(this.markdownAdapter.get('Enabled net-new issues feature...'));
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (request.prompt.fullPrompt().includes('all') && this.configuration.getDeltaFindingsEnabled()) {
      await this.configuration.setDeltaFindingsEnabled(false);
      responseStream.push(this.markdownAdapter.get('Disabled net-new issues feature...'));
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  private countEnabledProducts(): number {
    const enabledProducts = [];
    if (this.configuration.getFeaturesConfiguration()?.ossEnabled) enabledProducts.push(ScanProduct.OpenSource);
    if (
      this.configuration.getFeaturesConfiguration()?.codeSecurityEnabled ||
      this.configuration.getFeaturesConfiguration()?.codeQualityEnabled
    )
      enabledProducts.push(ScanProduct.Code);

    if (this.configuration.getFeaturesConfiguration()?.iacEnabled)
      enabledProducts.push(ScanProduct.InfrastructureAsCode);
    return enabledProducts.length;
  }

  private toNumericSeverity(i1: Issue<CodeIssueData | OssIssueData | IacIssueData>) {
    let i1NumSeverity;
    switch (i1.severity) {
      case IssueSeverity.Critical:
        i1NumSeverity = 0;
        break;
      case IssueSeverity.High:
        i1NumSeverity = 1;
        break;
      case IssueSeverity.Medium:
        i1NumSeverity = 2;
        break;
      case IssueSeverity.Low:
        i1NumSeverity = 3;
        break;
    }
    return i1NumSeverity;
  }

  private getIssueMarkDownFromDiagnostics(context: ChatRequestContext): string {
    let issueMsg = 'No issues found.';

    const issueComparator = (
      i1: Issue<CodeIssueData | OssIssueData | IacIssueData>,
      i2: Issue<CodeIssueData | OssIssueData | IacIssueData>,
    ) => {
      const i1NumSeverity = this.toNumericSeverity(i1);
      const i2NumSeverity = this.toNumericSeverity(i2);
      const i1Score = this.getScore(i1);
      const i2Score = this.getScore(i2);

      if (i1NumSeverity < i2NumSeverity) return -1;
      if (i1NumSeverity > i2NumSeverity) return 1;
      if (i1Score < i2Score) return 1;
      if (i1Score > i2Score) return -1;
      if (i1.title < i2.title) return -1;
      if (i1.title > i2.title) return 1;
      return 0;
    };

    function pushIssuesToContext(issues: Issue<CodeIssueData | OssIssueData | IacIssueData>[]) {
      const issuesString =
        'These are ' +
        issues[0].filterableIssueType +
        ' issues that Snyk has found in JSON format: ' +
        JSON.stringify(issues);
      const newContext = {
        id: 'snyk-workspace-scan',
        getText: () => issuesString,
      } as ChatContext;
      context.push(newContext);
    }

    try {
      const codeIssues = this.diagnosticsProvider.getIssuesFromDiagnostics(ScanProduct.Code) as Issue<CodeIssueData>[];
      const ossIssues = this.diagnosticsProvider.getIssuesFromDiagnostics(
        ScanProduct.OpenSource,
      ) as Issue<OssIssueData>[];
      const iacIssues = this.diagnosticsProvider.getIssuesFromDiagnostics(
        ScanProduct.InfrastructureAsCode,
      ) as Issue<IacIssueData>[];
      if (codeIssues.length > 0 || ossIssues.length > 0 || iacIssues.length > 0) {
        issueMsg = '';
      }

      if (codeIssues.length > 0) {
        codeIssues.sort(issueComparator);
        pushIssuesToContext(codeIssues);

        issueMsg += '\n\n## ' + productToLsProduct(ScanProduct.Code) + ' Issues\n';
        issueMsg += '|Sev  |⚡️    | Issue                                             | Score | \n';
        issueMsg += '|-----|------|:------------------------------------------|------:| \n';
        for (const issue of codeIssues) {
          issueMsg += this.enrichMessageWithIssueData(issue, ScanProduct.Code);
        }
      }
      if (ossIssues.length > 0) {
        ossIssues.sort(issueComparator);
        pushIssuesToContext(ossIssues);
        issueMsg += '\n\n## ' + productToLsProduct(ScanProduct.OpenSource) + ' Issues\n';
        issueMsg += '|Sev  |⚡️    | Issue                                             | Score | \n';
        issueMsg += '|-----|------|:------------------------------------------|------:| \n';
        for (const issue of ossIssues) {
          issueMsg += this.enrichMessageWithIssueData(issue, ScanProduct.OpenSource);
        }
      }
      if (iacIssues.length > 0) {
        iacIssues.sort(issueComparator);
        pushIssuesToContext(iacIssues);
        issueMsg += '\n\n## ' + productToLsProduct(ScanProduct.InfrastructureAsCode) + ' Issues\n';
        issueMsg += '|Sev  |⚡️    | Issue                                             | Score | \n';
        issueMsg += '|-----|------|:------------------------------------------|------:| \n';
        for (const issue of iacIssues) {
          issueMsg += this.enrichMessageWithIssueData(issue, ScanProduct.InfrastructureAsCode);
        }
      }
    } catch (e) {
      ErrorHandler.handle(e, this.logger, e instanceof Error ? e.message : 'An error occurred');
    }
    return issueMsg;
  }

  private enrichMessageWithIssueData(
    issue: Issue<CodeIssueData | OssIssueData | IacIssueData>,
    scanProduct: ScanProduct,
  ) {
    const baseName = path.basename(issue.filePath);

    const snykUri =
      'snyk://' +
      encodeURI(issue.filePath) +
      '?product=' +
      encodeURI(productToLsProduct(scanProduct)) +
      '&issueId=' +
      encodeURI(issue.id) +
      '&action=showInDetailPanel';
    const params = encodeURI(JSON.stringify([snykUri, issue.range]));
    const commandURI = this.uriAdapter.parse(`command:${SNYK_NAVIGATE_TO_RANGE}?${params}`);
    const titleLink = `[**` + issue.title.split(':')[0] + `**](${commandURI})`;

    const score = this.getScore(issue);
    let emoji: string;

    switch (issue.severity) {
      case IssueSeverity.Critical:
        emoji = `<img src="data:image/svg+xml;base64,${this.criticalBase64Image}" alt="Critical">`;
        break;
      case IssueSeverity.High:
        emoji = `<img src="data:image/svg+xml;base64,${this.highBase64Image}" alt="High">`;
        break;
      case IssueSeverity.Medium:
        emoji = `<img src="data:image/svg+xml;base64,${this.mediumBase64Image}" alt="Medium">`;
        break;
      default:
        emoji = `<img src="data:image/svg+xml;base64,${this.lowBase64Image}" alt="Low">`;
        break;
    }
    const line = issue.range.start.line + 1;
    const bolt = `${this.isFixable(issue) ? '⚡️' : ''}`;

    return `| ${emoji} | ${bolt} | ${titleLink} <br> <small>${baseName}#L${line}</small>| \`${score}\` |\n`;
  }

  private isFixable(issue: Issue<CodeIssueData | OssIssueData | IacIssueData>): boolean {
    let fixable: boolean;
    switch (issue.filterableIssueType) {
      case 'Code Quality':
      case 'Code Security':
        fixable = (issue.additionalData as CodeIssueData).hasAIFix;
        break;
      case 'Open Source':
        fixable = (issue.additionalData as OssIssueData).isUpgradable;
        break;
      default:
        fixable = false;
        break;
    }
    return fixable;
  }

  private getScore(issue: Issue<CodeIssueData | OssIssueData | IacIssueData>): number {
    let score: number;
    switch (issue.filterableIssueType) {
      case 'Code Quality':
      case 'Code Security':
        score = (issue.additionalData as CodeIssueData).priorityScore;
        break;
      case 'Open Source':
        score = (issue.additionalData as OssIssueData).cvssScore ?? 0;
        break;
      default:
        score = Math.abs(this.toNumericSeverity(issue) - 100);
        break;
    }
    return score;
  }
}
