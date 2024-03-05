import _ from 'lodash';
import { marked } from 'marked';
import * as vscode from 'vscode';
import {
  SNYK_CODE_FIX_DIFFS_COMMAND,
  SNYK_IGNORE_ISSUE_COMMAND,
  SNYK_OPEN_BROWSER_COMMAND,
  SNYK_OPEN_LOCAL_COMMAND,
} from '../../../common/constants/commands';
import { SNYK_VIEW_SUGGESTION_CODE } from '../../../common/constants/views';
import { ErrorHandler } from '../../../common/error/errorHandler';
import {
  AutofixUnifiedDiffSuggestion,
  CodeIssueData,
  ExampleCommitFix,
  Issue,
  Marker,
  Point,
} from '../../../common/languageServer/types';
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
import { encodeExampleCommitFixes } from '../../utils/htmlEncoder';
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
  hasAIFix: boolean;
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

      issue.additionalData.exampleCommitFixes = encodeExampleCommitFixes(issue.additionalData.exampleCommitFixes);

      this.panel.webview.html = this.getHtmlForWebview(this.panel.webview);
      this.panel.iconPath = vscode.Uri.joinPath(
        vscode.Uri.file(this.context.extensionPath),
        'media',
        'images',
        'snyk-code.svg',
      );

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
    const parsedDetails = marked.parse(issue.additionalData.text) as string;
    return {
      id: issue.id,
      title: issue.title,
      uri: issue.filePath,
      severity: _.capitalize(issue.severity),
      ...issue.additionalData,
      text: parsedDetails,
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
        case 'getAutofixDiff': {
          const { baseDir, uri } = args as {
            baseDir: string;
            uri: string;
          };
          const vscodeUri = vscode.Uri.file(uri);
          console.log('getAutofixDiff', baseDir, vscodeUri, this.openIssueId); // TODO remove
          const diffs: AutofixUnifiedDiffSuggestion = await vscode.commands.executeCommand(
            SNYK_CODE_FIX_DIFFS_COMMAND,
            baseDir,
            vscodeUri,
            this.openIssueId,
          );
          console.log('posting diffs', diffs); // TODO remove
          void this.panel?.webview.postMessage({ type: 'setAutofixDiff', args: diffs });
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
      ['icon-external', 'svg'],
      ['icon-code', 'svg'],
      ['icon-github', 'svg'],
      ['icon-like', 'svg'],
      ['dark-low-severity', 'svg'],
      ['dark-medium-severity', 'svg'],
      ['dark-high-severity', 'svg'],
      ['light-icon-critical', 'svg'],
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
    const styleVSCodeUri = this.getWebViewUri('media', 'views', 'common', 'vscode.css');
    const styleUri = this.getWebViewUri('media', 'views', 'snykCode', 'suggestion', 'suggestion.css');
    const learnStyleUri = this.getWebViewUri('media', 'views', 'common', 'learn.css');

    const nonce = getNonce();
    return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">

      <link href="${styleVSCodeUri}" rel="stylesheet">
      <link href="${styleUri}" rel="stylesheet">
      <link href="${learnStyleUri}" rel="stylesheet">
  </head>
  <body>
      <div class="suggestion">
        <section class="suggestion--header">
          <div id="severity">
            <img id="sev1" class="icon hidden" src="${images['dark-low-severity']}" />
            <img id="sev2" class="icon hidden" src="${images['dark-medium-severity']}" />
            <img id="sev3" class="icon hidden" src="${images['dark-high-severity']}" />
            <span id="severity-text"></span>
          </div>
          <div id="title" class="suggestion-title"></div>

          <div id="meta" class="suggestion-metas"></div>

          <div class="learn learn__code">
            <img class="icon" src="${images['learn-icon']}" />
            <a class="learn--link is-external"></a>
          </div>

          <div class="tabs-nav">
            <span class="tab-item is-selected sn-fix-analysis">Fix Analysis</span>
            <span class="tab-item sn-vuln-overview">Vulnerability Overview</span>
          </div>
        </section>

        <div class="tab-content is-selected sn-fix-content">
          <section id="suggestion-info" class="delimiter-top">
            <div id="description" class="suggestion-text"></div>
            <div class="suggestion-links">
              <div id="lead-url" class="clickable hidden">
                <img class="icon" src="${images['icon-external']}" /> More info
              </div>
            </div>
          </section>

          <section class="ai-fix">
            <div class="sn-"
            <p>⚡ Fix this issue by generating a solution using DeepCode AI</p>
            <button class="generate-ai-fix" hidden>Generate AI fix <span class="wide">using DeepCode AI</span></button>


            <div class="sn-loading">
              <div class="sn-loading-icon">
                <svg id="scan-animation" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 248 204" shape-rendering="geometricPrecision"><defs><linearGradient id="mg" x1="16.0903" y1="180" x2="92.743" y2="107.462" spreadMethod="pad" gradientUnits="userSpaceOnUse" gradientTransform="translate(0 0)"><stop id="eQeHIUZsTfX2-fill-0" offset="0%" stop-color="#145deb"/><stop id="eQeHIUZsTfX2-fill-1" offset="100%" stop-color="#441c99"/></linearGradient><linearGradient id="sg" x1="116" y1="0" x2="116" y2="64" spreadMethod="pad" gradientUnits="userSpaceOnUse" gradientTransform="translate(0 0)"><stop id="eQeHIUZsTfX26-fill-0" offset="0%" stop-color="#ff78e1"/><stop id="eQeHIUZsTfX26-fill-1" offset="100%" stop-color="rgba(255,120,225,0)"/></linearGradient></defs><rect width="224" height="180" rx="16" ry="16" transform="translate(12 12)" fill="url(#mg)"/><circle r="4" transform="translate(28 28)" opacity="0.3" fill="#fff"/><circle r="4" transform="translate(40 28)" opacity="0.25" fill="#fff"/><circle r="4" transform="translate(52 28)" opacity="0.2" fill="#fff"/><rect width="48" height="12" rx="6" ry="6" transform="translate(162 56)" opacity="0.2" fill="#fff"/><rect width="80" height="12" rx="6" ry="6" transform="translate(32 92)" opacity="0.2" fill="#fff"/><rect width="72" height="12" rx="6" ry="6" transform="translate(96 164)" opacity="0.2" fill="#fff"/><rect width="56" height="12" rx="6" ry="6" transform="translate(156 128)" opacity="0.2" fill="#fff"/><rect id="l3" width="80" height="12" rx="6" ry="6" transform="translate(64 128)"/><rect id="l2" width="64" height="12" rx="6" ry="6" transform="translate(150 92)"/><rect id="l1" width="117" height="12" rx="6" ry="6" transform="translate(32 56)"/><g id="b3"><rect width="32" height="32" rx="6" ry="6" transform="translate(48 118)" fill="#43b59a"/><path d="M54.5991,134c.7987-.816,2.0938-.816,2.8926,0l2.8926,2.955l10.124-10.343c.7988-.816,2.0939-.816,2.8926,0c.7988.816.7988,2.139,0,2.955L61.8306,141.388c-.7988.816-2.0939.816-2.8926,0l-4.3389-4.433c-.7988-.816-.7988-2.139,0-2.955Z" fill="#fff"/></g><g id="b2"><rect width="32" height="32" rx="6" ry="6" transform="translate(124 81)" fill="#f97a99"/><path d="M142,91c0,.7685-.433,5.3087-1.069,8h-1.862c-.636-2.6913-1.069-7.2315-1.069-8c0-1.1046.895-2,2-2s2,.8954,2,2Z" fill="#fff"/><path d="M140,104c1.105,0,2-.895,2-2s-.895-2-2-2-2,.895-2,2s.895,2,2,2Z" fill="#fff"/></g><g id="b1"><rect width="24" height="24" rx="6" ry="6" transform="translate(28 50)" fill="#f97a99"/><path d="M42,56c0,.7685-.4335,5.3087-1.0693,8h-1.8614C38.4335,61.3087,38,56.7685,38,56c0-1.1046.8954-2,2-2s2,.8954,2,2Z" fill="#fff"/><path d="M40,69c1.1046,0,2-.8954,2-2s-.8954-2-2-2-2,.8954-2,2s.8954,2,2,2Z" fill="#fff"/></g><g id="s0" transform="translate(124,-40)"><g transform="translate(-124,-40)"><rect width="232" height="64" rx="0" ry="0" transform="matrix(1 0 0-1 8 64)" opacity="0.5" fill="url(#sg)"/><rect width="248" height="16" rx="8" ry="8" transform="translate(0 64)" fill="#e555ac"/></g></g></svg>
              </div>
              <div class="sn-loading-wrapper">
                <div class="sn-loading-message sn-msg-1">
                  <span class="sn-loading-title">Code Reduction</span>
                  <p class="sn-loading-description">Reduces the given files to a smaller code snippet, focusing on the relevant portions of code to perform the fix.</p>
                </div>
                <div class="sn-loading-message sn-msg-2">
                  <span class="sn-loading-title">Parsing</span>
                  <p class="sn-loading-description">Analyzing symbols and generating the graph representation.</p>
                </div>
                <div class="sn-loading-message sn-msg-3">
                  <span class="sn-loading-title">Static Analysis</span>
                  <p class="sn-loading-description">Examining the source code of the vulnerability without having to execute the program.</p>
                </div>
                <div class="sn-loading-message sn-msg-4">
                  <span class="sn-loading-title">NN Inferencing</span>
                  <p class="sn-loading-description">Feeding the reduced code to our neural network to obtain the prediction.</p>
                </div>
              </div>
            </div>
          </section>

          <section class="delimiter-top" hidden>
            <p id="info-top" class="font-light">
              This type of <span class="issue-type">issue</span> can be fixed by our AI. Here are <span id="diff-number"></span> diffs:
            </p>
            <div id="info-no-diffs" class="font-light">
              There are no fix diffs for this issue.
            </div>
            <div id="diff-top" class="row between">
              <div id="current-diff" class="repo clickable">
                <img class="repo-icon icon" src="${images['icon-github']}"></img>
                <span id="diff-link" class="repo-link"></span>
              </div>
              <div class="diffs-nav">
                <span id="previous-diff" class="arrow" title="Previous diff">
                  <img src=${images['arrow-left-dark']} class="arrow-icon dark-only"></img>
                  <img src=${images['arrow-left-light']} class="arrow-icon light-only"></img>
                </span>
                <span id="diff-text">
                  diff <strong id="diff-counter">1</strong>/<span id="diff-number2"></span>
                </span>
                <span id="next-diff" class="arrow" title="Next diff">
                  <img src=${images['arrow-right-dark']} class="arrow-icon dark-only"></img>
                  <img src=${images['arrow-right-light']} class="arrow-icon light-only"></img>
                </span>
              </div>
            </div>
            <div id="diff"></div>
          </section>

          <section class="delimiter-top" hidden>
            <p id="info-top" class="font-light">
              This type of <span class="issue-type">issue</span> was fixed in <span id="dataset-number"></span> open source projects. Here are <span id="diff-number"></span> diffs:
            </p>
            <div id="info-no-examples" class="font-light">
              There are no fix examples for this issue.
            </div>
            <div id="example-top" class="row between">
              <div id="current-example" class="repo clickable">
                <img class="repo-icon icon" src="${images['icon-github']}"></img>
                <span id="example-link" class="repo-link"></span>
              </div>
              <div class="examples-nav">
                <span id="previous-example" class="arrow" title="Previous example">
                  <img src=${images['arrow-left-dark']} class="arrow-icon dark-only"></img>
                  <img src=${images['arrow-left-light']} class="arrow-icon light-only"></img>
                </span>
                <span id="example-text">
                  Example <strong id="example-counter">1</strong>/<span id="example-number2"></span>
                </span>
                <span id="next-example" class="arrow" title="Next example">
                  <img src=${images['arrow-right-dark']} class="arrow-icon dark-only"></img>
                  <img src=${images['arrow-right-light']} class="arrow-icon light-only"></img>
                </span>
              </div>
            </div>
            <div id="example"></div>
          </section>
        </div>

        <div class="tab-content sn-vuln-content">
          <section class="delimiter-top suggestion-details-content">
            <div id="suggestion-details" class="suggestion-details"></div>
          </section>
        </div>

        <section class="delimiter-top">
          <div id="actions-section">
            <div class="actions row">
              <button id="ignore-line-issue" class="button secondary">Ignore on line <span id="line-position2"></span></button>
              <button id="ignore-file-issue" class="button secondary">Ignore in this file</button>
            </div>
          </div>
        </section>
      </div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
  </html>`;
  }
}
