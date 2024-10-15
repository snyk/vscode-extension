import _ from 'lodash';
import { relative } from 'path';
import { applyPatch } from 'diff';
import { marked } from 'marked';
import * as vscode from 'vscode';
import {
  SNYK_CODE_FIX_DIFFS_COMMAND,
  SNYK_CODE_SUBMIT_FIX_FEEDBACK,
  SNYK_IGNORE_ISSUE_COMMAND,
  SNYK_OPEN_BROWSER_COMMAND,
  SNYK_OPEN_LOCAL_COMMAND,
} from '../../../common/constants/commands';
import { SNYK_VIEW_SUGGESTION_CODE } from '../../../common/constants/views';
import { ErrorHandler } from '../../../common/error/errorHandler';
import { AutofixUnifiedDiffSuggestion, CodeIssueData, Issue } from '../../../common/languageServer/types';
import { ILog } from '../../../common/logger/interfaces';
import { messages as learnMessages } from '../../../common/messages/learn';
import { LearnService } from '../../../common/services/learnService';
import { getNonce } from '../../../common/views/nonce';
import { WebviewProvider } from '../../../common/views/webviewProvider';
import { ExtensionContext } from '../../../common/vscode/extensionContext';
import { IVSCodeLanguages } from '../../../common/vscode/languages';
import { IVSCodeWindow } from '../../../common/vscode/window';
import { IVSCodeWorkspace } from '../../../common/vscode/workspace';
import { WEBVIEW_PANEL_QUALITY_TITLE, WEBVIEW_PANEL_SECURITY_TITLE } from '../../constants/analysis';
import { messages as errorMessages } from '../../messages/error';
import { getAbsoluteMarkerFilePath } from '../../utils/analysisUtils';
import { encodeExampleCommitFixes } from '../../utils/htmlEncoder';
import { generateDecorationOptions } from '../../utils/patchUtils';
import { IssueUtils } from '../../utils/issueUtils';
import { ICodeSuggestionWebviewProvider } from '../interfaces';
import { readFileSync } from 'fs';
import { TextDocument } from '../../../common/vscode/types';
import { Suggestion, SuggestionMessage } from './types';
import { WebviewPanelSerializer } from '../../../snykCode/views/webviewPanelSerializer';
import { configuration } from '../../../common/configuration/instance';
import { FEATURE_FLAGS } from '../../../common/constants/featureFlags';

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

  private async postSuggestMessage(message: SuggestionMessage): Promise<void> {
    await this.panel?.webview.postMessage(message);
  }

  async postLearnLessonMessage(issue: Issue<CodeIssueData>): Promise<void> {
    try {
      if (this.panel) {
        const lesson = await this.learnService.getCodeLesson(issue);
        if (lesson) {
          void this.postSuggestMessage({
            type: 'setLesson',
            args: { url: lesson.url, title: learnMessages.lessonButtonTitle },
          });
        } else {
          void this.postSuggestMessage({
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
    const isIgnoresEnabled = configuration.getFeatureFlag(FEATURE_FLAGS.consistentIgnores);

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

      this.panel.iconPath = vscode.Uri.joinPath(
        vscode.Uri.file(this.context.extensionPath),
        'media',
        'images',
        'snyk-code.svg',
      );

      if (isIgnoresEnabled) {
        let html = issue.additionalData.details;
        const ideStylePath = vscode.Uri.joinPath(
          vscode.Uri.file(this.context.extensionPath),
          'media',
          'views',
          'snykCode',
          'suggestion',
          'suggestionLS.css',
        );
        const ideStyle = readFileSync(ideStylePath.fsPath, 'utf8');
        const ideScriptPath = vscode.Uri.joinPath(
          vscode.Uri.file(this.context.extensionPath),
          'out',
          'snyk',
          'snykCode',
          'views',
          'suggestion',
          'codeSuggestionWebviewScriptLS.js',
        );
        const ideScript = readFileSync(ideScriptPath.fsPath, 'utf8');
        html = html.replace('${ideStyle}', '<style nonce=${nonce}>' + ideStyle + '</style>');
        html = html.replace('${ideScript}', '<script nonce=${nonce}>' + ideScript + '</script>');
        const nonce = getNonce();
        html = html.replaceAll('${nonce}', nonce);

        this.panel.webview.html = html;
      } else {
        issue.additionalData.exampleCommitFixes = encodeExampleCommitFixes(issue.additionalData.exampleCommitFixes);

        this.panel.webview.html = this.getHtmlForWebview(this.panel.webview);
        this.panel.iconPath = vscode.Uri.joinPath(
          vscode.Uri.file(this.context.extensionPath),
          'media',
          'images',
          'snyk-code.svg',
        );
      }

      void this.postSuggestMessage({ type: 'set', args: this.mapToModel(issue) });
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
    this.panel.webview.onDidReceiveMessage(
      (msg: SuggestionMessage) => this.handleMessage(msg),
      undefined,
      this.disposables,
    );
  }

  disposePanel(): void {
    super.disposePanel();
  }

  protected onPanelDispose(): void {
    super.onPanelDispose();
  }

  private getWorkspaceFolderPath(filePath: string) {
    // get the workspace folders
    // look at the filepath and identify the folder that contains the filepath
    for (const folderPath of this.workspace.getWorkspaceFolders()) {
      if (filePath.startsWith(folderPath)) {
        return folderPath;
      }
    }
    throw new Error(`Unable to find workspace for: ${filePath}`);
  }

  private mapToModel(issue: Issue<CodeIssueData>): Suggestion {
    const parsedDetails = marked.parse(issue.additionalData.text) as string;
    const showInlineIgnoresButton = configuration.getFeatureFlag(FEATURE_FLAGS.snykCodeInlineIgnore);

    return {
      id: issue.id,
      title: issue.title,
      severity: _.capitalize(issue.severity),
      ...issue.additionalData,
      text: parsedDetails,
      hasAIFix: issue.additionalData.hasAIFix,
      filePath: issue.filePath,
      showInlineIgnoresButton,
    };
  }

  private async handleMessage(message: SuggestionMessage) {
    try {
      switch (message.type) {
        case 'openLocal': {
          const { uri, cols, rows, suggestionUri } = message.args;
          const localUriPath = getAbsoluteMarkerFilePath(this.workspace, uri, suggestionUri);
          const localUri = vscode.Uri.file(localUriPath);
          const range = IssueUtils.createVsCodeRangeFromRange(rows, cols, this.languages);
          await vscode.commands.executeCommand(SNYK_OPEN_LOCAL_COMMAND, localUri, range);
          break;
        }

        case 'openBrowser': {
          const { url } = message.args;
          await vscode.commands.executeCommand(SNYK_OPEN_BROWSER_COMMAND, url);
          break;
        }

        case 'ignoreIssue': {
          const { lineOnly, rule, uri, cols, rows } = message.args;
          const vscodeUri = vscode.Uri.file(uri);
          const range = IssueUtils.createVsCodeRangeFromRange(rows, cols, this.languages);
          await vscode.commands.executeCommand(SNYK_IGNORE_ISSUE_COMMAND, {
            uri: vscodeUri,
            matchedIssue: {
              message: message.args.message,
              range,
            },
            ruleId: rule,
            isFileIgnore: !lineOnly,
          });
          this.panel?.dispose();
          break;
        }

        case 'getAutofixDiffs': {
          this.logger.info('Generating fixes');

          const { suggestion } = message.args;
          try {
            const filePath = suggestion.filePath;
            const folderPath = this.getWorkspaceFolderPath(filePath);
            const relativePath = relative(folderPath, filePath);

            const issueId = suggestion.id;

            const diffs: AutofixUnifiedDiffSuggestion[] = await vscode.commands.executeCommand(
              SNYK_CODE_FIX_DIFFS_COMMAND,
              folderPath,
              relativePath,
              issueId,
            );
            if (diffs.length === 0) {
              throw Error('Unable to generate a relevant fix');
            }

            void this.postSuggestMessage({ type: 'setAutofixDiffs', args: { suggestion, diffs } });
          } catch (error) {
            void this.postSuggestMessage({ type: 'setAutofixError', args: { suggestion } });
          }

          break;
        }

        case 'applyGitDiff': {
          const { patch, filePath, fixId } = message.args;

          const fileContent = readFileSync(filePath, 'utf8');
          const patchedContent = applyPatch(fileContent, patch);

          if (!patchedContent) {
            throw Error('Failed to apply patch');
          }
          const edit = new vscode.WorkspaceEdit();

          const editor = vscode.window.visibleTextEditors.find(editor => editor.document.uri.fsPath === filePath);

          if (!editor) {
            throw Error(`Editor with file not found: ${filePath}`);
          }

          const editorEndLine = editor.document.lineCount;
          edit.replace(vscode.Uri.file(filePath), new vscode.Range(0, 0, editorEndLine, 0), patchedContent);

          const success = await vscode.workspace.applyEdit(edit);
          if (!success) {
            throw Error('Failed to apply edit to workspace');
          }

          this.highlightAddedCode(filePath, patch);
          this.setupCloseOnSave(filePath);

          try {
            await vscode.commands.executeCommand(SNYK_CODE_SUBMIT_FIX_FEEDBACK, fixId, 'FIX_APPLIED');
          } catch (e) {
              throw new Error('Error in submit fix feedback');
          }
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

  private setupCloseOnSave(filePath: string) {
    vscode.workspace.onDidSaveTextDocument((e: TextDocument) => {
      if (e.uri.fsPath == filePath) {
        this.panel?.dispose();
      }
    });
  }

  private highlightAddedCode(filePath: string, diffData: string) {
    const highlightDecoration = vscode.window.createTextEditorDecorationType({
      // seems to work well with both dark and light backgrounds
      backgroundColor: 'rgba(0,255,0,0.3)',
    });

    const editor = vscode.window.visibleTextEditors.find(editor => editor.document.uri.fsPath === filePath);
    if (!editor) {
      return; // No open editor found with the target file
    }

    const decorationOptions = generateDecorationOptions(diffData, this.languages);
    if (decorationOptions.length === 0) {
      return;
    }

    editor.setDecorations(highlightDecoration, decorationOptions);

    const firstLine = decorationOptions[0].range.start.line;

    // scroll to first added line
    const line = editor.document.lineAt(firstLine);
    const range = line.range;
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);

    // remove highlight on any of:
    // - user types
    // - saves the doc
    // - after an amount of time

    const removeHighlights = () => {
      editor.setDecorations(highlightDecoration, []);
      listeners.forEach(listener => {
        if (listener instanceof vscode.Disposable) listener.dispose();
        else clearTimeout(listener);
      });
    };

    const documentEventHandler = (document: TextDocument) => {
      if (document.uri.fsPath == filePath) {
        removeHighlights();
      }
    };

    const listeners = [
      setTimeout(removeHighlights, 30000),
      vscode.workspace.onDidSaveTextDocument(documentEventHandler),
      vscode.workspace.onDidChangeTextDocument(e => documentEventHandler(e.document)),
    ];
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
            <span id='fix-analysis-tab' class="tab-item is-selected sn-fix-analysis">Fix Analysis</span>
            <span id='vuln-overview-tab' class="tab-item sn-vuln-overview">Vulnerability Overview</span>
          </div>
        </section>

        <div id='fix-analysis-content' class="tab-content is-selected sn-fix-content">
          <section id="suggestion-info" class="delimiter-top">
            <div id="description" class="suggestion-text"></div>
            <div class="suggestion-links">
              <div id="lead-url" class="clickable hidden">
                <img class="icon" src="${images['icon-external']}" /> More info
              </div>
            </div>
          </section>

          <section id="fix-wrapper" class="ai-fix">
            <p>⚡ Fix this issue by generating a solution using Snyk DeepCode AI</p>

            <div class="sn-fix-wrapper">
              <button id="generate-ai-fix" class="generate-ai-fix">✨ Generate fix <span class="wide">using Snyk DeepCode AI</span></button>

              <div id="fix-loading-indicator" class="sn-loading hidden">
                <div class="sn-loading-icon">
                  <svg id="scan-animation" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 248 204" shape-rendering="geometricPrecision"><defs><linearGradient id="mg" x1="16.0903" y1="180" x2="92.743" y2="107.462" spreadMethod="pad" gradientUnits="userSpaceOnUse" gradientTransform="translate(0 0)"><stop id="eQeHIUZsTfX2-fill-0" offset="0%" stop-color="#145deb"/><stop id="eQeHIUZsTfX2-fill-1" offset="100%" stop-color="#441c99"/></linearGradient><linearGradient id="sg" x1="116" y1="0" x2="116" y2="64" spreadMethod="pad" gradientUnits="userSpaceOnUse" gradientTransform="translate(0 0)"><stop id="eQeHIUZsTfX26-fill-0" offset="0%" stop-color="#ff78e1"/><stop id="eQeHIUZsTfX26-fill-1" offset="100%" stop-color="rgba(255,120,225,0)"/></linearGradient></defs><rect width="224" height="180" rx="16" ry="16" transform="translate(12 12)" fill="url(#mg)"/><circle r="4" transform="translate(28 28)" opacity="0.3" fill="#fff"/><circle r="4" transform="translate(40 28)" opacity="0.25" fill="#fff"/><circle r="4" transform="translate(52 28)" opacity="0.2" fill="#fff"/><rect width="48" height="12" rx="6" ry="6" transform="translate(162 56)" opacity="0.2" fill="#fff"/><rect width="80" height="12" rx="6" ry="6" transform="translate(32 92)" opacity="0.2" fill="#fff"/><rect width="72" height="12" rx="6" ry="6" transform="translate(96 164)" opacity="0.2" fill="#fff"/><rect width="56" height="12" rx="6" ry="6" transform="translate(156 128)" opacity="0.2" fill="#fff"/><rect id="l3" width="80" height="12" rx="6" ry="6" transform="translate(64 128)"/><rect id="l2" width="64" height="12" rx="6" ry="6" transform="translate(150 92)"/><rect id="l1" width="117" height="12" rx="6" ry="6" transform="translate(32 56)"/><g id="b3"><rect width="32" height="32" rx="6" ry="6" transform="translate(48 118)" fill="#43b59a"/><path d="M54.5991,134c.7987-.816,2.0938-.816,2.8926,0l2.8926,2.955l10.124-10.343c.7988-.816,2.0939-.816,2.8926,0c.7988.816.7988,2.139,0,2.955L61.8306,141.388c-.7988.816-2.0939.816-2.8926,0l-4.3389-4.433c-.7988-.816-.7988-2.139,0-2.955Z" fill="#fff"/></g><g id="b2"><rect width="32" height="32" rx="6" ry="6" transform="translate(124 81)" fill="#f97a99"/><path d="M142,91c0,.7685-.433,5.3087-1.069,8h-1.862c-.636-2.6913-1.069-7.2315-1.069-8c0-1.1046.895-2,2-2s2,.8954,2,2Z" fill="#fff"/><path d="M140,104c1.105,0,2-.895,2-2s-.895-2-2-2-2,.895-2,2s.895,2,2,2Z" fill="#fff"/></g><g id="b1"><rect width="24" height="24" rx="6" ry="6" transform="translate(28 50)" fill="#f97a99"/><path d="M42,56c0,.7685-.4335,5.3087-1.0693,8h-1.8614C38.4335,61.3087,38,56.7685,38,56c0-1.1046.8954-2,2-2s2,.8954,2,2Z" fill="#fff"/><path d="M40,69c1.1046,0,2-.8954,2-2s-.8954-2-2-2-2,.8954-2,2s.8954,2,2,2Z" fill="#fff"/></g><g id="s0" transform="translate(124,-40)"><g transform="translate(-124,-40)"><rect width="232" height="64" rx="0" ry="0" transform="matrix(1 0 0-1 8 64)" opacity="0.5" fill="url(#sg)"/><rect width="248" height="16" rx="8" ry="8" transform="translate(0 64)" fill="#e555ac"/></g></g></svg>
                </div>
                <div class="sn-loading-wrapper">
                  <div class="sn-loading-message sn-msg-1">
                    <span class="sn-loading-title">1<span class="font-light">/4</span> Code Reduction...</span>
                    <p class="sn-loading-description">Reduces the given files to a smaller and relevant code snippet.</p>
                  </div>
                  <div class="sn-loading-message sn-msg-2">
                    <span class="sn-loading-title">2<span class="font-light">/4</span> Parsing...</span>
                    <p class="sn-loading-description">Analyzing symbols and generating the graph representation.</p>
                  </div>
                  <div class="sn-loading-message sn-msg-3">
                    <span class="sn-loading-title">3<span class="font-light">/4</span> Static Analysis...</span>
                    <p class="sn-loading-description">Examining the vulnerability code without having to execute the program.</p>
                  </div>
                  <div class="sn-loading-message sn-msg-4">
                    <span class="sn-loading-title">4<span class="font-light">/4</span> Inferencing...</span>
                    <p class="sn-loading-description">Feeding the reduced code to our neural network to obtain the prediction.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="fixes-section" class="sn-ai-fixes hidden">
          <div id="info-no-diffs" class="font-light">
          There are no fix diffs for this issue.
          </div>
          <div id="diff-top" class="row between">
              <div id="info-top" class="font-light">Here are <span id="diff-number"></span> AI-generated solutions:</div>
              <div class="diffs-nav">
                <span id="previous-diff" class="arrow" title="Previous diff">
                  <img src=${images['arrow-left-dark']} class="arrow-icon dark-only"></img>
                  <img src=${images['arrow-left-light']} class="arrow-icon light-only"></img>
                </span>
                <span id="diff-text">
                  AI solution <strong id="diff-counter">1</strong>/<span id="diff-number2"></span>
                </span>
                <span id="next-diff" class="arrow" title="Next diff">
                  <img src=${images['arrow-right-dark']} class="arrow-icon dark-only"></img>
                  <img src=${images['arrow-right-light']} class="arrow-icon light-only"></img>
                </span>
              </div>
            </div>
            <div id="diff"></div>
            <button id="apply-fix" class="button sn-apply-fix">Apply fix</button>
          </section>

          <section id="fixes-error-section" class="sn-ai-fix-error hidden">
            <div id="info-no-diffs" class="font-light">
            ⚠️ There was an issue generating the fix
            </div>
            <div class="sn-fix-wrapper">
              <button id="retry-generate-fix" class="button generate-ai-fix">✨ Retry generating AI fixes</button>
            </div>
          </section>

          <section class="sn-community-fixes delimiter-top">
            <h2>Community fixes</h2>
            <p id="info-top" class="font-light">
              This type of <span class="issue-type">vulnerability</span> was fixed in <span id="dataset-number"></span> open source projects. Here are <span id="example-number"></span> examples:
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
            <div id="example" class="example"></div>
          </section>
        </div>

        <div id="vuln-overview-content" class="tab-content sn-vuln-content">
          <section class="delimiter-top suggestion-details-content">
            <div id="suggestion-details" class="suggestion-details"></div>
          </section>
        </div>

        <section class="suggestion-actions delimiter-top">
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
