import open from 'open';
import { Logger } from '../logger/logger';
import * as vscode from 'vscode';

export interface IOpenerService {
  openBrowserUrl(url: string): Promise<void>;
  copyOpenedUrl(): Promise<void>;
}

export class OpenerService {
  private lastOpenedUrl?: string;

  async openBrowserUrl(url: string): Promise<void> {
    this.lastOpenedUrl = url;

    try {
      await open(url);
    } catch (err) {
      Logger.error(err);
    }
  }

  async copyOpenedUrl(): Promise<void> {
    if (this.lastOpenedUrl) {
      return vscode.env.clipboard.writeText(this.lastOpenedUrl);
    } else {
      Logger.info(`Last opened url couldn't be resolved.`);
    }
  }
}
