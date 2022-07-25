import * as vscode from 'vscode';
import { OpenCommandIssueType } from '../../../common/commands/types';
import { SNYK_OPEN_BROWSER_COMMAND } from '../../../common/constants/commands';
import { SNYK_VIEW_SUGGESTION_OSS } from '../../../common/constants/views';
import { ErrorHandler } from '../../../common/error/errorHandler';
import { ILog } from '../../../common/logger/interfaces';
import { messages as learnMessages } from '../../../common/messages/learn';
import { LearnService } from '../../../common/services/learnService';
import { getNonce } from '../../../common/views/nonce';
import { WebviewPanelSerializer } from '../../../common/views/webviewPanelSerializer';
import { WebviewProvider } from '../../../common/views/webviewProvider';
import { ExtensionContext } from '../../../common/vscode/extensionContext';
import { IVSCodeWindow } from '../../../common/vscode/window';
import { messages as errorMessages } from '../../messages/error';
import { OssIssueCommandArg } from '../ossVulnerabilityTreeProvider';

enum OssSuggestionsViewEventMessageType {
  OpenBrowser = 'openBrowser',
}

type OssSuggestionViewEventMessage = {
  type: OssSuggestionsViewEventMessageType;
  value: unknown;
};

export class OssSuggestionWebviewProvider extends WebviewProvider<OssIssueCommandArg> {
  constructor(
    protected readonly context: ExtensionContext,
    private readonly window: IVSCodeWindow,
    protected readonly logger: ILog,
    private readonly learnService: LearnService,
  ) {
    super(context, logger);
  }

  activate(): void {
    this.context.addDisposables(
      this.window.registerWebviewPanelSerializer(SNYK_VIEW_SUGGESTION_OSS, new WebviewPanelSerializer(this)),
    );
  }

  async postLearnLessonMessage(vulnerability: OssIssueCommandArg): Promise<void> {
    try {
      if (this.panel) {
        const lesson = await this.learnService.getLesson(vulnerability, OpenCommandIssueType.OssVulnerability);
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

  async showPanel(vulnerability: OssIssueCommandArg): Promise<void> {
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

      void this.panel.webview.postMessage({ type: 'set', args: vulnerability });
      void this.postLearnLessonMessage(vulnerability);
    } catch (e) {
      ErrorHandler.handle(e, this.logger, errorMessages.suggestionViewShowFailed);
    }
  }

  protected registerListeners(): void {
    if (!this.panel) return;

    this.panel.onDidDispose(() => this.onPanelDispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(
      (data: OssSuggestionViewEventMessage) => {
        switch (data.type) {
          case OssSuggestionsViewEventMessageType.OpenBrowser:
            void vscode.commands.executeCommand(SNYK_OPEN_BROWSER_COMMAND, data.value);
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

  protected getHtmlForWebview(webview: vscode.Webview): string {
    const images: Record<string, string> = [
      ['icon-code', 'svg'],
      ['dark-critical-severity', 'svg'],
      ['dark-high-severity', 'svg'],
      ['dark-medium-severity', 'svg'],
      ['dark-low-severity', 'svg'],
      ['learn-icon', 'svg'],
    ].reduce((accumulator: Record<string, string>, [name, ext]) => {
      const uri = this.getWebViewUri('media', 'images', `${name}.${ext}`);
      if (!uri) throw new Error('Image missing.');
      accumulator[name] = uri.toString();
      return accumulator;
    }, {});

    const scriptUri = this.getWebViewUri(
      'out',
      'snyk',
      'snykOss',
      'views',
      'suggestion',
      'ossSuggestionWebviewScript.js',
    );
    const styleUri = this.getWebViewUri('media', 'views', 'oss', 'suggestion', 'suggestion.css');
    const learnStyleUri = this.getWebViewUri('media', 'views', 'common', 'learn.css');

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
				<link href="${learnStyleUri}" rel="stylesheet">
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
            <div class="learn">
              <img class="icon" src="${images['learn-icon']}" />
              <a class="learn--link"></a>
            </div>
          </section>
          <section class="delimiter-top summary">
            <div class="summary-item module">
              <div class="label font-light">Vulnerable module</div>
              <div class="content"></div>
            </div>
            <div class="summary-item introduced-through">
              <div class="label font-light">Introduced through</div>
              <div class="content"></div>
            </div>
            <div class="summary-item fixed-in">
              <div class="label font-light">Fixed in</div>
              <div class="content"></div>
            </div>
            <div class="summary-item maturity">
              <div class="label font-light">Exploit maturity</div>
              <div class="content"></div>
            </div>
          </section>
          <section class="delimiter-top">
            <h2>Detailed paths</h2>
            <div class="detailed-paths"></div>
          </section>
          <section class="delimiter-top">
            <div id="overview" class="font-light"></div>
          </section>
        </div>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
  }
}
