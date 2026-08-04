import * as vscode from 'vscode';
import { getNonce } from './nonce';
import { getWelcomeMarkdown, renderWelcomeHtml } from './welcomeContent';
import { IContextService } from '../services/contextService';

export class WelcomeWebviewViewProvider implements vscode.WebviewViewProvider {
  private webviewView: vscode.WebviewView | undefined;
  private lastRenderedMarkdown: string | undefined;

  constructor(private readonly contextService: IContextService) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.webviewView = webviewView;
    webviewView.webview.options = {
      enableScripts: false,
      enableCommandUris: true,
    };
    this.refresh();
  }

  refresh(): void {
    if (!this.webviewView) {
      return;
    }

    const markdown = getWelcomeMarkdown(this.contextService.viewContext);
    if (markdown === this.lastRenderedMarkdown) {
      return;
    }
    this.lastRenderedMarkdown = markdown;

    const nonce = getNonce();
    const body = renderWelcomeHtml(markdown);
    this.webviewView.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}';">
  <style nonce="${nonce}">
    body {
      box-sizing: border-box;
      color: var(--vscode-foreground);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      font-weight: var(--vscode-font-weight);
      line-height: 1.4;
      margin: 0;
      padding: 0 20px 20px;
    }
    p { margin: 0 0 0.7em; }
    a { color: var(--vscode-textLink-foreground); }
    a:hover { color: var(--vscode-textLink-activeForeground); }
    .welcome-button { margin-top: 1em; }
    .welcome-button-link {
      background: var(--vscode-button-background);
      border-radius: 2px;
      color: var(--vscode-button-foreground);
      display: inline-block;
      padding: 6px 14px;
      text-decoration: none;
    }
    .welcome-button-link:hover {
      background: var(--vscode-button-hoverBackground);
      color: var(--vscode-button-foreground);
    }
  </style>
</head>
<body>${body}</body>
</html>`;
  }
}
