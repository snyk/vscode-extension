import * as vscode from 'vscode';
import { IExtension } from '../../../base/modules/interfaces';
import { IConfiguration } from '../../../common/configuration/configuration';
import {
  SNYK_IGNORE_ISSUE_COMMAND,
  SNYK_OPEN_BROWSER_COMMAND,
  SNYK_OPEN_LOCAL_COMMAND,
} from '../../../common/constants/commands';
import { SNYK_VIEW_SUGGESTION_CODE } from '../../../common/constants/views';
import { ErrorHandler } from '../../../common/error/errorHandler';
import { ILog } from '../../../common/logger/interfaces';
import { getNonce } from '../../../common/views/nonce';
import { WebviewProvider } from '../../../common/views/webviewProvider';
import { ExtensionContext } from '../../../common/vscode/extensionContext';
import { WEBVIEW_PANEL_QUALITY_TITLE, WEBVIEW_PANEL_SECURITY_TITLE } from '../../constants/analysis';
import { completeFileSuggestionType } from '../../interfaces';
import { messages as errorMessages } from '../../messages/error';
import { createIssueCorrectRange, getVSCodeSeverity } from '../../utils/analysisUtils';
import { ICodeSuggestionWebviewProvider } from '../interfaces';

export class CodeSuggestionWebviewProvider extends WebviewProvider implements ICodeSuggestionWebviewProvider {
  private extension: IExtension | undefined;
  // For consistency reasons, the single source of truth for the current suggestion is the
  // panel state. The following field is only used in
  private suggestion: completeFileSuggestionType | undefined;

  constructor(
    private configuration: IConfiguration,
    protected readonly context: ExtensionContext,
    protected readonly logger: ILog,
  ) {
    super(context, logger);
  }

  activate(extension: IExtension): void {
    this.extension = extension;
    vscode.window.registerWebviewPanelSerializer(SNYK_VIEW_SUGGESTION_CODE, new SuggestionSerializer(this));
  }

  show(suggestionId: string, uri: vscode.Uri, position: vscode.Range): void {
    if (!this.extension) {
      this.disposePanel();
      return;
    }
    const suggestion = this.extension.snykCode.analyzer.getFullSuggestion(suggestionId, uri, position); // todo: work with snykCode dep, instead of the whole extension
    if (!suggestion) {
      this.disposePanel();
      return;
    }

    void this.showPanel(suggestion);
  }

  checkCurrentSuggestion(): void {
    if (!this.panel || !this.suggestion || !this.extension) return;
    const found = this.extension.snykCode.analyzer.checkFullSuggestion(this.suggestion);
    if (!found) this.disposePanel();
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
          {
            localResourceRoots: [this.context.getExtensionUri()],
            enableScripts: true,
          },
        );
      }

      this.panel.webview.html = this.getHtmlForWebview(this.panel.webview);

      void this.panel.webview.postMessage({ type: 'set', args: suggestion });

      this.panel.onDidDispose(this.onPanelDispose.bind(this), null, this.disposables);
      this.panel.onDidChangeViewState(this.checkVisibility.bind(this), undefined, this.disposables);
      // Handle messages from the webview
      this.panel.webview.onDidReceiveMessage(this.handleMessage.bind(this), undefined, this.disposables);
      this.suggestion = suggestion;
    } catch (e) {
      ErrorHandler.handle(e, this.logger, errorMessages.suggestionViewShowFailed);
    }
  }

  private async handleMessage(message: any) {
    if (!this.extension) return;
    try {
      const { type, args } = message;
      switch (type) {
        case 'openLocal': {
          let { uri, cols, rows } = args;
          uri = vscode.Uri.parse(uri);
          const range = createIssueCorrectRange({ cols, rows });
          await vscode.commands.executeCommand(SNYK_OPEN_LOCAL_COMMAND, uri, range);
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
          uri = vscode.Uri.parse(uri);
          severity = getVSCodeSeverity(severity);
          const range = createIssueCorrectRange({ cols, rows });
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
        case 'sendFeedback': {
          this.sendFeedback({ data: args });
          break;
        }
        default: {
          throw new Error('Unknown message type');
        }
      }
    } catch (e) {
      ErrorHandler.handle(e, this.logger, errorMessages.suggestionViewMessageHandlingFailed(message));
    }
  }

  private sendFeedback(data: { [key: string]: any } = {}) {
    console.debug(data);
    // await reportEvent({
    //   baseURL: configuration.baseURL,
    //   type: 'suggestionFeedback',
    //   source: configuration.source,
    //   ...(configuration.token && { sessionToken: configuration.token }),
    //   ...data,
    // });
  }

  private getTitle(suggestion: completeFileSuggestionType): string {
    return suggestion.isSecurityType ? WEBVIEW_PANEL_SECURITY_TITLE : WEBVIEW_PANEL_QUALITY_TITLE;
  }

  protected getHtmlForWebview(webview: vscode.Webview): string {
    const images: Record<string, string> = [
      ['icon-lines', 'svg'],
      ['icon-external', 'svg'],
      ['icon-code', 'svg'],
      ['icon-github', 'svg'],
      ['icon-like', 'svg'],
      ['light-icon-info', 'svg'],
      ['dark-high-severity', 'svg'],
      ['light-icon-warning', 'svg'],
      ['dark-medium-severity', 'svg'],
      ['light-icon-critical', 'svg'],
      ['dark-low-severity', 'svg'],
    ].reduce<Record<string, string>>((accumulator: Record<string, string>, [name, ext]) => {
      const uri = this.getWebViewUri('media', 'images', `${name}.${ext}`); // todo move to media folder
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
        </section>
        <section class="delimiter-top" id="labels"></section>
        <section class="delimiter-top">
          <div id="info-top" class="font-light">
            This <span class="issue-type">issue</span> was fixed by <span id="dataset-number"></span> projects. Here are <span id="example-number"></span> example fixes.
          </div>
          <div id="example-top" class="row between">
            <div id="current-example" class="clickable">
              <img class="icon" src="${images['icon-github']}"></img>
              <span id="example-link"></span>
            </div>
            <div>
              <div id="previous-example" class="arrow left">▾</div>
              <span>
                Example <span id="example-counter">1</span>/<span id="example-number2"></span>
              </span>
              <div id="next-example" class="arrow right">▾</div>
            </div>
          </div>
          <div id="example"></div>
        </section>
        <section class="delimiter-top">
          <div id="actions-section">
            <div class="actions row">
              ${
                this.configuration.getPreviewFeatures().reportFalsePositives
                  ? `
              <button id="ignore-line-issue" class="button">Ignore on line <span id="line-position2"></span></button>
              <button id="ignore-file-issue" class="button">Ignore in this file</button>

              <div class="report-fp-actions">
                <button id="report-fp" class="button">Report as false positive</button>
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
        <section class="report-fp-panel visibility-hidden">
          <div class="header">
            <h2>Report as False Positive</h2>
            <a class="close report-fp-cancel"></a>
          </div>
          <div class="step">
            <div class="success-checkmark"></div>
            <div class="label">New tab containing false positive code</div>
          </div>
          <div class="step">
            <div class="second-step-checkmark"></div>
            <div class="label">
              Review code before sending it to Snyk.io.<br/>
              <span class="detail">It will be uploaded to Snyk and manually reviewed by our engineers.</span>
            </div>
          </div>
          <div class="step">
            <div class="third-step-checkmark"></div>
            <div class="label">Send code for verification</div>
          </div>

          <div class="actions row">
            <button class="button report-fp-cancel">Cancel</button>
          </div>
        </section>
      </div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
  </html>`;
  }
}

class SuggestionSerializer implements vscode.WebviewPanelSerializer {
  private suggestionProvider: CodeSuggestionWebviewProvider;
  constructor(suggestionProvider: CodeSuggestionWebviewProvider) {
    this.suggestionProvider = suggestionProvider;
  }

  async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: completeFileSuggestionType): Promise<void> {
    // `state` is the state persisted using `setState` inside the webview
    console.log(`Snyk: Restoring webview state: ${state}`);
    if (!state) {
      webviewPanel.dispose();
      return Promise.resolve();
    }
    this.suggestionProvider.restorePanel(webviewPanel);
    return this.suggestionProvider.showPanel(state);
  }
}
