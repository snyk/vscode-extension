import * as lsc from 'vscode-languageclient/node';
import { LanguageClient, LanguageClientOptions, ServerOptions } from './types';

export interface ILanguageClientAdapter {
  create(id: string, name: string, serverOptions: ServerOptions, clientOptions: LanguageClientOptions): LanguageClient;
  getLanguageClient(): LanguageClient;
}

export class LanguageClientAdapter implements ILanguageClientAdapter {
  private client: LanguageClient;

  create(id: string, name: string, serverOptions: ServerOptions, clientOptions: LanguageClientOptions): LanguageClient {
    this.client = new lsc.LanguageClient(id, name, serverOptions, clientOptions);
    return this.client;
  }

  getLanguageClient(): LanguageClient {
    return this.client;
  }
}
