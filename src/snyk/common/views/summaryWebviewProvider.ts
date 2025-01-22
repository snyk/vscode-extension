import * as vscode from 'vscode';
import { getNonce } from './nonce';
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
  }

  public updateWebviewContent(html: string) {
    if (this.webviewView) {
      const nonce = getNonce()
      html = html.replace('${ideScript}', `<script nonce=${nonce}>` + "" + '</script>');
      html = html.replace('${ideStyle}', `<style nonce=${nonce}>` + "" + '</style>');

      // Load the modified HTML into Cheerio

      this.webviewView.webview.html = html;
    }
  }

}
