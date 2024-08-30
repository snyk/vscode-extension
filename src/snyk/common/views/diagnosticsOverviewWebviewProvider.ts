import * as fs from 'fs/promises';
import * as vscode from 'vscode';
import * as cheerio from 'cheerio';
import path from 'path';

const JsScriptPath = 'out/snyk/common/views/diagnosticsOverviewWebviewScript.js';

export type DiagnosticsOverview = {
  product: 'oss' | 'code' | 'iac';
  html: string;
  folderPath: string;
  folderHash: string;
};

export class SnykDiagnosticsWebviewViewProvider implements vscode.WebviewViewProvider {
  private static instance: SnykDiagnosticsWebviewViewProvider;
  private webviewView: vscode.WebviewView | undefined;
  private context: vscode.ExtensionContext;

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  public static getInstance(context?: vscode.ExtensionContext): SnykDiagnosticsWebviewViewProvider | undefined {
    if (!SnykDiagnosticsWebviewViewProvider.instance) {
      if (!context) {
        console.log('ExtensionContext is required for the first initialization of SnykDiagnosticsWebviewViewProvider');
        return undefined;
      } else {
        SnykDiagnosticsWebviewViewProvider.instance = new SnykDiagnosticsWebviewViewProvider(context);
      }
    }
    return SnykDiagnosticsWebviewViewProvider.instance;
  }

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this.webviewView = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
    };
  }

  public async updateWebviewContent(html: string): Promise<void> {
    if (this.webviewView) {
      const jsContent = await this.getLocalScripts();
      html = html
        .replace(/data-ide-style><\/style>/, `data-ide-style></style>`) // Inject local CSS when needed like ${jsContent} below
        .replace(/class="ide-script"><\/script>/, `class="ide-script">${jsContent}</script>`);

      // Load the modified HTML into Cheerio
      const $ = cheerio.load(html);
      const folderName = $('p.folder-name').text();
      console.log(`Folder Name: ${folderName}`);

      this.webviewView.webview.html = html;
    }
  }

  private async getLocalScripts(): Promise<string> {
    const scriptPath = path.join(this.context.extensionPath, JsScriptPath);
    try {
      const scriptContent = await fs.readFile(scriptPath, 'utf8');
      return scriptContent;
    } catch (err) {
      console.error('Failed to read local script:', err);
      return '';
    }
  }
}
