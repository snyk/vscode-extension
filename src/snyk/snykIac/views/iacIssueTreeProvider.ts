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

export default class IacIssueTreeProvider extends ProductIssueTreeProvider<IacIssueData> {
  constructor(
    protected viewManagerService: IViewManagerService,
    protected contextService: IContextService,
    protected iacService: IProductService<IacIssueData>,
    protected configuration: IConfiguration,
    protected languages: IVSCodeLanguages,
    protected readonly folderConfigs: IFolderConfigs,
  ) {
    super(contextService, iacService, configuration, languages, folderConfigs);
  }

  getRootChildren(): TreeNode[] {
    if (!configuration.getFeaturesConfiguration()?.iacEnabled) {
      return [
        new TreeNode({
          text: SNYK_ANALYSIS_STATUS.IAC_DISABLED,
        }),
      ];
    }

    return super.getRootChildren();
  }

  onDidChangeTreeData = this.viewManagerService.refreshIacViewEmitter.event;

  shouldShowTree(): boolean {
    return this.contextService.shouldShowIacAnalysis;
  }

  getIssueDescriptionText(dir: string | undefined, issueCount: number): string | undefined {
    return `${dir} - ${issueCount} ${issueCount === 1 ? 'issue' : 'issues'}`;
  }

  getIssueFoundText(nIssues: number, _: number): string {
    if (!nIssues) {
      return '✅ Congrats! No issues found!';
    }
    return `Snyk found ${nIssues} issue${nIssues === 1 ? '' : 's'}`;
  }

  filterIssues(issues: Issue<IacIssueData>[]): Issue<IacIssueData>[] {
    return issues;
  }

  getRunTestMessage = () => messages.runTest;

  getIssueTitle = (issue: Issue<IacIssueData>) => issue.title;

  getIssueRange(issue: Issue<IacIssueData>): Range {
    return IacIssue.getRange(issue, this.languages);
  }

  getOpenIssueCommand(issue: Issue<IacIssueData>, folderPath: string, filePath: string): Command {
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
