import { CodeAction, Range, TextDocument } from 'vscode';
import { IAnalytics, SupportedQuickFixProperties } from '../../common/analytics/itly';
import { OpenCommandIssueType, OpenIssueCommandArg } from '../../common/commands/types';
import { SNYK_IGNORE_ISSUE_COMMAND, SNYK_OPEN_ISSUE_COMMAND } from '../../common/constants/commands';
import { CodeActionsProvider } from '../../common/editor/codeActionsProvider';
import { CodeIssueData, Issue } from '../../common/languageServer/types';
import { codeActionMessages } from '../../common/messages/codeActionMessages';
import { ProductResult } from '../../common/services/productService';
import { ICodeActionAdapter, ICodeActionKindAdapter } from '../../common/vscode/codeAction';
import { IVSCodeLanguages } from '../../common/vscode/languages';
import { FILE_IGNORE_ACTION_NAME, IGNORE_ISSUE_ACTION_NAME } from '../constants/analysis';
import { IssueUtils } from '../utils/issueUtils';
import { CodeIssueCommandArg } from '../views/interfaces';

export class SnykCodeActionsProvider extends CodeActionsProvider<CodeIssueData> {
  constructor(
    issues: Readonly<ProductResult<CodeIssueData>>,
    private readonly codeActionAdapter: ICodeActionAdapter,
    codeActionKindAdapter: ICodeActionKindAdapter,
    private readonly languages: IVSCodeLanguages,
    analytics: IAnalytics,
  ) {
    super(issues, codeActionKindAdapter, analytics);
  }

  getActions(folderPath: string, document: TextDocument, issue: Issue<CodeIssueData>, range: Range): CodeAction[] {
    const openIssueAction = this.createOpenIssueAction(folderPath, issue, range);
    const ignoreIssueAction = this.createIgnoreIssueAction(document, issue, range, false);
    const fileIgnoreIssueAction = this.createIgnoreIssueAction(document, issue, range, true);

    // returns list of actions, all new actions should be added to this list
    return [openIssueAction, ignoreIssueAction, fileIgnoreIssueAction];
  }

  getAnalyticsActionTypes(): [string, ...string[]] & [SupportedQuickFixProperties, ...SupportedQuickFixProperties[]] {
    return ['Show Suggestion', 'Ignore Suggestion In Line', 'Ignore Suggestion In File'];
  }

  getIssueRange(issue: Issue<CodeIssueData>): Range {
    return IssueUtils.createVsCodeRange(issue.additionalData, this.languages);
  }

  private createIgnoreIssueAction(
    document: TextDocument,
    issue: Issue<CodeIssueData>,
    range: Range,
    isFileIgnore: boolean,
  ): CodeAction {
    const actionName = isFileIgnore ? FILE_IGNORE_ACTION_NAME : IGNORE_ISSUE_ACTION_NAME;
    const ignoreAction = this.codeActionAdapter.create(actionName, this.providedCodeActionKinds[0]);
    const matchedIssue = {
      range: range,
    };
    const ruleId = issue.additionalData.rule;
    ignoreAction.command = {
      command: SNYK_IGNORE_ISSUE_COMMAND,
      title: SNYK_IGNORE_ISSUE_COMMAND,
      arguments: [{ uri: document.uri, matchedIssue, ruleId, isFileIgnore }],
    };

    return ignoreAction;
  }

  private createOpenIssueAction(folderPath: string, issue: Issue<CodeIssueData>, issueRange: Range): CodeAction {
    const openIssueAction = this.codeActionAdapter.create(
      codeActionMessages.showSuggestion,
      this.providedCodeActionKinds[0],
    );

    openIssueAction.command = {
      command: SNYK_OPEN_ISSUE_COMMAND,
      title: SNYK_OPEN_ISSUE_COMMAND,
      arguments: [
        {
          issueType: OpenCommandIssueType.CodeIssue,
          issue: {
            id: issue.id,
            folderPath,
            filePath: issue.filePath,
            range: issueRange,
          } as CodeIssueCommandArg,
        } as OpenIssueCommandArg,
      ],
    };

    return openIssueAction;
  }
}
