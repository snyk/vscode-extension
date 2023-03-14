import { Command, Range } from 'vscode';
import { OpenCommandIssueType, OpenIssueCommandArg } from '../../common/commands/types';
import { SNYK_OPEN_ISSUE_COMMAND } from '../../common/constants/commands';
import { IacIssueData, Issue } from '../../common/languageServer/types';
import { ProductIssueTreeProvider } from '../../common/views/issueTreeProvider';
import { messages } from '../messages/analysis';
import { IacIssueCommandArg } from './interfaces';

export class IssueTreeProvider extends ProductIssueTreeProvider<IacIssueData> {
  filterIssues(issues: Issue<IacIssueData>[]): Issue<IacIssueData>[] {
    return issues;
  }

  getRunTestMessage = () => messages.runTest;

  getIssueTitle = (issue: Issue<IacIssueData>) => issue.title;

  getIssueRange(issue: Issue<IacIssueData>): Range {
    return this.languages.createRange(
      issue.additionalData.lineNumber,
      0,
      issue.additionalData.lineNumber,
      Number.MAX_VALUE,
    );
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
