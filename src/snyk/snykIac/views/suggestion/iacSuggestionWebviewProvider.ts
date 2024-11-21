import * as vscode from 'vscode';
import { SNYK_GENERATE_ISSUE_DESCRIPTION, SNYK_OPEN_BROWSER_COMMAND } from '../../../common/constants/commands';
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
import { readFileSync } from 'fs';
import { IVSCodeCommands } from '../../../common/vscode/commands';
// import { getAbsoluteMarkerFilePath } from '../../utils/analysisUtils';
// import { IssueUtils } from '../../utils/issueUtils';
// import { ICodeSuggestionWebviewProvider } from '../interfaces';

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
    private commandExecutor: IVSCodeCommands,
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

  async showPanel(issue: Issue<IacIssueData>): Promise<void> {
    try {
      await this.focusSecondEditorGroup();

      if (this.panel) {
        this.panel.reveal(vscode.ViewColumn.Two, true);
      } else {
        this.panel = vscode.window.createWebviewPanel(
          SNYK_VIEW_SUGGESTION_IAC,
          'Snyk Configuration Issue',
          {
            viewColumn: vscode.ViewColumn.Two,
            preserveFocus: true,
          },
          this.getWebviewOptions(),
        );
        this.registerListeners();
      }
      // TODO: delete this when SNYK_GENERATE_ISSUE_DESCRIPTION command is in stable CLI.
      let html: string = '';
      if (issue.additionalData.customUIContent) {
        html = issue.additionalData.customUIContent;
      } else {
        html = (await this.commandExecutor.executeCommand(SNYK_GENERATE_ISSUE_DESCRIPTION, issue.id)) ?? '';
      }
      this.panel.webview.html = this.getHtmlFromLanguageServer(html);

      this.panel.iconPath = vscode.Uri.joinPath(
        vscode.Uri.file(this.context.extensionPath),
        'media',
        'images',
        'snyk-iac.svg',
      );

      await this.panel.webview.postMessage({ type: 'set', args: issue });

      this.issue = issue;
    } catch (e) {
      ErrorHandler.handle(e, this.logger, errorMessages.suggestionViewShowFailed);
    }
  }

  private getHtmlFromLanguageServer(html: string): string {
    const nonce = getNonce();
    const ideStylePath = vscode.Uri.joinPath(
      vscode.Uri.file(this.context.extensionPath),
      'media',
      'views',
      'snykCode', // TODO: check with design
      'suggestion',
      'suggestionLS.css',
    );

    const ideStyle = readFileSync(ideStylePath.fsPath, 'utf8');
    // nonce-ideNonce is a placeholder defined in the Language Server
    // to be replaced with the local nonce in the <meta /> tag.
    html = html.replace(/nonce-ideNonce/g, `nonce-${nonce}`);
    // data-ide-style is a placeholder defined in the Language Server
    // to be replaced with the custom IDE styles.
    html = html.replace('${ideStyle}', `<style nonce="${nonce}">${ideStyle}</style>`);
    html = html.replace('${ideScript}', '');
    return html;
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
}
