import * as vscode from 'vscode';
import { SNYK_VIEW_SUGGESTION_OSS } from '../../../common/constants/views';
import { ExtensionContext } from '../../../common/vscode/extensionContext';
import { IVSCodeWindow } from '../../../common/vscode/window';
import { getNonce } from '../../../common/views/nonce';
import { SNYK_OPEN_BROWSER_COMMAND } from '../../../common/constants/commands';
import { OssIssueCommandArg } from '../vulnerabilityProvider';

enum SuggestionViewEventMessageType {
  OpenBrowser = 'openBrowser',
}

type FeaturesViewEventMessage = {
  type: SuggestionViewEventMessageType;
  value: unknown;
};

// todo: unify interface between oss and snyk code
export interface ISuggestionViewProvider {
  activate(): void;
  showPanel(vulnerability: OssIssueCommandArg): Promise<void>;
}

export class SuggestionViewProvider implements ISuggestionViewProvider {
  private panel?: vscode.WebviewPanel;

  constructor(private readonly context: ExtensionContext, private readonly window: IVSCodeWindow) {}

  activate(): void {
    this.context.addDisposables(
      this.window.registerWebviewPanelSerializer(SNYK_VIEW_SUGGESTION_OSS, new SuggestionSerializer(this)),
    );
  }

  // todo: perhaps create a base class for both Code and OSS providers?
  async showPanel(vulnerability: OssIssueCommandArg): Promise<void> {
    if (
      !vscode.window.activeTextEditor?.viewColumn ||
      !this.panel?.viewColumn ||
      this.panel.viewColumn !== vscode.ViewColumn.Two
    ) {
      // workaround for: https://github.com/microsoft/vscode/issues/71608
      // when resolved, we can set showPanel back to sync execution.
      await vscode.commands.executeCommand('workbench.action.focusSecondEditorGroup');
    }

    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Two, true);
    } else {
      this.panel = vscode.window.createWebviewPanel(
        SNYK_VIEW_SUGGESTION_OSS,
        'Snyk OSS Vulnerability',
        {
          viewColumn: vscode.ViewColumn.Two,
          preserveFocus: true,
        },
        {
          enableScripts: true,
          localResourceRoots: [this.context.getExtensionUri()],
        },
      );
    }

    this.panel.webview.html = this.getHtmlForWebview(this.panel.webview);

    void this.panel.webview.postMessage({ type: 'set', args: vulnerability });

    this.panel.onDidDispose(this.onPanelDispose.bind(this));
    this.panel.webview.onDidReceiveMessage((data: FeaturesViewEventMessage) => {
      switch (data.type) {
        case SuggestionViewEventMessageType.OpenBrowser:
          void vscode.commands.executeCommand(SNYK_OPEN_BROWSER_COMMAND, data.value);
          break;
        default:
          break;
      }
    });
    this.panel.onDidChangeViewState(this.checkVisibility.bind(this));
  }

  restorePanel(panel: vscode.WebviewPanel): void {
    if (this.panel) this.panel.dispose();
    this.panel = panel;
  }

  private disposePanel() {
    if (this.panel) this.panel.dispose();
  }

  private onPanelDispose() {
    this.panel = undefined;
  }

  private checkVisibility(_e: vscode.WebviewPanelOnDidChangeViewStateEvent): void {
    if (this.panel && this.panel.visible) {
      void this.panel.webview.postMessage({ type: 'get' });
    }
  }

  private getWebViewUri(...pathSegments: string[]) {
    return this.panel?.webview.asWebviewUri(vscode.Uri.joinPath(this.context.getExtensionUri(), ...pathSegments));
  }

  private getHtmlForWebview(webview: vscode.Webview) {
    const images: Record<string, string> = [
      ['icon-code', 'svg'],
      ['dark-critical-severity', 'svg'],
      ['dark-high-severity', 'svg'],
      ['dark-medium-severity', 'svg'],
      ['dark-low-severity', 'svg'],
    ].reduce((accumulator: Record<string, string>, [name, ext]) => {
      const uri = this.getWebViewUri('images', `${name}.${ext}`); // todo move to media folder
      if (!uri) throw new Error('Image missing.');
      accumulator[name] = uri.toString();
      return accumulator;
    }, {});

    const scriptUri = this.getWebViewUri('out', 'snyk', 'snykOss', 'views', 'suggestion', 'suggestionViewScript.js');
    const styleUri = this.getWebViewUri('media', 'views', 'oss', 'suggestion', 'suggestion.css');

    const nonce = getNonce();

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">

				<!--
					Use a content security policy to only allow loading images from https or from our extension directory,
					and only allow scripts that have a specific nonce.
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link href="${styleUri}" rel="stylesheet">
			</head>
			<body>
        <div class="suggestion">
          <section id="suggestion-info">
            <div id="severity">
              <img id="lowl" class="icon light-only hidden" src="${images['dark-low-severity']}" />
              <img id="lowd" class="icon dark-only hidden" src="${images['dark-low-severity']}" />
              <img id="mediuml" class="icon light-only hidden" src="${images['dark-medium-severity']}" />
              <img id="mediumd" class="icon dark-only hidden" src="${images['dark-medium-severity']}" />
              <img id="highl" class="icon light-only hidden" src="${images['dark-high-severity']}" />
              <img id="highd" class="icon dark-only hidden" src="${images['dark-high-severity']}" />
              <img id="criticall" class="icon light-only hidden" src="${images['dark-critical-severity']}" />
              <img id="criticald" class="icon dark-only hidden" src="${images['dark-critical-severity']}" />
              <span id="severity-text"></span>
            </div>
            <div id="title" class="suggestion-text"></div>
            <div id="identifiers"></div>
          </section>
          <section class="delimiter-top summary">
            <div class="summary-item module">
              <div class="label font-light">Vulnerable module</div>
              <div class="content"></div>
            </div>
            <div class="summary-item introduced-through">
              <div class="label font-light">Introduced through</div>
              <div class="content"></div>
            </div>
            <div class="summary-item fixed-in">
              <div class="label font-light">Fixed in</div>
              <div class="content"></div>
            </div>
            <div class="summary-item maturity">
              <div class="label font-light">Exploit maturity</div>
              <div class="content"></div>
            </div>
          </section>
          <section class="delimiter-top">
            <h2>Detailed paths</h2>
            <div id="detailed-paths"></div>
          </section>
          <section class="delimiter-top">
            <h2>Overview</h2>
            <div id="overview" class="font-light"></div>
          </section>
        </div>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
  }
}

class SuggestionSerializer implements vscode.WebviewPanelSerializer {
  constructor(private readonly suggestionProvider: SuggestionViewProvider) {}

  async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: OssIssueCommandArg): Promise<void> {
    if (!state) {
      webviewPanel.dispose();
      return Promise.resolve();
    }

    this.suggestionProvider.restorePanel(webviewPanel);
    return this.suggestionProvider.showPanel(state);
  }
}
