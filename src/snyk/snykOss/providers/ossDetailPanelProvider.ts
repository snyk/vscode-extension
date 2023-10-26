import * as vscode from 'vscode';
import { SNYK_OPEN_BROWSER_COMMAND } from '../../common/constants/commands';
import { SNYK_VIEW_SUGGESTION_OSS } from '../../common/constants/views';
import { ErrorHandler } from '../../common/error/errorHandler';
import { Issue, OssIssueData } from '../../common/languageServer/types';
import { ILog } from '../../common/logger/interfaces';
import { getNonce } from '../../common/views/nonce';
import { WebviewPanelSerializer } from '../../common/views/webviewPanelSerializer';
import { IWebViewProvider, WebviewProvider } from '../../common/views/webviewProvider';
import { ExtensionContext } from '../../common/vscode/extensionContext';
import { IVSCodeLanguages } from '../../common/vscode/languages';
import { IVSCodeWindow } from '../../common/vscode/window';
import { IVSCodeWorkspace } from '../../common/vscode/workspace';
import { messages as errorMessages } from '../messages/error';

export class OssDetailPanelProvider
  extends WebviewProvider<Issue<OssIssueData>>
  implements IWebViewProvider<Issue<OssIssueData>>
{
  // For consistency reasons, the single source of truth for the current suggestion is the
  // panel state. The following field is only used in
  private issue: Issue<OssIssueData> | undefined;

  constructor(
    private readonly window: IVSCodeWindow,
    protected readonly context: ExtensionContext,
    protected readonly logger: ILog,
    private readonly languages: IVSCodeLanguages,
    private readonly workspace: IVSCodeWorkspace,
  ) {
    super(context, logger);
  }

  activate(): void {
    this.context.addDisposables(
      this.window.registerWebviewPanelSerializer(SNYK_VIEW_SUGGESTION_OSS, new WebviewPanelSerializer(this)),
    );
  }

  get openIssueId(): string | undefined {
    return this.issue?.id;
  }

  async showPanel(issue: Issue<OssIssueData>): Promise<void> {
    try {
      await this.focusSecondEditorGroup();

      if (this.panel) {
        this.panel.reveal(vscode.ViewColumn.Two, true);
      } else {
        this.panel = vscode.window.createWebviewPanel(
          SNYK_VIEW_SUGGESTION_OSS,
          'Snyk OSS Vulnerability',
          {
            viewColumn: vscode.ViewColumn.Two,
            preserveFocus: true,
          },
          this.getWebviewOptions(),
        );
        this.registerListeners();
      }

      this.panel.webview.html = this.getHtmlForWebview(this.panel.webview);
      this.panel.iconPath = vscode.Uri.joinPath(
        vscode.Uri.file(this.context.extensionPath),
        'media',
        'images',
        'snyk-iac.svg', // TODO: USE OSS ICON
      );

      await this.panel.webview.postMessage({ type: 'set', args: issue });

      this.issue = issue;
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
    super.disposePanel();
  }

  protected onPanelDispose(): void {
    super.onPanelDispose();
  }

  private async handleMessage(message: any) {
    try {
      const { type, value } = message;
      switch (type) {
        case 'openBrowser': {
          await vscode.commands.executeCommand(SNYK_OPEN_BROWSER_COMMAND, value);
          break;
        }
        default: {
          throw new Error('Unknown message type');
        }
      }
    } catch (e) {
      ErrorHandler.handle(e, this.logger, errorMessages.suggestionViewShowFailed);
    }
  }

  protected getHtmlForWebview(webview: vscode.Webview): string {
    const images: Record<string, string> = [
      ['dark-critical-severity', 'svg'],
      ['dark-high-severity', 'svg'],
      ['dark-medium-severity', 'svg'],
      ['dark-low-severity', 'svg'],
    ].reduce((accumulator: Record<string, string>, [name, ext]) => {
      const uri = this.getWebViewUri('media', 'images', `${name}.${ext}`);
      if (!uri) throw new Error('Image missing.');
      accumulator[name] = uri.toString();
      return accumulator;
    }, {});

    const scriptUri = this.getWebViewUri(
      'out',
      'snyk',
      'snykIac',
      'views',
      'suggestion',
      'iacSuggestionWebviewScript.js',
    );
    const styleUri = this.getWebViewUri('media', 'views', 'oss', 'suggestion', 'suggestion.css'); // make it common

    const nonce = getNonce();

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">

				<!--
					Use a content security policy to only allow loading images from https or from our extension directory,
					and only allow scripts that have a specific nonce.
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">

				<link href="${styleUri}" rel="stylesheet">
			</head>
			<body>
        <div class="suggestion">
          <section class="suggestion--header">
            <div class="severity">
              <img id="lowl" class="icon light-only hidden" src="${images['dark-low-severity']}" />
              <img id="lowd" class="icon dark-only hidden" src="${images['dark-low-severity']}" />
              <img id="mediuml" class="icon light-only hidden" src="${images['dark-medium-severity']}" />
              <img id="mediumd" class="icon dark-only hidden" src="${images['dark-medium-severity']}" />
              <img id="highl" class="icon light-only hidden" src="${images['dark-high-severity']}" />
              <img id="highd" class="icon dark-only hidden" src="${images['dark-high-severity']}" />
              <img id="criticall" class="icon light-only hidden" src="${images['dark-critical-severity']}" />
              <img id="criticald" class="icon dark-only hidden" src="${images['dark-critical-severity']}" />
              <span id="severity-text"></span>
            </div>
            <div class="suggestion-text"></div>
            <div class="identifiers"></div>
          </section>
          <section class="delimiter-top summary">
            <div class="summary-item description">
              <div class="label font-light">Description</div>
              <div class="content"></div>
            </div>
            <div class="summary-item impact">
              <div class="label font-light">Impact</div>
              <div class="content"></div>
            </div>
            <div class="summary-item path">
              <div class="label font-light">Path</div>
              <div class="content">
                <code></code>
              </div>
            </div>
          </section>
        </div>
          <section class="delimiter-top">
            <h2>Remediation</h2>
            <div class="remediation" class="font-light"></div>
          </section>
          <section class="delimiter-top hidden references">
            <h2>References</h2>
            <div class="reference-links" class="font-light"></div>
          </section>
        </div>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
  }
}
