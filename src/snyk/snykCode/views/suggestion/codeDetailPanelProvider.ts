import * as vscode from 'vscode';

import { Issue, CodeIssueData } from '../../../common/languageServer/types';
import { WebviewProvider, IWebViewProvider } from '../../../common/views/webviewProvider';
import { ErrorHandler } from '../../../common/error/errorHandler';
import { SNYK_VIEW_SUGGESTION_CODE } from '../../../common/constants/views';
import { IVSCodeWindow } from '../../../common/vscode/window';
import { ExtensionContext } from '../../../common/vscode/extensionContext';
import { ILog } from '../../../common/logger/interfaces';
import { WebviewPanelSerializer } from '../webviewPanelSerializer';

export class CodeDetailPanelProvider
  extends WebviewProvider<Issue<CodeIssueData>>
  implements IWebViewProvider<Issue<CodeIssueData>>
{
  private issue: Issue<CodeIssueData> | undefined;

  constructor(
    private readonly window: IVSCodeWindow,
    protected readonly context: ExtensionContext,
    protected readonly logger: ILog,
  ) {
    super(context, logger);
  }

  protected getHtmlForWebview(_webview: vscode.Webview): string {
    throw new Error('Method not implemented.');
  }

  activate(): void {
    this.context.addDisposables(
      this.window.registerWebviewPanelSerializer(SNYK_VIEW_SUGGESTION_CODE, new WebviewPanelSerializer(this)),
    );
  }

  get openIssueId(): string | undefined {
    return this.issue?.id;
  }

  async showPanel(issue: Issue<CodeIssueData>): Promise<void> {
    try {
      await this.focusSecondEditorGroup();
      if (this.panel) {
        this.panel.reveal(vscode.ViewColumn.Two, true);
        // We will render HTML here. Let's start with a simple one.
        this.panel.webview.html = issue.additionalData.details;
      } else {
        this.panel = vscode.window.createWebviewPanel(
          SNYK_VIEW_SUGGESTION_CODE,
          'Snyk Code Issue',
          {
            viewColumn: vscode.ViewColumn.Two,
            preserveFocus: true,
          },
          this.getWebviewOptions(),
        );
        this.registerListeners();
      }
      this.issue = issue;
    } catch (error) {
      ErrorHandler.handle(error, this.logger, 'messages.errors.suggestionViewShowFailed');
    }
  }

  protected registerListeners(): void {
    if (!this.panel) return;

    this.panel.onDidDispose(() => this.onPanelDispose(), null, this.disposables);
    this.panel.onDidChangeViewState(() => this.checkVisibility(), undefined, this.disposables);
    // Handle messages from the webview
    // this.panel.webview.onDidReceiveMessage(
    //   (msg: SuggestionMessage) => this.handleMessage(msg),
    //   undefined,
    //   this.disposables,
    // );
  }
}
