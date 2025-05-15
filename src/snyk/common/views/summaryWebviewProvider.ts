import * as vscode from 'vscode';
import { readFileSync } from 'fs';
import { getNonce } from './nonce';
import { SummaryMessage } from '../languageServer/types';
import { SNYK_TOGGLE_DELTA } from '../constants/commands';
import { Logger } from '../logger/logger';
export class SummaryWebviewViewProvider implements vscode.WebviewViewProvider {
  private static instance: SummaryWebviewViewProvider;
  private webviewView: vscode.WebviewView | undefined;
  private context: vscode.ExtensionContext;

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  public static getInstance(extensionContext?: vscode.ExtensionContext): SummaryWebviewViewProvider | undefined {
    if (!SummaryWebviewViewProvider.instance) {
      if (!extensionContext) {
        console.log('ExtensionContext is required for the first initialization of SnykDiagnosticsWebviewViewProvider');
        return undefined;
      } else {
        SummaryWebviewViewProvider.instance = new SummaryWebviewViewProvider(extensionContext);
      }
    }
    return SummaryWebviewViewProvider.instance;
  }

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this.webviewView = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
    };
    // TODO - show static summary screen when the language server is initialising
    // (media/views/scanSummary/ScanSummaryInit.html)
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
      Logger.error(error);
    }
  }

  public updateWebviewContent(html: string) {
    if (this.webviewView) {
      const nonce = getNonce();
      const ideScriptPath = vscode.Uri.joinPath(
        vscode.Uri.file(this.context.extensionPath),
        'out',
        'snyk',
        'common',
        'views',
        'summaryWebviewScript.js',
      );
      const ideScript = readFileSync(ideScriptPath.fsPath, 'utf8');

      html = html.replace('${ideStyle}', `<style nonce=${nonce}>` + '' + '</style>');
      html = html.replace('${ideFunc}', ideScript);
      // Must not have blank template replacements, as they could be used to skip the "${nonce}" injection check
      // and still end up with the nonce injected, e.g. "${nonce${resolvesToEmpty}}" becomes "${nonce}" - See IDE-1050.
      html = html.replace('${ideScript}', ' ');
      html = html.replace(/\${nonce}/g, nonce);

      this.webviewView.webview.html = html;
    }
  }
}
