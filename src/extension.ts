/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import * as vscode from 'vscode';
import { commands, workspace } from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node';
import SnykExtension from './snyk/extension';

let client: LanguageClient;

const extension = new SnykExtension();

export function activate(context: vscode.ExtensionContext): void {
  console.log('Activating SnykExtension');
  void extension.activate(context);

  const serverModule = '/Users/michel/Git/go/src/github.com/snyk/snyk-ls/build/snyk-ls';

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    command: serverModule,
    args: ['-l', 'debug'],
  };

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    // Register the server for plain text documents
    documentSelector: [{ scheme: 'file', language: '' }],
    synchronize: {
      // Notify the server about file changes to '.clientrc files contained in the workspace
      fileEvents: workspace.createFileSystemWatcher('**/*'),
    },
    // outputChannel: vscode.window.createOutputChannel('Language Server Client Example'),
  };

  // Create the language client and start the client.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  client = new LanguageClient('snykLsp', 'LanguageServerExample', serverOptions, clientOptions);

  // Start the client. This will also launch the server
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  client.start();
  commands.registerCommand('snyk.launchBrowser', (uri: string) => {
    void vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(uri));
  });
  commands.registerCommand('snyk.showRule', (uri: string) => {
    void vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(uri));
  });
}

export function deactivate(): void {
  console.log('Deactivating SnykExtension');
  void extension.deactivate();
  if (!client) {
    return undefined;
  }
  void client.stop();
}

export function getExtension(): SnykExtension {
  return extension;
}
