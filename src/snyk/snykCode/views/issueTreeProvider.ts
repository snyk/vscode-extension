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

export class IssueTreeProvider extends ProductIssueTreeProvider<CodeIssueData> {
  constructor(
    protected contextService: IContextService,
    protected codeService: IProductService<CodeIssueData>,
    protected configuration: IConfiguration,
    protected languages: IVSCodeLanguages,
    protected readonly isSecurityType: boolean,
  ) {
    super(contextService, codeService, configuration, languages);
  }

  filterIssues(issues: Issue<CodeIssueData>[]): Issue<CodeIssueData>[] {
    return issues.filter(i => i.additionalData.isSecurityType == this.isSecurityType);
  }

  getRunTestMessage = () => messages.runTest;

  getIssueTitle = (issue: Issue<CodeIssueData>) => issue.additionalData.message;

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
}
