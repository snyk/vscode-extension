import type * as vscode from 'vscode';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getNonce } from './nonce';
import { ILog } from '../logger/interfaces';
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
  'snyk.trustWorkspaceFolders',
]);

export class TreeViewWebviewProvider implements vscode.WebviewViewProvider {
  private static instance: TreeViewWebviewProvider;
  private webviewView: vscode.WebviewView | undefined;
  private context: vscode.ExtensionContext;
  private commands: IVSCodeCommands;
  private logger: ILog;
  private fileReader: (path: string) => string;
  private lastHtml: string | undefined;

  private constructor(
    context: vscode.ExtensionContext,
    commands: IVSCodeCommands,
    logger: ILog,
    fileReader: (path: string) => string,
  ) {
    this.context = context;
    this.commands = commands;
    this.logger = logger;
    this.fileReader = fileReader;
  }

  public static getInstance(
    extensionContext?: vscode.ExtensionContext,
    commands?: IVSCodeCommands,
    logger?: ILog,
    fileReader: (path: string) => string = path => readFileSync(path, 'utf8'),
  ): TreeViewWebviewProvider | undefined {
    if (!TreeViewWebviewProvider.instance) {
      if (!extensionContext || !commands || !logger) {
        return undefined;
      }
      TreeViewWebviewProvider.instance = new TreeViewWebviewProvider(extensionContext, commands, logger, fileReader);
    }
    return TreeViewWebviewProvider.instance;
  }

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this.webviewView = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
    };
    this.webviewView.webview.onDidReceiveMessage((msg: TreeViewCommandMessage) => this.handleMessage(msg));
    if (this.lastHtml) {
      this.applyHtml(this.lastHtml);
    } else {
      this.showInitializingContent();
    }
  }

  private showInitializingContent() {
    if (!this.webviewView) return;
    const nonce = getNonce();
    const initHtmlPath = join(this.context.extensionPath, 'media', 'views', 'treeView', 'TreeViewInit.html');
    let html = this.fileReader(initHtmlPath);
    html = html.replace(/\${nonce}/g, nonce);
    this.webviewView.webview.html = html;
  }

  private async handleMessage(message: TreeViewCommandMessage) {
    if (message.type !== 'executeCommand') return;

    const { requestId, command, args } = message;

    if (!ALLOWED_COMMANDS.has(command)) {
      this.logger.warn(`Tree view command not in allowlist: ${command}`);
      this.postResult(requestId, null, `Command not allowed: ${command}`);
      return;
    }

    try {
      const result = await this.commands.executeCommand(command, ...args);
      this.postResult(requestId, result ?? null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Tree view command execution failed: ${errorMessage}`);
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
    if (this.lastHtml === html) return;
    this.lastHtml = html;
    if (this.webviewView) {
      this.applyHtml(html);
    }
  }

  private applyHtml(html: string) {
    if (!this.webviewView) return;
    try {
      const nonce = getNonce();
      const ideScriptPath = join(
        this.context.extensionPath,
        'out',
        'snyk',
        'common',
        'views',
        'treeViewWebviewScript.js',
      );
      const ideScript = this.fileReader(ideScriptPath);

      html = html.replace('${ideStyle}', `<style nonce="${nonce}"></style>`);
      html = html.replace('${ideScript}', `<script nonce="${nonce}">${ideScript}</script>`);
      html = html.replace(/\${nonce}/g, nonce);

      this.webviewView.webview.html = html;
    } catch (error) {
      this.logger.error('Failed to render TreeView webview content');
      this.showInitializingContent();
    }
  }
}
