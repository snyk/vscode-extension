import * as vscode from 'vscode';
import { SNYK_VIEW_SUGGESTION_OSS_LANGUAGE_SERVER } from '../../common/constants/views';
import { ErrorHandler } from '../../common/error/errorHandler';
import { Issue, OssIssueData } from '../../common/languageServer/types';
import { ILog } from '../../common/logger/interfaces';
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
  protected getHtmlForWebview(_webview: vscode.Webview): string {
    throw new Error('Method not implemented.');
  }

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
      this.window.registerWebviewPanelSerializer(
        SNYK_VIEW_SUGGESTION_OSS_LANGUAGE_SERVER,
        new WebviewPanelSerializer(this),
      ),
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
          SNYK_VIEW_SUGGESTION_OSS_LANGUAGE_SERVER,
          'Snyk OSS Vulnerability',
          {
            viewColumn: vscode.ViewColumn.Two,
            preserveFocus: true,
          },
          this.getWebviewOptions(),
        );
        this.registerListeners();
      }

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

      const displayMode = 'dark';

      const styleUri = this.getWebViewUri('media', 'views', 'oss', 'suggestion', 'suggestion.css');
      const learnStyleUri = this.getWebViewUri('media', 'views', 'common', 'learn.css');
      const headerEndValue = `<link href="${styleUri}" rel="stylesheet"><link href="${learnStyleUri}" rel="stylesheet">`;
      const serverityIconName = `${displayMode}-${issue.severity}-severity`;

      let html = issue.additionalData.details;
      html = html.replace('${headerEnd}', headerEndValue);
      html = html.replace('${severityIcon}', images[serverityIconName]);
      html = html.replaceAll(/\$\{\w+\}/g, '');
      this.panel.webview.html = html;
      this.panel.iconPath = vscode.Uri.joinPath(
        vscode.Uri.file(this.context.extensionPath),
        'media',
        'images',
        'snyk-oss.svg',
      );

      this.issue = issue;
    } catch (e) {
      ErrorHandler.handle(e, this.logger, errorMessages.suggestionViewShowFailed);
    }
  }

  protected registerListeners(): void {
    if (!this.panel) return;

    this.panel.onDidDispose(() => this.onPanelDispose(), null, this.disposables);
    this.panel.onDidChangeViewState(() => this.checkVisibility(), undefined, this.disposables);
  }

  disposePanel(): void {
    super.disposePanel();
  }

  protected onPanelDispose(): void {
    super.onPanelDispose();
  }
}
