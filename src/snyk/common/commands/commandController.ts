/* eslint-disable @typescript-eslint/no-unsafe-argument */
import _ from 'lodash';
import { IAuthenticationService } from '../../base/services/authenticationService';
import { ScanModeService } from '../../base/services/scanModeService';
import { ISnykCodeService } from '../../snykCode/codeService';
import { CodeScanMode } from '../../snykCode/constants/modes';
import { FalsePositive } from '../../snykCode/falsePositive/falsePositive';
import { createDCIgnore } from '../../snykCode/utils/ignoreFileUtils';
import { IssueUtils } from '../../snykCode/utils/issueUtils';
import { FalsePositiveWebviewModel } from '../../snykCode/views/falsePositive/falsePositiveWebviewProvider';
import { CodeIssueCommandArg } from '../../snykCode/views/interfaces';
import { capitalizeOssSeverity } from '../../snykOss/ossResult';
import { OssService } from '../../snykOss/services/ossService';
import { OssIssueCommandArg } from '../../snykOss/views/ossVulnerabilityTreeProvider';
import { IAnalytics } from '../analytics/itly';
import {
  SNYK_INITIATE_LOGIN_COMMAND,
  SNYK_OPEN_BROWSER_COMMAND,
  SNYK_SET_TOKEN_COMMAND,
  VSCODE_GO_TO_SETTINGS_COMMAND,
} from '../constants/commands';
import { COMMAND_DEBOUNCE_INTERVAL, IDE_NAME, SNYK_NAME_EXTENSION, SNYK_PUBLISHER } from '../constants/general';
import { SNYK_LOGIN_COMMAND, SNYK_TRUST_WORKSPACE_FOLDERS_COMMAND } from '../constants/languageServer';
import { ErrorHandler } from '../error/errorHandler';
import { ILog } from '../logger/interfaces';
import { IOpenerService } from '../services/openerService';
import { IVSCodeCommands } from '../vscode/commands';
import { Range, Uri } from '../vscode/types';
import { IUriAdapter } from '../vscode/uri';
import { IVSCodeWindow } from '../vscode/window';
import { IVSCodeWorkspace } from '../vscode/workspace';
import { OpenCommandIssueType, OpenIssueCommandArg, ReportFalsePositiveCommandArg } from './types';

export class CommandController {
  private debouncedCommands: Record<string, _.DebouncedFunc<(...args: unknown[]) => Promise<unknown>>> = {};

  constructor(
    private openerService: IOpenerService,
    private authService: IAuthenticationService,
    private snykCode: ISnykCodeService,
    private ossService: OssService,
    private scanModeService: ScanModeService,
    private workspace: IVSCodeWorkspace,
    private commands: IVSCodeCommands,
    private window: IVSCodeWindow,
    private logger: ILog,
    private analytics: IAnalytics,
  ) {}

  openBrowser(url: string): unknown {
    return this.executeCommand(SNYK_OPEN_BROWSER_COMMAND, this.openerService.openBrowserUrl.bind(this), url);
  }

  async initiateLogin(): Promise<void> {
    this.logger.info('Initiating login');
    await this.executeCommand(SNYK_INITIATE_LOGIN_COMMAND, this.authService.initiateLogin.bind(this.authService));
    await this.commands.executeCommand(SNYK_LOGIN_COMMAND);
    await this.commands.executeCommand(SNYK_TRUST_WORKSPACE_FOLDERS_COMMAND);
  }

  async setToken(): Promise<void> {
    await this.executeCommand(SNYK_SET_TOKEN_COMMAND, this.authService.setToken.bind(this.authService));
  }

  async openLocal(path: Uri, range?: Range): Promise<void> {
    try {
      await this.window.showTextDocumentViaUri(path, { viewColumn: 1, selection: range });
    } catch (e) {
      ErrorHandler.handle(e, this.logger);
    }
  }

  openSettings(): void {
    void this.commands.executeCommand(VSCODE_GO_TO_SETTINGS_COMMAND, `@ext:${SNYK_PUBLISHER}.${SNYK_NAME_EXTENSION}`);
  }

  async createDCIgnore(custom = false, uriAdapter: IUriAdapter, path?: string): Promise<void> {
    if (!path) {
      const paths = this.workspace.getWorkspaceFolders();
      const promises = [];
      for (const p of paths) {
        promises.push(createDCIgnore(p, custom, this.workspace, this.window, uriAdapter));
      }
      await Promise.all(promises);
    } else {
      await createDCIgnore(path, custom, this.workspace, this.window, uriAdapter);
    }
  }

  async openIssueCommand(arg: OpenIssueCommandArg): Promise<void> {
    if (arg.issueType == OpenCommandIssueType.CodeIssue) {
      const issue = arg.issue as CodeIssueCommandArg;
      const suggestion = this.snykCode.analyzer.findSuggestion(issue.diagnostic);
      if (!suggestion) return;
      // Set openUri = null to avoid opening the file (e.g. in the ActionProvider)
      if (issue.openUri !== null) await this.openLocal(issue.openUri || issue.uri, issue.openRange || issue.range);

      try {
        this.snykCode.suggestionProvider.show(suggestion.id, issue.uri, issue.range);
      } catch (e) {
        ErrorHandler.handle(e, this.logger);
      }

      this.analytics.logIssueInTreeIsClicked({
        ide: IDE_NAME,
        issueId: decodeURIComponent(suggestion.id),
        issueType: IssueUtils.getIssueType(suggestion.isSecurityType),
        severity: IssueUtils.severityAsText(suggestion.severity),
      });
    } else if (arg.issueType == OpenCommandIssueType.OssVulnerability) {
      const issue = arg.issue as OssIssueCommandArg;
      void this.ossService.showSuggestionProvider(issue);

      this.analytics.logIssueInTreeIsClicked({
        ide: IDE_NAME,
        issueId: issue.id,
        issueType: 'Open Source Vulnerability',
        severity: capitalizeOssSeverity(issue.severity),
      });
    }
  }

  async reportFalsePositive(arg: ReportFalsePositiveCommandArg): Promise<void> {
    const suggestion = arg.suggestion;
    if (!suggestion.markers || suggestion.markers.length === 0) {
      return;
    }

    let falsePositive;
    try {
      falsePositive = new FalsePositive(this.workspace, suggestion);
      falsePositive.content = await falsePositive.getGeneratedContent();
    } catch (e) {
      ErrorHandler.handle(e, this.logger);
    }

    if (!falsePositive || !falsePositive.content) {
      this.logger.warn('Report false positive not shown, since no file content available');
      return; // don't show panel, if no content available.
    }

    const model: FalsePositiveWebviewModel = {
      falsePositive: falsePositive,
      title: suggestion.title.length ? suggestion.title : suggestion.message,
      cwe: suggestion.cwe,
      suggestionType: suggestion.isSecurityType ? 'Vulnerability' : 'Issue',
      severity: suggestion.severity,
      severityText: IssueUtils.severityAsText(suggestion.severity).toLowerCase(),
      isSecurityTypeIssue: suggestion.isSecurityType,
    };

    await this.snykCode.falsePositiveProvider.showPanel(model);
  }

  setScanMode(mode: CodeScanMode): Promise<void> {
    return this.scanModeService.setCodeMode(mode);
  }

  showOutputChannel(): void {
    return this.logger.showOutput();
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
            ErrorHandler.handle(error, this.logger);
            return Promise.resolve();
          }
        },
        COMMAND_DEBOUNCE_INTERVAL,
        { leading: true, trailing: false },
      );
    return this.debouncedCommands[name](...args);
  }
}
