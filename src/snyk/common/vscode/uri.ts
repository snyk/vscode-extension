import * as vscode from 'vscode';
import { Uri } from './types';

export interface IUriAdapter {
  file(path: string): Uri;
  parse(path: string): Uri;
}

export class UriAdapter implements IUriAdapter {
  file(path: string): Uri {
    return vscode.Uri.file(path);
  }

  parse(path: string): Uri {
    return vscode.Uri.parse(path);
  }
}
