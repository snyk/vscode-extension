import * as vscode from 'vscode';
import { readFileSync } from 'fs';
import { getNonce } from './nonce';
import { Logger } from '../logger/logger';
import { IVSCodeCommands } from '../vscode/commands';

type TreeViewCommandMessage = {
  type: 'executeCommand';
  requestId: string;
  command: string;
  args: unknown[];
};

const ALLOWED_COMMANDS = new Set([
  'snyk.navigateToRange',
  'snyk.toggleTreeFilter',
  'snyk.getTreeViewIssueChunk',
  'snyk.setNodeExpanded',
  'snyk.showScanErrorDetails',
  'snyk.updateFolderConfig',
]);

export class TreeViewWebviewProvider implements vscode.WebviewViewProvider {
  private static instance: TreeViewWebviewProvider;
  private webviewView: vscode.WebviewView | undefined;
  private context: vscode.ExtensionContext;
  private commands: IVSCodeCommands;
  private lastHtml: string | undefined;

  private constructor(context: vscode.ExtensionContext, commands: IVSCodeCommands) {
    this.context = context;
    this.commands = commands;
  }

  public static getInstance(
    extensionContext?: vscode.ExtensionContext,
    commands?: IVSCodeCommands,
  ): TreeViewWebviewProvider | undefined {
    if (!TreeViewWebviewProvider.instance) {
      if (!extensionContext || !commands) {
        Logger.error('ExtensionContext and commands are required for TreeViewWebviewProvider initialization');
        return undefined;
      }
      TreeViewWebviewProvider.instance = new TreeViewWebviewProvider(extensionContext, commands);
    }
    return TreeViewWebviewProvider.instance;
  }

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this.webviewView = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
    };
    this.webviewView.webview.onDidReceiveMessage((msg: TreeViewCommandMessage) => this.handleMessage(msg));
    this.showInitializingContent();
  }

  private showInitializingContent() {
    if (!this.webviewView) return;
    const nonce = getNonce();
    const initHtmlPath = vscode.Uri.joinPath(
      vscode.Uri.file(this.context.extensionPath),
      'media',
      'views',
      'treeView',
      'TreeViewInit.html',
    );
    let html = readFileSync(initHtmlPath.fsPath, 'utf8');
    html = html.replace(/\${nonce}/g, nonce);
    this.webviewView.webview.html = html;
  }

  private async handleMessage(message: TreeViewCommandMessage) {
    if (message.type !== 'executeCommand') return;

    const { requestId, command, args } = message;

    if (!ALLOWED_COMMANDS.has(command)) {
      Logger.warn(`Tree view command not in allowlist: ${command}`);
      this.postResult(requestId, null, `Command not allowed: ${command}`);
      return;
    }

    try {
      const result = await this.commands.executeCommand(command, ...args);
      this.postResult(requestId, result ?? null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error(`Tree view command execution failed: ${errorMessage}`);
      this.postResult(requestId, null, errorMessage);
    }
  }

  private postResult(requestId: string, result: unknown, error?: string) {
    if (!this.webviewView) return;
    void this.webviewView.webview.postMessage({
      type: 'commandResult',
      requestId,
      result,
      error,
    });
  }

  public updateWebviewContent(html: string) {
    if (!this.webviewView) return;
    if (this.lastHtml === html) return;
    this.lastHtml = html;

    const nonce = getNonce();
    const ideScriptPath = vscode.Uri.joinPath(
      vscode.Uri.file(this.context.extensionPath),
      'out',
      'snyk',
      'common',
      'views',
      'treeViewWebviewScript.js',
    );
    const ideScript = readFileSync(ideScriptPath.fsPath, 'utf8');

    html = html.replace('${ideStyle}', `<style nonce="${nonce}"></style>`);
    html = html.replace('${ideScript}', `<script nonce="${nonce}">${ideScript}</script>`);
    html = html.replace(/\${nonce}/g, nonce);

    this.webviewView.webview.html = html;
  }
}
