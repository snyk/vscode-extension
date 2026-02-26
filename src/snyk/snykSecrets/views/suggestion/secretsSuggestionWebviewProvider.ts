import * as vscode from 'vscode';
import {
  SNYK_GENERATE_ISSUE_DESCRIPTION,
  SNYK_OPEN_BROWSER_COMMAND,
  SNYK_SUBMIT_IGNORE_COMMAND,
} from '../../../common/constants/commands';
import { ErrorHandler } from '../../../common/error/errorHandler';
import { Issue, SecretsIssueData as SecretsIssueData } from '../../../common/languageServer/types';
import { ILog } from '../../../common/logger/interfaces';
import { getNonce } from '../../../common/views/nonce';
import { IWebViewProvider, WebviewProvider } from '../../../common/views/webviewProvider';
import { ExtensionContext } from '../../../common/vscode/extensionContext';
import { IVSCodeLanguages } from '../../../common/vscode/languages';
import { IVSCodeWindow } from '../../../common/vscode/window';
import { IVSCodeWorkspace } from '../../../common/vscode/workspace';
import { readFileSync } from 'fs';
import { IVSCodeCommands } from '../../../common/vscode/commands';

const SNYK_VIEW_SUGGESTION_SECRETS = 'snyk.views.suggestion.secrets';

export class SecretsSuggestionWebviewProvider
  extends WebviewProvider<Issue<SecretsIssueData>>
  implements IWebViewProvider<Issue<SecretsIssueData>>
{
  private issue: Issue<SecretsIssueData> | undefined;

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
    // No serializer needed for now
  }

  get openIssueId(): string | undefined {
    return this.issue?.id;
  }

  async showPanel(issue: Issue<SecretsIssueData>): Promise<void> {
    try {
      await this.focusSecondEditorGroup();

      if (this.panel) {
        this.panel.reveal(vscode.ViewColumn.Two, true);
      } else {
        this.panel = vscode.window.createWebviewPanel(
          SNYK_VIEW_SUGGESTION_SECRETS,
          'Snyk Secrets Issue',
          {
            viewColumn: vscode.ViewColumn.Two,
            preserveFocus: true,
          },
          this.getWebviewOptions(),
        );
        this.registerListeners();
      }

      let html: string = '';
      html = (await this.commandExecutor.executeCommand(SNYK_GENERATE_ISSUE_DESCRIPTION, issue.id)) ?? '';
      this.panel.webview.html = this.getHtmlFromLanguageServer(html);

      this.panel.iconPath = vscode.Uri.joinPath(
        vscode.Uri.file(this.context.extensionPath),
        'media',
        'images',
        'snyk-secrets.svg',
      );

      await this.panel.webview.postMessage({ type: 'set', args: issue });

      this.issue = issue;
    } catch (e) {
      ErrorHandler.handle(e, this.logger, 'Failed to show secrets suggestion view.');
    }
  }

  private getHtmlFromLanguageServer(html: string): string {
    const nonce = getNonce();
    const ideStylePath = vscode.Uri.joinPath(
      vscode.Uri.file(this.context.extensionPath),
      'media',
      'views',
      'snykCode',
      'suggestion',
      'suggestionLS.css',
    );

    const ideStyle = readFileSync(ideStylePath.fsPath, 'utf8');

    const ideFuncsPath = vscode.Uri.joinPath(
      vscode.Uri.file(this.context.extensionPath),
      'out',
      'snyk',
      'snykCode',
      'views',
      'suggestion',
      'ideFuncs',
    );
    const ideSubmitIgnoreRequestScriptPath = vscode.Uri.joinPath(ideFuncsPath, 'ideSubmitIgnoreRequest.js');
    const ideSubmitIgnoreRequestScript = readFileSync(ideSubmitIgnoreRequestScriptPath.fsPath, 'utf8');

    // Minimal IDE script that acquires the VS Code webview API (required for postMessage in ignore callbacks)
    const ideScript = `var vscode = acquireVsCodeApi();
document.getElementById('position-line')?.addEventListener('click', function() {
  vscode.postMessage({ type: 'openLocal' });
});`;

    html = html.replace(/nonce-ideNonce/g, `nonce-${nonce}`);
    html = html.replace('${ideStyle}', `<style nonce="${nonce}">${ideStyle}</style>`);
    html = html.replace('${ideScript}', ideScript);
    html = html.replace('${ideSubmitIgnoreRequest}', ideSubmitIgnoreRequestScript);
    return html;
  }

  protected registerListeners(): void {
    if (!this.panel) return;

    this.panel.onDidDispose(() => this.onPanelDispose(), null, this.disposables);
    this.panel.onDidChangeViewState(() => this.checkVisibility(), undefined, this.disposables);
    this.panel.webview.onDidReceiveMessage(msg => this.handleMessage(msg), undefined, this.disposables);
  }

  private async handleMessage(message: { type: string; args?: Record<string, unknown>; value?: unknown }) {
    try {
      switch (message.type) {
        case 'openBrowser': {
          await vscode.commands.executeCommand(SNYK_OPEN_BROWSER_COMMAND, message.value);
          break;
        }

        case 'submitIgnoreRequest': {
          this.logger.info('Sending ignore request');
          const { id, ignoreType, ignoreExpirationDate, ignoreReason } = message.args as {
            id: string;
            ignoreType: string;
            ignoreExpirationDate: string;
            ignoreReason: string;
          };
          await vscode.commands.executeCommand(
            SNYK_SUBMIT_IGNORE_COMMAND,
            'create',
            id,
            ignoreType,
            ignoreReason,
            ignoreExpirationDate,
          );
          break;
        }

        case 'openLocal': {
          if (!this.issue) break;
          const filePath = this.issue.filePath;
          const range = this.issue.range;
          const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
          const selection = new vscode.Range(
            new vscode.Position(range.start.line, range.start.character),
            new vscode.Position(range.end.line, range.end.character),
          );
          await vscode.window.showTextDocument(doc, { selection, viewColumn: vscode.ViewColumn.One });
          break;
        }

        default: {
          break;
        }
      }
    } catch (e) {
      ErrorHandler.handle(e, this.logger, 'Failed to handle secrets suggestion message.');
    }
  }
}
