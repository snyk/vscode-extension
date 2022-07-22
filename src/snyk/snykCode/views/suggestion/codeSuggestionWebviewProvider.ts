import * as vscode from 'vscode';
import { OpenCommandIssueType } from '../../../common/commands/types';
import { IConfiguration } from '../../../common/configuration/configuration';
import {
  SNYK_IGNORE_ISSUE_COMMAND,
  SNYK_OPEN_BROWSER_COMMAND,
  SNYK_OPEN_LOCAL_COMMAND,
  SNYK_REPORT_FALSE_POSITIVE_COMMAND,
} from '../../../common/constants/commands';
import { SNYK_VIEW_SUGGESTION_CODE } from '../../../common/constants/views';
import { ErrorHandler } from '../../../common/error/errorHandler';
import { ILog } from '../../../common/logger/interfaces';
import { messages as learnMessages } from '../../../common/messages/learn';
import { LearnService } from '../../../common/services/learnService';
import { getNonce } from '../../../common/views/nonce';
import { WebviewPanelSerializer } from '../../../common/views/webviewPanelSerializer';
import { IWebViewProvider, WebviewProvider } from '../../../common/views/webviewProvider';
import { ExtensionContext } from '../../../common/vscode/extensionContext';
import { IVSCodeLanguages } from '../../../common/vscode/languages';
import { IVSCodeWindow } from '../../../common/vscode/window';
import { IVSCodeWorkspace } from '../../../common/vscode/workspace';
import { ICodeSettings } from '../../codeSettings';
import { WEBVIEW_PANEL_QUALITY_TITLE, WEBVIEW_PANEL_SECURITY_TITLE } from '../../constants/analysis';
import { completeFileSuggestionType, ISnykCodeAnalyzer } from '../../interfaces';
import { messages as errorMessages } from '../../messages/error';
import { createIssueCorrectRange, getAbsoluteMarkerFilePath, getVSCodeSeverity } from '../../utils/analysisUtils';
import { FalsePositiveWebviewModel } from '../falsePositive/falsePositiveWebviewProvider';
import { ICodeSuggestionWebviewProvider } from '../interfaces';

export class CodeSuggestionWebviewProvider
  extends WebviewProvider<completeFileSuggestionType>
  implements ICodeSuggestionWebviewProvider
{
  // For consistency reasons, the single source of truth for the current suggestion is the
  // panel state. The following field is only used in
  private suggestion: completeFileSuggestionType | undefined;

  constructor(
    private readonly configuration: IConfiguration,
    private readonly analyzer: ISnykCodeAnalyzer,
    private readonly window: IVSCodeWindow,
    private readonly falsePositiveProvider: IWebViewProvider<FalsePositiveWebviewModel>,
    protected readonly context: ExtensionContext,
    protected readonly logger: ILog,
    private readonly languages: IVSCodeLanguages,
    private readonly workspace: IVSCodeWorkspace,
    private readonly codeSettings: ICodeSettings,
    private readonly learnService: LearnService,
  ) {
    super(context, logger);
  }

  activate(): void {
    this.context.addDisposables(
      this.window.registerWebviewPanelSerializer(SNYK_VIEW_SUGGESTION_CODE, new WebviewPanelSerializer(this)),
    );
  }

  show(suggestionId: string, uri: vscode.Uri, position: vscode.Range): void {
    const suggestion = this.analyzer.getFullSuggestion(suggestionId, uri, position);
    if (!suggestion) {
      this.disposePanel();
      return;
    }

    void this.showPanel(suggestion);
  }

  checkCurrentSuggestion(): void {
    if (!this.panel || !this.suggestion) return;
    const found = this.analyzer.checkFullSuggestion(this.suggestion);
    if (!found) this.disposePanel();
  }

  async postLearnLessonMessage(suggestion: completeFileSuggestionType): Promise<void> {
    try {
      if (this.panel) {
        const lesson = await this.learnService.getLesson(suggestion, OpenCommandIssueType.CodeIssue);
        if (lesson) {
          void this.panel.webview.postMessage({
            type: 'setLesson',
            args: { url: lesson.url, title: learnMessages.lessonButtonTitle },
          });
        } else {
          void this.panel.webview.postMessage({
            type: 'setLesson',
            args: null,
          });
        }
      }
    } catch (e) {
      ErrorHandler.handle(e, this.logger, learnMessages.getLessonError);
    }
  }

  async showPanel(suggestion: completeFileSuggestionType): Promise<void> {
    try {
      await this.focusSecondEditorGroup();

      if (this.panel) {
        this.panel.title = this.getTitle(suggestion);
        this.panel.reveal(vscode.ViewColumn.Two, true);
      } else {
        this.panel = vscode.window.createWebviewPanel(
          SNYK_VIEW_SUGGESTION_CODE,
          this.getTitle(suggestion),
          {
            viewColumn: vscode.ViewColumn.Two,
            preserveFocus: true,
          },
          this.getWebviewOptions(),
        );
        this.registerListeners();
      }

      this.panel.webview.html = this.getHtmlForWebview(this.panel.webview);

      await this.panel.webview.postMessage({ type: 'set', args: suggestion });
      void this.postLearnLessonMessage(suggestion);

      this.suggestion = suggestion;
    } catch (e) {
      ErrorHandler.handle(e, this.logger, errorMessages.suggestionViewShowFailed);
    }
  }

  protected registerListeners(): void {
    if (!this.panel) return;

    this.panel.onDidDispose(() => this.onPanelDispose(), null, this.disposables);
    this.panel.onDidChangeViewState(() => this.checkVisibility(), undefined, this.disposables);
    // Handle messages from the webview
    this.panel.webview.onDidReceiveMessage(msg => this.handleMessage(msg), undefined, this.disposables);
  }

  disposePanel(): void {
    this.falsePositiveProvider?.disposePanel();
    super.disposePanel();
  }

  protected onPanelDispose(): void {
    this.falsePositiveProvider?.disposePanel();
    super.onPanelDispose();
  }

  private async handleMessage(message: any) {
    try {
      const { type, args } = message;
      switch (type) {
        case 'openLocal': {
          const { uri, cols, rows, suggestionUri } = args as {
            uri: string;
            cols: [number, number];
            rows: [number, number];
            suggestionUri: string;
          };
          const localUriPath = getAbsoluteMarkerFilePath(this.workspace, uri, suggestionUri);
          const localUri = vscode.Uri.parse(localUriPath);
          const range = createIssueCorrectRange({ cols, rows }, this.languages);
          await vscode.commands.executeCommand(SNYK_OPEN_LOCAL_COMMAND, localUri, range);
          break;
        }
        case 'openBrowser': {
          const { url } = args;
          await vscode.commands.executeCommand(SNYK_OPEN_BROWSER_COMMAND, url);
          break;
        }
        case 'ignoreIssue': {
          // eslint-disable-next-line no-shadow
          let { lineOnly, message, id, rule, severity, uri, cols, rows } = args;
          uri = vscode.Uri.parse(uri as string);
          severity = getVSCodeSeverity(severity as number);
          const range = createIssueCorrectRange({ cols, rows }, this.languages);
          await vscode.commands.executeCommand(SNYK_IGNORE_ISSUE_COMMAND, {
            uri,
            matchedIssue: { message, severity, range },
            issueId: id,
            ruleId: rule,
            isFileIgnore: !lineOnly,
          });
          this.panel?.dispose();
          break;
        }
        case 'openFalsePositive': {
          const { suggestion } = args as { suggestion: completeFileSuggestionType };
          await this.openFalsePositiveCode(suggestion);
          break;
        }
        default: {
          throw new Error('Unknown message type');
        }
      }
    } catch (e) {
      ErrorHandler.handle(e, this.logger, errorMessages.suggestionViewMessageHandlingFailed(JSON.stringify(message)));
    }
  }

  private async openFalsePositiveCode(suggestion: completeFileSuggestionType): Promise<void> {
    await vscode.commands.executeCommand(SNYK_REPORT_FALSE_POSITIVE_COMMAND, {
      suggestion,
    });
  }

  private getTitle(suggestion: completeFileSuggestionType): string {
    return suggestion.isSecurityType ? WEBVIEW_PANEL_SECURITY_TITLE : WEBVIEW_PANEL_QUALITY_TITLE;
  }

  private isReportFalsePositivesEnabled() {
    return (
      this.codeSettings.reportFalsePositivesEnabled && this.configuration.getPreviewFeatures().reportFalsePositives
    );
  }

  protected getHtmlForWebview(webview: vscode.Webview): string {
    const images: Record<string, string> = [
      ['icon-lines', 'svg'],
      ['icon-external', 'svg'],
      ['icon-code', 'svg'],
      ['icon-github', 'svg'],
      ['icon-like', 'svg'],
      ['dark-high-severity', 'svg'],
      ['dark-medium-severity', 'svg'],
      ['light-icon-critical', 'svg'],
      ['dark-low-severity', 'svg'],
      ['arrow-left-dark', 'svg'],
      ['arrow-right-dark', 'svg'],
      ['arrow-left-light', 'svg'],
      ['arrow-right-light', 'svg'],
      ['learn-icon', 'svg'],
    ].reduce<Record<string, string>>((accumulator: Record<string, string>, [name, ext]) => {
      const uri = this.getWebViewUri('media', 'images', `${name}.${ext}`);
      if (!uri) throw new Error('Image missing.');
      accumulator[name] = uri.toString();
      return accumulator;
    }, {});

    const scriptUri = this.getWebViewUri(
      'out',
      'snyk',
      'snykCode',
      'views',
      'suggestion',
      'codeSuggestionWebviewScript.js',
    );
    const styleUri = this.getWebViewUri('media', 'views', 'snykCode', 'suggestion', 'suggestion.css');
    const styleVSCodeUri = this.getWebViewUri('media', 'views', 'common', 'vscode.css');
    const learnStyleUri = this.getWebViewUri('media', 'views', 'common', 'learn.css');

    const nonce = getNonce();
    return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; img-src ${
      webview.cspSource
    } https:; script-src 'nonce-${nonce}';">

      <link href="${styleUri}" rel="stylesheet">
      <link href="${styleVSCodeUri}" rel="stylesheet">
      <link href="${learnStyleUri}" rel="stylesheet">
  </head>
  <body>
      <div class="suggestion">
        <section id="suggestion-info">
          <div id="severity">
            <img id="sev1l" class="icon light-only hidden" src="${images['dark-low-severity']}" />
            <img id="sev1d" class="icon dark-only hidden" src="${images['dark-low-severity']}" />
            <img id="sev2l" class="icon light-only hidden" src="${images['dark-medium-severity']}" />
            <img id="sev2d" class="icon dark-only hidden" src="${images['dark-medium-severity']}" />
            <img id="sev3l" class="icon light-only hidden" src="${images['dark-high-severity']}" />
            <img id="sev3d" class="icon dark-only hidden" src="${images['dark-high-severity']}" />
            <span id="severity-text"></span>
          </div>
          <div id="title" class="suggestion-text"></div>
          <div class="suggestion-links">
            <div id="navigateToIssue" class="clickable">
              <img class="icon" src="${
                images['icon-lines']
              }" /> This <span class="issue-type">issue</span> happens on line <span id="line-position"></span>
            </div>
            <div id="lead-url" class="clickable hidden">
              <img class="icon" src="${images['icon-external']}" /> More info
            </div>
          </div>
          <div class="learn learn__code">
            <img class="icon" src="${images['learn-icon']}" />
            <a class="learn--link"></a>
          </div>
        </section>
        <section class="delimiter-top" id="labels"></section>
        <section class="delimiter-top">
          <div id="info-top" class="font-light">
            This <span class="issue-type">issue</span> was fixed by <span id="dataset-number"></span> projects. Here are <span id="example-number"></span> example fixes.
          </div>
          <div id="info-no-examples" class="font-light">
            There are no example fixes for this issue.
          </div>
          <div id="example-top" class="row between">
            <div id="current-example" class="clickable">
              <img class="icon" src="${images['icon-github']}"></img>
              <span id="example-link"></span>
            </div>
            <div>
              <div id="previous-example" class="arrow">
                <img src=${images['arrow-left-dark']} class="arrow-icon dark-only"></img>
                <img src=${images['arrow-left-light']} class="arrow-icon light-only"></img>
              </div>
              <span id="example-text">
                Example <span id="example-counter">1</span>/<span id="example-number2"></span>
              </span>
              <div id="next-example" class="arrow">
                <img src=${images['arrow-right-dark']} class="arrow-icon dark-only"></img>
                <img src=${images['arrow-right-light']} class="arrow-icon light-only"></img>
              </div>
            </div>
          </div>
          <div id="example"></div>
        </section>
        <section class="delimiter-top">
          <div id="actions-section">
            <div class="actions row">
              ${
                this.isReportFalsePositivesEnabled()
                  ? `
              <button id="ignore-line-issue" class="button">Ignore on line <span id="line-position2"></span></button>
              <button id="ignore-file-issue" class="button">Ignore in this file</button>

              <div class="report-fp-actions">
                <button id="report-fp" class="button">Report false positive</button>
              </div>
              `
                  : `
              <button id="ignore-line-issue" class="button">Ignore on line <span id="line-position2"></span></button>
              <button id="ignore-file-issue" class="button">Ignore in this file</button>
              `
              }
            </div>
          </div>
        </section>
      </div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
  </html>`;
  }
}
