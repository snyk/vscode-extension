import { AnalysisSeverity } from '@snyk/code-client';
import * as vscode from 'vscode';
import { IAnalytics } from '../../../common/analytics/itly';
import { SNYK_OPEN_BROWSER_COMMAND } from '../../../common/constants/commands';
import { SNYK_VIEW_FALSE_POSITIVE_CODE } from '../../../common/constants/views';
import { ErrorHandler } from '../../../common/error/errorHandler';
import { ILog } from '../../../common/logger/interfaces';
import { getNonce } from '../../../common/views/nonce';
import { WebviewPanelSerializer } from '../../../common/views/webviewPanelSerializer';
import { WebviewProvider } from '../../../common/views/webviewProvider';
import { ExtensionContext } from '../../../common/vscode/extensionContext';
import { IVSCodeWindow } from '../../../common/vscode/window';
import { ISnykCodeService } from '../../codeService';
import { FalsePositive } from '../../falsePositive/falsePositive';
import { messages as errorMessages } from '../../messages/error';

enum FalsePositiveViewEventMessageType {
  OpenBrowser = 'openBrowser',
  Close = 'close',
  Send = 'send',
}

type FalsePositiveViewEventMessage = {
  type: FalsePositiveViewEventMessageType;
  value: unknown;
};

export type FalsePositiveWebviewModel = {
  falsePositive: FalsePositive;
  title: string;
  severity: AnalysisSeverity;
  severityText: string;
  suggestionType: 'Issue' | 'Vulnerability';
  cwe: string[];
  isSecurityTypeIssue: boolean;
};

export class FalsePositiveWebviewProvider extends WebviewProvider<FalsePositiveWebviewModel> {
  constructor(
    private readonly codeService: ISnykCodeService,
    private readonly window: IVSCodeWindow,
    protected readonly context: ExtensionContext,
    protected readonly logger: ILog,
    private readonly analytics: IAnalytics,
  ) {
    super(context, logger);
  }

  activate(): void {
    this.context.addDisposables(
      this.window.registerWebviewPanelSerializer(SNYK_VIEW_FALSE_POSITIVE_CODE, new WebviewPanelSerializer(this)),
    );
  }

  async showPanel(model: FalsePositiveWebviewModel): Promise<void> {
    try {
      if (this.panel) {
        this.panel.reveal(vscode.ViewColumn.One, true);
      } else {
        this.panel = vscode.window.createWebviewPanel(
          SNYK_VIEW_FALSE_POSITIVE_CODE,
          'Snyk Report False Positive',
          {
            viewColumn: vscode.ViewColumn.One,
            preserveFocus: true,
          },
          this.getWebviewOptions(),
        );
        this.registerListeners();
      }

      this.panel.webview.html = this.getHtmlForWebview(this.panel.webview);
      await this.panel.webview.postMessage({ type: 'set', args: model });

      this.analytics.logFalsePositiveIsDisplayed();
    } catch (e) {
      ErrorHandler.handle(e, this.logger, errorMessages.reportFalsePositiveViewShowFailed);
    }
  }

  protected registerListeners() {
    if (!this.panel) return;

    this.panel.onDidDispose(() => this.onPanelDispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(
      async (data: FalsePositiveViewEventMessage) => {
        switch (data.type) {
          case FalsePositiveViewEventMessageType.Send:
            // eslint-disable-next-line no-case-declarations
            const { falsePositive, content, isSecurityTypeIssue, issueSeverity } = data.value as {
              falsePositive: FalsePositive;
              content: string;
              isSecurityTypeIssue: boolean;
              issueSeverity: AnalysisSeverity;
            };
            await this.reportFalsePositive(falsePositive, content, isSecurityTypeIssue, issueSeverity);
            break;
          case FalsePositiveViewEventMessageType.OpenBrowser:
            void vscode.commands.executeCommand(SNYK_OPEN_BROWSER_COMMAND, data.value);
            break;
          case FalsePositiveViewEventMessageType.Close:
            this.disposePanel();
            break;
          default:
            break;
        }
      },
      null,
      this.disposables,
    );
    this.panel.onDidChangeViewState(() => this.checkVisibility(), null, this.disposables);
  }

  private async reportFalsePositive(
    falsePositive: FalsePositive,
    content: string,
    isSecurityTypeIssue: boolean,
    issueSeverity: AnalysisSeverity,
  ): Promise<void> {
    falsePositive.content = content;
    await this.codeService.reportFalsePositive(falsePositive, isSecurityTypeIssue, issueSeverity);
  }

  protected getHtmlForWebview(webview: vscode.Webview): string {
    const images: Record<string, string> = [
      ['dark-critical-severity', 'svg'],
      ['dark-high-severity', 'svg'],
      ['dark-medium-severity', 'svg'],
      ['dark-low-severity', 'svg'],
      ['warning', 'svg'],
    ].reduce((accumulator: Record<string, string>, [name, ext]) => {
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
      'falsePositive',
      'falsePositiveWebviewScript.js',
    );
    const styleUri = this.getWebViewUri('media', 'views', 'snykCode', 'falsePositive', 'falsePositive.css');

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
          <section>
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
          <section class="delimiter-top editor-section">
            <textarea class="editor"></textarea>
          </section>
          <section class="delimiter-top">
          <div class="warning">
            <img src="${images['warning']}" />
            <span>Please check the code. It will be uploaded to Snyk and manually reviewed by our engineers.</span>
          </div>
          </section>
          <section class="delimiter-top">
          <div class="actions">
            <button id="send" class="button">Send code</button>
            <button id="cancel" class="button secondary">Cancel <span id="line-position2"></span></button>
          </div>
        </div>
          </section>
        </div>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
  }
}
