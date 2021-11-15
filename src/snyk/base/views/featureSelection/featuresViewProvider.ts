/* eslint-disable @typescript-eslint/no-unused-vars */
import * as vscode from 'vscode';
import { FeaturesConfiguration } from '../../../common/configuration/configuration';
import { configuration } from '../../../common/configuration/instance';
import { SNYK_CONTEXT } from '../../../common/constants/views';
import { IContextService } from '../../../common/services/contextService';
import { getNonce } from '../../../common/views/nonce';

enum FeaturesViewEventMessageType {
  FeaturesSelected = 'featuresSelected',
}

type FeaturesViewEventMessage = {
  type: FeaturesViewEventMessageType;
  value: unknown;
};

export class FeaturesViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri, private readonly contextService: IContextService) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (data: FeaturesViewEventMessage) => {
      switch (data.type) {
        case FeaturesViewEventMessageType.FeaturesSelected: {
          await configuration.setFeaturesConfiguration(data.value as FeaturesConfiguration);
          await this.contextService.setContext(SNYK_CONTEXT.FEATURES_SELECTED, true);
          break;
        }
      }
    });
  }

  getWebView(): vscode.WebviewView | undefined {
    return this.view;
  }

  private getHtmlForWebview(webview: vscode.Webview) {
    const scriptUri = this.getWebViewUri('out', 'snyk', 'base', 'views', 'featureSelection', 'featuresViewScript.js');
    const styleVSCodeUri = this.getWebViewUri('media', 'views', 'common', 'vscode.css');
    const styleUri = this.getWebViewUri('media', 'views', 'featureSelection', 'featureSelection.css');
    const avatarUri = this.getWebViewUri('media', 'images', 'avatar-transparent.svg');

    // Use a nonce to only allow a specific script to be run.
    const nonce = getNonce();

    return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<!--
					Use a content security policy to only allow loading images from https or from our extension directory,
					and only allow scripts that have a specific nonce.
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link href="${styleVSCodeUri}" rel="stylesheet">
				<link href="${styleUri}" rel="stylesheet">
			</head>
			<body>
        <div class="welcome">
          <img src="${avatarUri}" class="avatar" />
          <p>Let's start analyzing your code</p>
        </div>

        <div class="checkbox">
          <input type="checkbox" id="codeSecurityEnabled" name="codeSecurityEnabled" checked>
          <label for="codeSecurityEnabled">Snyk Code Security</label>
        </div>
        <div class="checkbox">
          <input type="checkbox" id="codeQualityEnabled" name="codeQualityEnabled">
          <label for="codeQualityEnabled">Snyk Code Quality</label>
        </div>

				<button class="analyze-button">Analyze now!</button>

				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
  }

  private getWebViewUri(...pathSegments: string[]) {
    return this.view?.webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, ...pathSegments));
  }
}
