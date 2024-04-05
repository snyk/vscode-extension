import * as vscode from 'vscode';
import { WebviewProvider } from '../../../snyk/common/views/webviewProvider';
import { Logger } from '../../common/logger/logger';

export class WebviewPanelSerializer<Provider extends WebviewProvider<State>, State>
  implements vscode.WebviewPanelSerializer
{
  constructor(private readonly provider: Provider) {}
  async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel): Promise<void> {
    // we want to make sure the panel is closed on startup
    webviewPanel.dispose();
    return Promise.resolve();
  }
}
