import { CodeAction, Range, TextDocument } from 'vscode';
import { OpenCommandIssueType, OpenIssueCommandArg } from '../../common/commands/types';
import { SNYK_OPEN_ISSUE_COMMAND } from '../../common/constants/commands';
import { CodeActionsProvider } from '../../common/editor/codeActionsProvider';
import { IacIssueData, Issue } from '../../common/languageServer/types';
import { codeActionMessages } from '../../common/messages/codeActionMessages';
import { ProductResult } from '../../common/services/productService';
import { ICodeActionAdapter, ICodeActionKindAdapter } from '../../common/vscode/codeAction';
import { IVSCodeLanguages } from '../../common/vscode/languages';
import { IacIssue } from '../issue';
import { IacIssueCommandArg } from '../views/interfaces';

export class IacCodeActionsProvider extends CodeActionsProvider<IacIssueData> {
  constructor(
    issues: Readonly<ProductResult<IacIssueData>>,
    private readonly codeActionAdapter: ICodeActionAdapter,
    codeActionKindAdapter: ICodeActionKindAdapter,
    private readonly languages: IVSCodeLanguages,
  ) {
    super(issues, codeActionKindAdapter);
  }

  getActions(folderPath: string, _: TextDocument, issue: Issue<IacIssueData>, range: Range): CodeAction[] {
    const openIssueAction = this.createOpenIssueAction(folderPath, issue, range);

    // returns list of actions, all new actions should be added to this list
    return [openIssueAction];
  }

  getIssueRange(issue: Issue<IacIssueData>): Range {
    return IacIssue.getRange(issue, this.languages);
  }

  private createOpenIssueAction(folderPath: string, issue: Issue<IacIssueData>, issueRange: Range): CodeAction {
    const openIssueAction = this.codeActionAdapter.create(
      codeActionMessages.showSuggestion,
      this.providedCodeActionKinds[0],
    );

    openIssueAction.command = {
      command: SNYK_OPEN_ISSUE_COMMAND,
      title: SNYK_OPEN_ISSUE_COMMAND,
      arguments: [
        {
          issueType: OpenCommandIssueType.IacIssue,
          issue: {
            id: issue.id,
            folderPath,
            filePath: issue.filePath,
            range: issueRange,
          } as IacIssueCommandArg,
        } as OpenIssueCommandArg,
      ],
    };

    return openIssueAction;
  }
}
