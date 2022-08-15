import * as lsc from 'vscode-languageclient/node';
import { LanguageClient, LanguageClientOptions, ServerOptions } from './types';

export interface ILanguageClientAdapter {
  create(id: string, name: string, serverOptions: ServerOptions, clientOptions: LanguageClientOptions): LanguageClient;
}

export class LanguageClientAdapter implements ILanguageClientAdapter {
  create(id: string, name: string, serverOptions: ServerOptions, clientOptions: LanguageClientOptions): LanguageClient {
    return new lsc.LanguageClient(id, name, serverOptions, clientOptions);
  }
}
