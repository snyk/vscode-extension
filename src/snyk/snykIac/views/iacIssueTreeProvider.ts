import { Command, Range } from 'vscode';
import { OpenCommandIssueType, OpenIssueCommandArg } from '../../common/commands/types';
import { IConfiguration } from '../../common/configuration/configuration';
import { configuration } from '../../common/configuration/instance';
import { SNYK_OPEN_ISSUE_COMMAND } from '../../common/constants/commands';
import { SNYK_ANALYSIS_STATUS } from '../../common/constants/views';
import { IacIssueData, Issue } from '../../common/languageServer/types';
import { IContextService } from '../../common/services/contextService';
import { IProductService } from '../../common/services/productService';
import { IViewManagerService } from '../../common/services/viewManagerService';
import { ProductIssueTreeProvider } from '../../common/views/issueTreeProvider';
import { TreeNode } from '../../common/views/treeNode';
import { IVSCodeLanguages } from '../../common/vscode/languages';
import { IacIssue } from '../issue';
import { messages } from '../messages/analysis';
import { IacIssueCommandArg } from './interfaces';
import { IFolderConfigs } from '../../common/configuration/folderConfigs';
import { ILog } from '../../common/logger/interfaces';

export default class IacIssueTreeProvider extends ProductIssueTreeProvider<IacIssueData> {
  constructor(
    protected readonly logger: ILog,
    protected viewManagerService: IViewManagerService,
    protected contextService: IContextService,
    protected iacService: IProductService<IacIssueData>,
    protected configuration: IConfiguration,
    protected languages: IVSCodeLanguages,
    protected readonly folderConfigs: IFolderConfigs,
  ) {
    super(logger, contextService, iacService, configuration, languages, folderConfigs);
  }

  getRootChildren(): TreeNode[] {
    if (!this.isIacEnabledAnywhere()) {
      return [
        new TreeNode({
          text: SNYK_ANALYSIS_STATUS.IAC_DISABLED,
        }),
      ];
    }

    return super.getRootChildren();
  }

  // Snyk IaC is enabled when at least one folder is effectively enabled. For each folder reported by
  // LS via $/snyk.configuration.folderConfigs[].settings, the folder's `snyk_iac_enabled` value is
  // preferred; if the folder did not override it, we fall back to the global VS Code setting. With no
  // folder configs at all, only the global setting is consulted.
  private isIacEnabledAnywhere(): boolean {
    const global = !!configuration.getFeaturesConfiguration()?.iacEnabled;
    const folderConfigs = configuration.getFolderConfigs();
    if (folderConfigs.length === 0) return global;
    return folderConfigs.some(fc => fc.snykIacEnabled() ?? global);
  }

  onDidChangeTreeData = this.viewManagerService.refreshIacViewEmitter.event;

  shouldShowTree(): boolean {
    return this.contextService.shouldShowIacAnalysis;
  }

  filterIssues(issues: Issue<IacIssueData>[]): Issue<IacIssueData>[] {
    return issues;
  }

  getRunTestMessage = () => messages.runTest;

  getIssueTitle = (issue: Issue<IacIssueData>) => issue.title;

  getIssueRange(issue: Issue<IacIssueData>): Range {
    return IacIssue.getRange(issue, this.languages);
  }

  override getOpenIssueCommand(
    issue: Issue<IacIssueData>,
    folderPath: string,
    filePath: string,
    _filteredIssues: Issue<IacIssueData>[],
  ): Command {
    return {
      command: SNYK_OPEN_ISSUE_COMMAND,
      title: '',
      arguments: [
        {
          issueType: OpenCommandIssueType.IacIssue,
          issue: {
            id: issue.id,
            folderPath,
            filePath,
            range: this.getIssueRange(issue),
          } as IacIssueCommandArg,
        } as OpenIssueCommandArg,
      ],
    };
  }
}
