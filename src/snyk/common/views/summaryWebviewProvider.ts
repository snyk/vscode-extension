import * as vscode from 'vscode';
import { readFileSync } from 'fs';
import { getNonce } from './nonce';
import { SummaryMessage } from '../languageServer/types';
import { SNYK_TOGGLE_DELTA } from '../constants/commands';
import { ILog } from '../logger/interfaces';

export class SummaryWebviewViewProvider implements vscode.WebviewViewProvider {
  private webviewView: vscode.WebviewView | undefined;
  private ideScript: string | undefined;

  constructor(private readonly logger: ILog, private readonly extensionPath: string) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this.webviewView = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
    };
    // Register handling of webview messages, e.g. when the user clicks the Delta scan toggle.
    this.webviewView.webview.onDidReceiveMessage((msg: SummaryMessage) => this.handleMessage(msg));
  }

  private async handleMessage(message: SummaryMessage) {
    try {
      switch (message.type) {
        case 'sendSummaryParams': {
          const { summary } = message.args;
          await vscode.commands.executeCommand(SNYK_TOGGLE_DELTA, summary.toggleDelta);
          break;
        }
      }
    } catch (error) {
      this.logger.error(error);
    }
  }

  /** Singleton method so we only read the script once */
  private getIDEScript(): string {
    if (!this.ideScript) {
      const ideScriptPath = vscode.Uri.joinPath(
        vscode.Uri.file(this.extensionPath),
        'out',
        'snyk',
        'common',
        'views',
        'summaryWebviewScript.js',
      );
      this.ideScript = readFileSync(ideScriptPath.fsPath, 'utf8');
    }
    return this.ideScript;
  }

  public updateWebviewContent(html: string) {
    if (!this.webviewView) {
      return;
    }
    const nonce = getNonce();
    const ideScript = this.getIDEScript();

    html = html.replace('${ideStyle}', `<style nonce=${nonce}>` + '' + '</style>');
    html = html.replace('${ideFunc}', ideScript);
    html = html.replace('${ideScript}', '');
    html = html.replace(/\${nonce}/g, nonce);

    this.webviewView.webview.html = html;
  }
}
