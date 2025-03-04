import {
  ChatContext,
  ChatRequest,
  ChatRequestContext,
  ChatResponseStream,
  CommandDetail,
  CommandProvider,
  GeminiCodeAssist,
} from './geminiApi';
import { ErrorHandler } from '../error/errorHandler';
import path from 'path';
import { UriAdapter } from '../vscode/uri';
import { SNYK_NAME, SNYK_NAME_EXTENSION } from '../constants/general';
import { CancellationToken } from '../vscode/types';
import { DiagnosticsIssueProvider, productToLsProduct } from '../services/diagnosticsService';
import { MarkdownStringAdapter } from '../vscode/markdownString';
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
import { vsCodeCommands } from '../vscode/commands';
import {
  SNYK_EXECUTE_MCP_TOOL_COMMAND,
  SNYK_NAVIGATE_TO_RANGE,
  SNYK_WORKSPACE_SCAN_COMMAND,
} from '../constants/commands';
import { configuration } from '../configuration/instance';
import { ILog } from '../logger/interfaces';
import { ExtensionContext } from '../vscode/extensionContext';
import { Subject } from 'rxjs';
import { generateUuid } from 'vscode-languageclient/lib/common/utils/uuid';

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

  private registerWithGeminiCodeAssist(geminiCodeAssist: GeminiCodeAssist) {
    this.logger.info('Registering with Gemini Code Assist');
    try {
      const iconPath = path.join(this.extensionContext.extensionPath, 'media/images/readme/snyk_extension_icon.png');
      const iconURI = new UriAdapter().file(iconPath);
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

        await vsCodeCommands.executeCommand(SNYK_WORKSPACE_SCAN_COMMAND);
        while (openScansCount > 0) {
          // eslint-disable-next-line no-await-in-loop
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // show
      const markdown = mdsa.get(this.getIssueMarkDownFromDiagnostics(diagnosticsIssueProvider, request.context), true);
      markdown.isTrusted = { enabledCommands: [SNYK_NAVIGATE_TO_RANGE] };
      markdown.supportHtml = true;
      responseStream.push(markdown);
      responseStream.close();
      return Promise.resolve();
    };
  }

  private countEnabledProducts(): number {
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

  private getIssueMarkDownFromDiagnostics(
    diagnosticsIssueProvider: DiagnosticsIssueProvider<unknown>,
    context: ChatRequestContext,
  ): string {
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
        id: generateUuid(),
        getText: () => issuesString,
      } as ChatContext;
      context.push(newContext);
    }

    try {
      const codeIssues = diagnosticsIssueProvider.getIssuesFromDiagnostics(ScanProduct.Code) as Issue<CodeIssueData>[];
      const ossIssues = diagnosticsIssueProvider.getIssuesFromDiagnostics(
        ScanProduct.OpenSource,
      ) as Issue<OssIssueData>[];
      const iacIssues = diagnosticsIssueProvider.getIssuesFromDiagnostics(
        ScanProduct.InfrastructureAsCode,
      ) as Issue<IacIssueData>[];
      if (codeIssues.length > 0 || ossIssues.length > 0 || iacIssues.length > 0) {
        issueMsg = '';
      }

      if (codeIssues.length > 0) {
        codeIssues.sort(issueComparator);
        pushIssuesToContext(codeIssues);

        issueMsg += '\n\n## ' + productToLsProduct(ScanProduct.Code) + ' Issues\n';
        issueMsg += '| Severity  | Issue                                     | Priority <br> Score | \n';
        issueMsg += '|-----------|:------------------------------------------|--------------:| \n';
        for (const issue of codeIssues) {
          issueMsg += this.enrichMessageWithIssueData(issue, ScanProduct.Code);
        }
      }
      if (ossIssues.length > 0) {
        ossIssues.sort(issueComparator);
        pushIssuesToContext(ossIssues);
        issueMsg += '\n\n## ' + productToLsProduct(ScanProduct.OpenSource) + ' Issues\n';
        issueMsg += '| Severity  | Issue                                     | CVSS | \n';
        issueMsg += '|-----------|:------------------------------------------|--------------:| \n';
        for (const issue of ossIssues) {
          issueMsg += this.enrichMessageWithIssueData(issue, ScanProduct.OpenSource);
        }
      }
      if (iacIssues.length > 0) {
        iacIssues.sort(issueComparator);
        pushIssuesToContext(iacIssues);
        issueMsg += '\n\n## ' + productToLsProduct(ScanProduct.InfrastructureAsCode) + ' Issues\n';
        issueMsg += '| Severity  | Issue                                     | Priority <br> Score | \n';
        issueMsg += '|-----------|:------------------------------------------|--------------:| \n';
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
    const commandURI = new UriAdapter().parse(`command:${SNYK_NAVIGATE_TO_RANGE}?${params}`);
    const titleLink = `[**` + issue.title + `**](${commandURI})`;
    const score = this.getScore(issue);

    let emoji: string;
    if (issue.severity == IssueSeverity.Critical) {
      emoji = '🔴';
    } else if (issue.severity == IssueSeverity.High) {
      emoji = '🟠';
    } else if (issue.severity == IssueSeverity.Medium) {
      emoji = '🟡';
    } else {
      emoji = '⚪️';
    }
    return `| ${emoji} | ${titleLink} <br> ${baseName} | ${score} |\n`;
  }

  private getScore(issue: Issue<CodeIssueData | OssIssueData | IacIssueData>): number {
    let score: number = 0;
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
