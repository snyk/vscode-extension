import * as vlt from 'vscode-languageserver-textdocument';
import { LSPTextDocument } from './types';

export interface ITextDocumentAdapter {
  create(uri: string, language: string, version: number, content: string): LSPTextDocument;
}

export class TextDocumentAdapter implements ITextDocumentAdapter {
  create(uri: string, language: string, version: number, content: string): LSPTextDocument {
    return vlt.TextDocument.create(uri, language, version, content);
  }
}
