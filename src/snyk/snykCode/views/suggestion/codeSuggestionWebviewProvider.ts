import _ from 'lodash';
import { relative } from 'path';
import { applyPatch } from 'diff';
import { marked } from 'marked';
import * as vscode from 'vscode';
import {
  SNYK_CODE_FIX_DIFFS_COMMAND,
  SNYK_GENERATE_ISSUE_DESCRIPTION,
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
import { WEBVIEW_PANEL_SECURITY_TITLE } from '../../constants/analysis';
import { messages as errorMessages } from '../../messages/error';
import { getAbsoluteMarkerFilePath } from '../../utils/analysisUtils';
import { generateDecorationOptions } from '../../utils/patchUtils';
import { IssueUtils } from '../../utils/issueUtils';
import { ICodeSuggestionWebviewProvider } from '../interfaces';
import { readFileSync } from 'fs';
import { TextDocument } from '../../../common/vscode/types';
import { Suggestion, SuggestionMessage } from './types';
import { WebviewPanelSerializer } from '../../../snykCode/views/webviewPanelSerializer';
import { configuration } from '../../../common/configuration/instance';
import { FEATURE_FLAGS } from '../../../common/constants/featureFlags';
import { IVSCodeCommands } from '../../../common/vscode/commands';

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
    private commandExecutor: IVSCodeCommands,
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
    try {
      await this.focusSecondEditorGroup();
      if (this.panel) {
        this.panel.title = this.getTitle();
        this.panel.reveal(vscode.ViewColumn.Two, true);
      } else {
        this.panel = vscode.window.createWebviewPanel(
          SNYK_VIEW_SUGGESTION_CODE,
          this.getTitle(),
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
      // TODO: delete this when SNYK_GENERATE_ISSUE_DESCRIPTION command is in stable CLI.
      let html: string;
      if (issue.additionalData.details) {
        html = issue.additionalData.details;
      } else {
        html = (await this.commandExecutor.executeCommand(SNYK_GENERATE_ISSUE_DESCRIPTION, issue.id)) ?? '';
      }
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
      html = html.replace('--default-font: ', '--default-font: var(--vscode-font-family) ,');
      this.panel.webview.html = html;
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
            // todo(berkay.berabi): Here if suggestions are empty, we should post a different type of message that
            // will show the user correct information, namely: we tried but no fixes available for now.

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

  private getTitle(): string {
    return WEBVIEW_PANEL_SECURITY_TITLE;
  }
}
