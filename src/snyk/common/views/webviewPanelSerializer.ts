import * as vscode from 'vscode';
import { WebviewProvider } from './webviewProvider';

export class WebviewPanelSerializer<Provider extends WebviewProvider<State>, State> implements vscode.WebviewPanelSerializer {
  constructor(private readonly provider: Provider) {}
  async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: State): Promise<void> {
    if (!state) {
      webviewPanel.dispose();
      return Promise.resolve();
    }

    this.provider.restorePanel(webviewPanel);
    return this.provider.showPanel(state);
  }
}
