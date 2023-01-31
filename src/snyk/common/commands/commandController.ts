/* eslint-disable @typescript-eslint/no-unsafe-argument */
import _ from 'lodash';
import { IAuthenticationService } from '../../base/services/authenticationService';
import { ScanModeService } from '../../base/services/scanModeService';
import { ISnykCodeService } from '../../snykCode/codeService';
import { ISnykCodeServiceOld } from '../../snykCode/codeServiceOld';
import { CodeScanMode } from '../../snykCode/constants/modes';
import { createDCIgnore } from '../../snykCode/utils/ignoreFileUtils';
import { IssueUtils } from '../../snykCode/utils/issueUtils';
import { CodeIssueCommandArg, CodeIssueCommandArgOld } from '../../snykCode/views/interfaces';
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
import {
  SNYK_LANGUAGE_SERVER_NAME,
  SNYK_LOGIN_COMMAND,
  SNYK_TRUST_WORKSPACE_FOLDERS_COMMAND,
} from '../constants/languageServer';
import { ErrorHandler } from '../error/errorHandler';
import { ILog } from '../logger/interfaces';
import { IOpenerService } from '../services/openerService';
import { IVSCodeCommands } from '../vscode/commands';
import { Range, Uri } from '../vscode/types';
import { IUriAdapter } from '../vscode/uri';
import { IVSCodeWindow } from '../vscode/window';
import { IVSCodeWorkspace } from '../vscode/workspace';
import { OpenCommandIssueType, OpenIssueCommandArg } from './types';

export class CommandController {
  private debouncedCommands: Record<string, _.DebouncedFunc<(...args: unknown[]) => Promise<unknown>>> = {};

  constructor(
    private openerService: IOpenerService,
    private authService: IAuthenticationService,
    private snykCode: ISnykCodeService,
    private snykCodeOld: ISnykCodeServiceOld,
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

  async openLocalFile(filePath: string, range?: Range): Promise<void> {
    try {
      await this.window.showTextDocumentViaFilepath(filePath, { viewColumn: 1, selection: range });
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
      const issueArgs = arg.issue as CodeIssueCommandArg;
      const issue = this.snykCode.getIssue(issueArgs.folderPath, issueArgs.id);
      if (!issue) {
        this.logger.warn(`Failed to find the issue ${issueArgs.id}.`);
        return;
      }

      await this.openLocalFile(issue.filePath, issueArgs.range);

      try {
        this.snykCode.showSuggestionProvider(issueArgs.folderPath, issueArgs.id);
      } catch (e) {
        ErrorHandler.handle(e, this.logger);
      }

      this.analytics.logIssueInTreeIsClicked({
        ide: IDE_NAME,
        issueId: decodeURIComponent(issue.id),
        issueType: IssueUtils.getIssueType(issue.additionalData.isSecurityType),
        severity: IssueUtils.issueSeverityAsText(issue.severity),
      });
    } else if (arg.issueType == OpenCommandIssueType.CodeIssueOld) {
      const issue = arg.issue as CodeIssueCommandArgOld;
      const suggestion = this.snykCodeOld.analyzer.findSuggestion(issue.diagnostic);
      if (!suggestion) return;
      // Set openUri = null to avoid opening the file (e.g. in the ActionProvider)
      await this.openLocal(issue.filePath, issue.range);

      try {
        this.snykCodeOld.suggestionProvider.show(suggestion.id, issue.filePath, issue.range);
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

  setScanMode(mode: CodeScanMode): Promise<void> {
    return this.scanModeService.setCodeMode(mode);
  }

  showOutputChannel(): void {
    return this.logger.showOutput();
  }

  showLsOutputChannel(): void {
    // To get an instance of an OutputChannel use createOutputChannel.
    return this.window.createOutputChannel(SNYK_LANGUAGE_SERVER_NAME).show();
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
