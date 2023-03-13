import _ from 'lodash';
import * as vscode from 'vscode';
import { SNYK_VIEW_SUGGESTION_IAC } from '../../../common/constants/views';
import { ErrorHandler } from '../../../common/error/errorHandler';
import { IacIssueData, Issue } from '../../../common/languageServer/types';
import { ILog } from '../../../common/logger/interfaces';
import { getNonce } from '../../../common/views/nonce';
import { WebviewPanelSerializer } from '../../../common/views/webviewPanelSerializer';
import { IWebViewProvider, WebviewProvider } from '../../../common/views/webviewProvider';
import { ExtensionContext } from '../../../common/vscode/extensionContext';
import { IVSCodeLanguages } from '../../../common/vscode/languages';
import { IVSCodeWindow } from '../../../common/vscode/window';
import { IVSCodeWorkspace } from '../../../common/vscode/workspace';
import { messages as errorMessages } from '../../messages/error';
// import { getAbsoluteMarkerFilePath } from '../../utils/analysisUtils';
// import { IssueUtils } from '../../utils/issueUtils';
// import { ICodeSuggestionWebviewProvider } from '../interfaces';

type Suggestion = {
  id: string;
  title: string;
  uri: string;
  severity: string;
  publicId: string;
  documentation: string;
  lineNumber: number;
  issue: string;
  impact: string;
  path?: string[];
  resolve?: string;
  references?: string[];
};

export class IacSuggestionWebviewProvider
  extends WebviewProvider<Issue<IacIssueData>>
  implements IWebViewProvider<Issue<IacIssueData>>
{
  // For consistency reasons, the single source of truth for the current suggestion is the
  // panel state. The following field is only used in
  private issue: Issue<IacIssueData> | undefined;

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
      this.window.registerWebviewPanelSerializer(SNYK_VIEW_SUGGESTION_IAC, new WebviewPanelSerializer(this)),
    );
  }

  get openIssueId(): string | undefined {
    return this.issue?.id;
  }

  // async postLearnLessonMessage(issue: Issue<IacIssueData>): Promise<void> {
  //   try {
  //     if (this.panel) {
  //       const lesson = await this.learnService.getLesson(issue, OpenCommandIssueType.CodeIssue);
  //       if (lesson) {
  //         void this.panel.webview.postMessage({
  //           type: 'setLesson',
  //           args: { url: lesson.url, title: learnMessages.lessonButtonTitle },
  //         });
  //       } else {
  //         void this.panel.webview.postMessage({
  //           type: 'setLesson',
  //           args: null,
  //         });
  //       }
  //     }
  //   } catch (e) {
  //     ErrorHandler.handle(e, this.logger, learnMessages.getLessonError);
  //   }
  // }

  async showPanel(issue: Issue<IacIssueData>): Promise<void> {
    try {
      await this.focusSecondEditorGroup();

      if (this.panel) {
        this.panel.title = issue.title;
        this.panel.reveal(vscode.ViewColumn.Two, true);
      } else {
        this.panel = vscode.window.createWebviewPanel(
          SNYK_VIEW_SUGGESTION_IAC,
          issue.title,
          {
            viewColumn: vscode.ViewColumn.Two,
            preserveFocus: true,
          },
          this.getWebviewOptions(),
        );
        this.registerListeners();
      }

      this.panel.webview.html = this.getHtmlForWebview(this.panel.webview);

      await this.panel.webview.postMessage({ type: 'set', args: this.mapToModel(issue) });

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
    // this.panel.webview.onDidReceiveMessage(msg => this.handleMessage(msg), undefined, this.disposables);
  }

  disposePanel(): void {
    super.disposePanel();
  }

  protected onPanelDispose(): void {
    super.onPanelDispose();
  }

  private mapToModel(issue: Issue<IacIssueData>): Suggestion {
    return {
      id: issue.id,
      title: issue.title,
      uri: issue.filePath,
      severity: _.capitalize(issue.severity),
      ...issue.additionalData,
    };
  }

  // private async handleMessage(message: any) {
  //   try {
  //     const { type, args } = message;
  //     switch (type) {
  //       case 'openLocal': {
  //         const { uri, cols, rows, suggestionUri } = args as {
  //           uri: string;
  //           cols: [number, number];
  //           rows: [number, number];
  //           suggestionUri: string;
  //         };
  //         const localUriPath = getAbsoluteMarkerFilePath(this.workspace, uri, suggestionUri);
  //         const localUri = vscode.Uri.parse(localUriPath);
  //         const range = IssueUtils.createVsCodeRangeFromRange(rows, cols, this.languages);
  //         await vscode.commands.executeCommand(SNYK_OPEN_LOCAL_COMMAND, localUri, range);
  //         break;
  //       }
  //       case 'openBrowser': {
  //         const { url } = args as { url: string };
  //         await vscode.commands.executeCommand(SNYK_OPEN_BROWSER_COMMAND, url);
  //         break;
  //       }
  //       case 'ignoreIssue': {
  //         const { lineOnly, message, rule, uri, cols, rows } = args as {
  //           lineOnly: boolean;
  //           message: string;
  //           rule: string;
  //           uri: string;
  //           cols: [number, number];
  //           rows: [number, number];
  //         };
  //         const vscodeUri = vscode.Uri.parse(uri);
  //         const range = IssueUtils.createVsCodeRangeFromRange(rows, cols, this.languages);
  //         await vscode.commands.executeCommand(SNYK_IGNORE_ISSUE_COMMAND, {
  //           uri: vscodeUri,
  //           matchedIssue: { message, range },
  //           ruleId: rule,
  //           isFileIgnore: !lineOnly,
  //         });
  //         this.panel?.dispose();
  //         break;
  //       }
  //       default: {
  //         throw new Error('Unknown message type');
  //       }
  //     }
  //   } catch (e) {
  //     ErrorHandler.handle(e, this.logger, errorMessages.suggestionViewMessageHandlingFailed(JSON.stringify(message)));
  //   }
  // }

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
