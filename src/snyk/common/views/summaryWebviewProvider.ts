import * as vscode from 'vscode';

export abstract class SummaryWebviewViewProvider implements vscode.WebviewViewProvider {
  private static instance: SummaryWebviewViewProvider;
  private webviewView: vscode.WebviewView | undefined;
  private context: vscode.ExtensionContext;

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  public static getInstance(context?: vscode.ExtensionContext): SummaryWebviewViewProvider | undefined {
    if (!SummaryWebviewViewProvider.instance) {
      if (!context) {
        console.log('ExtensionContext is required for the first initialization of SnykDiagnosticsWebviewViewProvider');
        return undefined;
      } else {
        SummaryWebviewViewProvider.instance = new SummaryWebviewViewProvider(context);
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
      //const jsContent = await this.getLocalScripts();
      html = html
        .replace(/data-ide-style><\/style>/, `data-ide-style></style>`) // Inject local CSS when needed like ${jsContent} below
        .replace(/class="ide-script"><\/script>/, `class="ide-script">${jsContent}</script>`);

      // Load the modified HTML into Cheerio

      this.webviewView.webview.html = html;
    }
  }

}
