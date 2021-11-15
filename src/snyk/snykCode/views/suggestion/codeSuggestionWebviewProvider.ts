import * as vscode from 'vscode';
import { IExtension } from '../../../base/modules/interfaces';
import {
  SNYK_IGNORE_ISSUE_COMMAND,
  SNYK_OPEN_BROWSER_COMMAND,
  SNYK_OPEN_LOCAL_COMMAND,
} from '../../../common/constants/commands';
import { SNYK_VIEW_SUGGESTION_CODE } from '../../../common/constants/views';
import { errorsLogs } from '../../../common/messages/errorsServerLogMessages';
import { getNonce } from '../../../common/views/nonce';
import { WebviewProvider } from '../../../common/views/webviewProvider';
import { WEBVIEW_PANEL_QUALITY_TITLE, WEBVIEW_PANEL_SECURITY_TITLE } from '../../constants/analysis';
import { completeFileSuggestionType } from '../../interfaces';
import { createIssueCorrectRange, getVSCodeSeverity } from '../../utils/analysisUtils';
import { ICodeSuggestionWebviewProvider } from '../interfaces';

export class CodeSuggestionWebviewProvider extends WebviewProvider implements ICodeSuggestionWebviewProvider {
  private extension: IExtension | undefined;
  // For consistency reasons, the single source of truth for the current suggestion is the
  // panel state. The following field is only used in
  private suggestion: completeFileSuggestionType | undefined;

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
      if (
        !vscode.window.activeTextEditor?.viewColumn ||
        !this.panel?.viewColumn ||
        this.panel.viewColumn !== vscode.ViewColumn.Two
      ) {
        // workaround for: https://github.com/microsoft/vscode/issues/71608
        // when resolved, we can set showPanel back to sync execution.
        await vscode.commands.executeCommand('workbench.action.focusSecondEditorGroup');
      }
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
      if (!this.extension) return;
      void this.extension.processError(e, {
        message: errorsLogs.suggestionView,
      });
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
      void this.extension.processError(e, {
        message: errorsLogs.suggestionViewMessage,
        data: { message },
      });
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
    const styleVSCodeUri = this.getWebViewUri('media', 'views', 'featureSelection', 'vscode.css');
    const nonce = getNonce();
    return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">

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
              <img class="icon" src="${images['icon-lines']}" /> This <span class="issue-type">issue</span> happens on line <span id="line-position"></span>
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
          <div id="explanations-group">
            <div id="explanations-top">Explanations from other repositories</div>
            <div id="explanations"></div>
          </div>
        </section>
        <section class="feedback-section delimiter-top">
          <div id="ignore-section">
            <div id="ignore-top">Do you want to hide this suggestion from the results?</div>
            <div class="ignore-actions row">
              <button id="ignore-line-issue" class="button">Ignore on line <span id="line-position2"></span></button>
              <button id="ignore-file-issue" class="button">Ignore in this file</button>
            </div>
          </div>
          <!--
          <div id="feedback-close">
            <div class="row between clickable">
              <span>A false positive? Helpful? Let us know here</span>
              <div class="arrow">»</div>
            </div>
          </div>
          <div id="feedback-open" class="hidden">
            <div>
              Feedback
              <label id="feedback-fp" class="false-positive">
                <input type="checkbox" id="feedback-checkbox">
                False postive
                <img id="false-positive" class="icon" src="${images['light-icon-info']}"></img>
              </label>
            </div>
            <div>
              <textarea id="feedback-textarea" rows="8" placeholder="Send us your feedback and comments for this suggestion - we love feedback!"></textarea>
            </div>
            <div id="feedback-disclaimer">* This form will not send any of your code</div>
            <div class="row center hidden">
              <img id="feedback-dislike" class="icon arrow down" src="${images['icon-like']}"></img>
              <img id="feedback-like" class="icon arrow" src="${images['icon-like']}"></img>
            </div>
            <div class="row feedback-actions">
              <div id="feedback-cancel" class="button"> Cancel </div>
              <div id="feedback-send" class="button disabled"> Send Feedback </div>
            </div>
          </div>
          <div id="feedback-sent" class="hidden">
            <div class="row center font-blue">Thank you for your feedback!</div>
          </div>
          -->
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
