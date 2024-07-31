import { Command, Range } from 'vscode';
import { OpenCommandIssueType, OpenIssueCommandArg } from '../../common/commands/types';
import { IConfiguration } from '../../common/configuration/configuration';
import { SNYK_OPEN_ISSUE_COMMAND } from '../../common/constants/commands';
import { CodeIssueData, Issue } from '../../common/languageServer/types';
import { IContextService } from '../../common/services/contextService';
import { IProductService } from '../../common/services/productService';
import { ProductIssueTreeProvider } from '../../common/views/issueTreeProvider';
import { IVSCodeLanguages } from '../../common/vscode/languages';
import { messages } from '../messages/analysis';
import { IssueUtils } from '../utils/issueUtils';
import { CodeIssueCommandArg } from './interfaces';
import { TreeNode } from '../../common/views/treeNode';
import { IFolderConfigs } from '../../common/configuration/folderConfigs';

export class IssueTreeProvider extends ProductIssueTreeProvider<CodeIssueData> {
  constructor(
    protected contextService: IContextService,
    protected codeService: IProductService<CodeIssueData>,
    protected configuration: IConfiguration,
    protected languages: IVSCodeLanguages,
    protected readonly isSecurityType: boolean,
    protected readonly folderConfigs: IFolderConfigs,
  ) {
    super(contextService, codeService, configuration, languages, folderConfigs);
  }

  shouldShowTree(): boolean {
    return this.contextService.shouldShowCodeAnalysis;
  }

  filterIssues(issues: Issue<CodeIssueData>[]): Issue<CodeIssueData>[] {
    return issues.filter(i => i.additionalData.isSecurityType == this.isSecurityType);
  }

  getRunTestMessage = () => messages.runTest;

  // The title in the tree is taken from the title for vulnerabilities and from the message for quality rules
  getIssueTitle(issue: Issue<CodeIssueData>): string {
    const fixIcon = issue.additionalData.hasAIFix ? '⚡️' : '';
    const issueTitle = issue.additionalData.isSecurityType
      ? issue.title.split(':')[0]
      : issue.additionalData.message.split('.')[0];

    let prefixIgnored = '';
    if (issue.isIgnored) {
      prefixIgnored = '[ Ignored ] ';
    }

    return fixIcon + prefixIgnored + issueTitle;
  }

  getIssueRange(issue: Issue<CodeIssueData>): Range {
    return IssueUtils.createVsCodeRange(issue.additionalData, this.languages);
  }

  getOpenIssueCommand(issue: Issue<CodeIssueData>, folderPath: string, filePath: string): Command {
    return {
      command: SNYK_OPEN_ISSUE_COMMAND,
      title: '',
      arguments: [
        {
          issueType: OpenCommandIssueType.CodeIssue,
          issue: {
            id: issue.id,
            folderPath,
            filePath,
            range: this.getIssueRange(issue),
          } as CodeIssueCommandArg,
        } as OpenIssueCommandArg,
      ],
    };
  }

  isFixableIssue(issue: Issue<CodeIssueData>): boolean {
    return issue.additionalData.hasAIFix;
  }

  getFixableIssuesNode(fixableIssueCount: number): TreeNode {
    return new TreeNode({
      text: this.getAIFixableIssuesText(fixableIssueCount),
    });
  }

  private getAIFixableIssuesText(issuesCount: number): string {
    return issuesCount > 0
      ? `⚡️ ${issuesCount} ${issuesCount === 1 ? 'issue' : 'issues'} can be fixed by Snyk DeepCode AI`
      : 'There are no issues fixable by Snyk DeepCode AI';
  }
}
