import _ from 'lodash';
import * as vscode from 'vscode';
import { ScanModeService } from '../../base/services/scanModeService';
import { ISnykCodeService } from '../../snykCode/codeService';
import { severityAsText } from '../../snykCode/utils/analysisUtils';
import { createDCIgnore } from '../../snykCode/utils/ignoreFileUtils';
import { CodeIssueCommandArg } from '../../snykCode/views/interfaces';
import { capitalizeOssSeverity } from '../../snykOss/ossResult';
import { OssService } from '../../snykOss/services/ossService';
import { OssIssueCommandArg } from '../../snykOss/views/ossVulnerabilityTreeProvider';
import { analytics } from '../analytics/analytics';
import {
  SNYK_COPY_AUTH_LINK_COMMAND,
  SNYK_OPEN_BROWSER_COMMAND,
  SNYK_OPEN_LOCAL_COMMAND,
  VSCODE_GO_TO_SETTINGS_COMMAND,
} from '../constants/commands';
import { COMMAND_DEBOUNCE_INTERVAL, IDE_NAME, SNYK_NAME_EXTENSION, SNYK_PUBLISHER } from '../constants/general';
import { IOpenerService } from '../services/openerService';
import { OpenCommandIssueType, OpenIssueCommandArg } from './types';

export class CommandController {
  private debouncedCommands: Record<string, _.DebouncedFunc<(...args: unknown[]) => Promise<unknown>>> = {};

  constructor(
    private openerService: IOpenerService,
    private snykCode: ISnykCodeService,
    private ossService: OssService,
    private scanModeService: ScanModeService,
  ) {}

  openBrowser(url: string): unknown {
    return this.executeCommand(SNYK_OPEN_BROWSER_COMMAND, this.openerService.openBrowserUrl.bind(this), url);
  }

  copyAuthLink(): unknown {
    return this.executeCommand(SNYK_COPY_AUTH_LINK_COMMAND, this.openerService.copyOpenedUrl.bind(this.openerService));
  }

  openLocal(path: vscode.Uri, range?: vscode.Range): void {
    // todo: add error reporting
    void vscode.window.showTextDocument(path, { viewColumn: vscode.ViewColumn.One, selection: range });
  }

  openSettings(): void {
    void vscode.commands.executeCommand(VSCODE_GO_TO_SETTINGS_COMMAND, `@ext:${SNYK_PUBLISHER}.${SNYK_NAME_EXTENSION}`);
  }

  async createDCIgnore(custom = false, path?: string): Promise<void> {
    if (!path) {
      const paths = (vscode.workspace.workspaceFolders || []).map(f => f.uri.fsPath);
      const promises = [];
      for (const p of paths) {
        promises.push(createDCIgnore(p, custom));
      }
      await Promise.all(promises);
    } else {
      await createDCIgnore(path, custom);
    }
  }

  async openIssueCommand(arg: OpenIssueCommandArg): Promise<void> {
    if (arg.issueType == OpenCommandIssueType.CodeIssue) {
      const issue = arg.issue as CodeIssueCommandArg;
      const suggestion = this.snykCode.analyzer.findSuggestion(issue.message);
      if (!suggestion) return;
      // Set openUri = null to avoid opening the file (e.g. in the ActionProvider)
      if (issue.openUri !== null)
        await vscode.commands.executeCommand(
          SNYK_OPEN_LOCAL_COMMAND,
          issue.openUri || issue.uri,
          issue.openRange || issue.range,
        );
      this.snykCode.suggestionProvider.show(suggestion.id, issue.uri, issue.range);
      suggestion.id = decodeURIComponent(suggestion.id);

      analytics.logIssueIsViewed({
        ide: IDE_NAME,
        issueId: suggestion.id,
        issueType: suggestion.isSecurityType ? 'Code Security Vulnerability' : 'Code Quality Issue',
        severity: severityAsText(suggestion.severity),
      });
    } else if (arg.issueType == OpenCommandIssueType.OssVulnerability) {
      const issue = arg.issue as OssIssueCommandArg;
      void this.ossService.showSuggestionProvider(issue);

      analytics.logIssueIsViewed({
        ide: IDE_NAME,
        issueId: issue.id,
        issueType: 'Open Source Vulnerability',
        severity: capitalizeOssSeverity(issue.severity),
      });
    }
  }

  setScanMode(mode: string): Promise<void> {
    return this.scanModeService.setCodeMode(mode);
  }

  async executeCommand(
    name: string,
    fn: (...args: unknown[]) => Promise<unknown>,
    ...args: unknown[]
  ): Promise<unknown> {
    if (!this.debouncedCommands[name])
      this.debouncedCommands[name] = _.debounce(
        async (...args: unknown[]): Promise<unknown> => {
          try {
            return await fn(...args);
          } catch (error) {
            // todo: add error reporting
            return Promise.resolve();
          }
        },
        COMMAND_DEBOUNCE_INTERVAL,
        { leading: true, trailing: false },
      );
    return this.debouncedCommands[name](...args);
  }
}
