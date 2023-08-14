import _ from 'lodash';
import * as vscode from 'vscode';
import {
  SNYK_IGNORE_ISSUE_COMMAND,
  SNYK_OPEN_BROWSER_COMMAND,
  SNYK_OPEN_LOCAL_COMMAND,
} from '../../../common/constants/commands';
import { SNYK_VIEW_SUGGESTION_CODE } from '../../../common/constants/views';
import { ErrorHandler } from '../../../common/error/errorHandler';
import { CodeIssueData, ExampleCommitFix, Issue, Marker, Point } from '../../../common/languageServer/types';
import { ILog } from '../../../common/logger/interfaces';
import { messages as learnMessages } from '../../../common/messages/learn';
import { LearnService } from '../../../common/services/learnService';
import { getNonce } from '../../../common/views/nonce';
import { WebviewPanelSerializer } from '../../../common/views/webviewPanelSerializer';
import { WebviewProvider } from '../../../common/views/webviewProvider';
import { ExtensionContext } from '../../../common/vscode/extensionContext';
import { IVSCodeLanguages } from '../../../common/vscode/languages';
import { IVSCodeWindow } from '../../../common/vscode/window';
import { IVSCodeWorkspace } from '../../../common/vscode/workspace';
import { WEBVIEW_PANEL_QUALITY_TITLE, WEBVIEW_PANEL_SECURITY_TITLE } from '../../constants/analysis';
import { messages as errorMessages } from '../../messages/error';
import { getAbsoluteMarkerFilePath } from '../../utils/analysisUtils';
import { IssueUtils } from '../../utils/issueUtils';
import { ICodeSuggestionWebviewProvider } from '../interfaces';

type Suggestion = {
  id: string;
  message: string;
  severity: string;
  leadURL?: string;
  rule: string;
  repoDatasetSize: number;
  exampleCommitFixes: ExampleCommitFix[];
  cwe: string[];
  title: string;
  text: string;
  isSecurityType: boolean;
  uri: string;
  markers?: Marker[];
  cols: Point;
  rows: Point;
};

export class CodeSuggestionWebviewProvider
  extends WebviewProvider<Issue<CodeIssueData>>
  implements ICodeSuggestionWebviewProvider
{
  // For consistency reasons, the single source of truth for the current suggestion is the
  // panel state. The following field is only used in
  private issue: Issue<CodeIssueData> | undefined;

  constructor(
    private readonly window: IVSCodeWindow,
    protected readonly context: ExtensionContext,
    protected readonly logger: ILog,
    private readonly languages: IVSCodeLanguages,
    private readonly workspace: IVSCodeWorkspace,
    private readonly learnService: LearnService,
  ) {
    super(context, logger);
  }

  activate(): void {
    this.context.addDisposables(
      this.window.registerWebviewPanelSerializer(SNYK_VIEW_SUGGESTION_CODE, new WebviewPanelSerializer(this)),
    );
  }

  get openIssueId(): string | undefined {
    return this.issue?.id;
  }

  async postLearnLessonMessage(issue: Issue<CodeIssueData>): Promise<void> {
    try {
      if (this.panel) {
        const lesson = await this.learnService.getCodeLesson(issue);
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

  async showPanel(issue: Issue<CodeIssueData>): Promise<void> {
    try {
      await this.focusSecondEditorGroup();

      if (this.panel) {
        this.panel.title = this.getTitle(issue);
        this.panel.reveal(vscode.ViewColumn.Two, true);
      } else {
        this.panel = vscode.window.createWebviewPanel(
          SNYK_VIEW_SUGGESTION_CODE,
          this.getTitle(issue),
          {
            viewColumn: vscode.ViewColumn.Two,
            preserveFocus: true,
          },
          this.getWebviewOptions(),
        );
        this.registerListeners();
      }

      this.panel.webview.html = this.getHtmlForWebview(this.panel.webview);

      void this.panel.webview.postMessage({ type: 'set', args: this.mapToModel(issue) });
      void this.postLearnLessonMessage(issue);

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

  private mapToModel(issue: Issue<CodeIssueData>): Suggestion {
    return {
      id: issue.id,
      title: issue.title,
      uri: issue.filePath,
      severity: _.capitalize(issue.severity),
      ...issue.additionalData,
    };
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
          const localUri = vscode.Uri.file(localUriPath);
          const range = IssueUtils.createVsCodeRangeFromRange(rows, cols, this.languages);
          await vscode.commands.executeCommand(SNYK_OPEN_LOCAL_COMMAND, localUri, range);
          break;
        }
        case 'openBrowser': {
          const { url } = args as { url: string };
          await vscode.commands.executeCommand(SNYK_OPEN_BROWSER_COMMAND, url);
          break;
        }
        case 'ignoreIssue': {
          const { lineOnly, message, rule, uri, cols, rows } = args as {
            lineOnly: boolean;
            message: string;
            rule: string;
            uri: string;
            cols: [number, number];
            rows: [number, number];
          };
          const vscodeUri = vscode.Uri.file(uri);
          const range = IssueUtils.createVsCodeRangeFromRange(rows, cols, this.languages);
          await vscode.commands.executeCommand(SNYK_IGNORE_ISSUE_COMMAND, {
            uri: vscodeUri,
            matchedIssue: { message, range },
            ruleId: rule,
            isFileIgnore: !lineOnly,
          });
          this.panel?.dispose();
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

  private getTitle(issue: Issue<CodeIssueData>): string {
    return issue.additionalData.isSecurityType ? WEBVIEW_PANEL_SECURITY_TITLE : WEBVIEW_PANEL_QUALITY_TITLE;
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
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">

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
              <img class="icon" src="${images['icon-lines']}" /> This <span class="issue-type">issue</span> happens on line <span id="line-position"></span>
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
              <button id="ignore-line-issue" class="button">Ignore on line <span id="line-position2"></span></button>
              <button id="ignore-file-issue" class="button">Ignore in this file</button>
            </div>
          </div>
        </section>
      </div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
  </html>`;
  }
}
