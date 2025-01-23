/* eslint-disable @typescript-eslint/no-unsafe-argument */
import _ from 'lodash';
import { IAuthenticationService } from '../../base/services/authenticationService';
import { ScanModeService } from '../../base/services/scanModeService';
import { createDCIgnore as createDCIgnoreUtil } from '../../snykCode/utils/ignoreFileUtils';
import { CodeIssueCommandArg } from '../../snykCode/views/interfaces';
import { IacIssueCommandArg } from '../../snykIac/views/interfaces';
import { OssService } from '../../snykOss/ossService';
import {
  SNYK_INITIATE_LOGIN_COMMAND,
  SNYK_LOGIN_COMMAND,
  SNYK_OPEN_BROWSER_COMMAND,
  SNYK_SET_TOKEN_COMMAND,
  SNYK_TRUST_WORKSPACE_FOLDERS_COMMAND,
  VSCODE_GO_TO_SETTINGS_COMMAND,
} from '../constants/commands';
import { COMMAND_DEBOUNCE_INTERVAL } from '../constants/general';
import { ErrorHandler } from '../error/errorHandler';
import { ILanguageServer } from '../languageServer/languageServer';
import { CodeIssueData, IacIssueData } from '../languageServer/types';
import { ILog } from '../logger/interfaces';
import { IOpenerService } from '../services/openerService';
import { IProductService } from '../services/productService';
import { IVSCodeCommands } from '../vscode/commands';
import { Range, Uri } from '../vscode/types';
import { IUriAdapter } from '../vscode/uri';
import { IVSCodeWindow } from '../vscode/window';
import { IVSCodeWorkspace } from '../vscode/workspace';
import { OpenCommandIssueType, OpenIssueCommandArg } from './types';
import { IFolderConfigs } from '../configuration/folderConfigs';
import { IConfiguration } from '../configuration/configuration';

export class CommandController {
  private debouncedCommands: Record<string, _.DebouncedFunc<(...args: unknown[]) => Promise<unknown>>> = {};

  constructor(
    private openerService: IOpenerService,
    private authService: IAuthenticationService,
    private snykCode: IProductService<CodeIssueData>,
    private iacService: IProductService<IacIssueData>,
    private ossService: OssService,
    private scanModeService: ScanModeService,
    private workspace: IVSCodeWorkspace,
    private commands: IVSCodeCommands,
    private window: IVSCodeWindow,
    private languageServer: ILanguageServer,
    private logger: ILog,
    private configuration: IConfiguration,
    private folderConfigs: IFolderConfigs,
  ) {}

  openBrowser(url: string): unknown {
    return this.executeCommand(SNYK_OPEN_BROWSER_COMMAND, this.openerService.openBrowserUrl.bind(this), url);
  }

  async initiateLogin(): Promise<void> {
    this.logger.info('Initiating login');
    await this.executeCommand(SNYK_INITIATE_LOGIN_COMMAND, this.authService.initiateLogin.bind(this.authService));
    await this.commands.executeCommand(SNYK_TRUST_WORKSPACE_FOLDERS_COMMAND);
    await this.commands.executeCommand(SNYK_LOGIN_COMMAND);
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

  async setBaseBranch(folderPath: string): Promise<void> {
    await this.folderConfigs.setBranch(this.window, this.configuration, folderPath);
  }

  async toggleDelta(isEnabled: boolean): Promise<void> {
    await this.configuration.setDeltaFindingsEnabled(isEnabled);
  }

  openSettings(): void {
    void this.commands.executeCommand(VSCODE_GO_TO_SETTINGS_COMMAND, `@ext:${this.configuration.getExtensionId()}`);
  }

  async createDCIgnore(custom = false, uriAdapter: IUriAdapter, path?: string): Promise<void> {
    if (!path) {
      const paths = this.workspace.getWorkspaceFolders();
      const promises = [];
      for (const p of paths) {
        promises.push(createDCIgnoreUtil(p, custom, this.workspace, this.window, uriAdapter));
      }
      await Promise.all(promises);
    } else {
      await createDCIgnoreUtil(path, custom, this.workspace, this.window, uriAdapter);
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
    } else if (arg.issueType == OpenCommandIssueType.OssVulnerability) {
      const issueArgs = arg.issue as CodeIssueCommandArg;
      const folderPath = issueArgs.folderPath;
      const issue = this.ossService.getIssue(folderPath, issueArgs.id);

      if (!issue) {
        this.logger.warn(`Failed to find the issue ${issueArgs.id}.`);
        return;
      }

      await this.openLocalFile(issue.filePath, issueArgs.range);

      try {
        await this.ossService.showSuggestionProvider(folderPath, issueArgs.id);
      } catch (e) {
        ErrorHandler.handle(e, this.logger);
      }
    } else if (arg.issueType == OpenCommandIssueType.IacIssue) {
      const issueArgs = arg.issue as IacIssueCommandArg;
      const issue = this.iacService.getIssue(issueArgs.folderPath, issueArgs.id);
      if (!issue) {
        this.logger.warn(`Failed to find the issue ${issueArgs.id}.`);
        return;
      }

      await this.openLocalFile(issue.filePath, issueArgs.range);

      try {
        this.iacService.showSuggestionProvider(issueArgs.folderPath, issueArgs.id);
      } catch (e) {
        ErrorHandler.handle(e, this.logger);
      }
    }
  }

  showOutputChannel(): void {
    return this.logger.showOutput();
  }

  showLsOutputChannel(): void {
    // To get an instance of an OutputChannel use createOutputChannel.
    return this.languageServer.showOutputChannel();
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
