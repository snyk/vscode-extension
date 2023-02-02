import { IAnalytics } from '../../common/analytics/itly';
import { OpenCommandIssueType, OpenIssueCommandArg } from '../../common/commands/types';
import { SNYK_OPEN_ISSUE_COMMAND } from '../../common/constants/commands';
import { IDE_NAME } from '../../common/constants/general';
import { CodeIssueData, Issue } from '../../common/languageServer/types';
import { ICodeActionAdapter, ICodeActionKindAdapter } from '../../common/vscode/codeAction';
import { IVSCodeLanguages } from '../../common/vscode/languages';
import { CodeAction, CodeActionKind, CodeActionProvider, Range, TextDocument } from '../../common/vscode/types';
import { CodeResult } from '../codeResult';
import { SHOW_ISSUE_ACTION_NAME } from '../constants/analysis';
import { IssueUtils } from '../utils/issueUtils';
import { CodeIssueCommandArg } from '../views/interfaces';

export class SnykCodeActionsProvider implements CodeActionProvider {
  private readonly providedCodeActionKinds = [this.codeActionKindAdapter.getQuickFix()];

  constructor(
    private readonly issues: Readonly<CodeResult>,
    private readonly codeActionAdapter: ICodeActionAdapter,
    private readonly codeActionKindAdapter: ICodeActionKindAdapter,
    private readonly languages: IVSCodeLanguages,
    private readonly analytics: IAnalytics,
  ) {}

  getProvidedCodeActionKinds(): CodeActionKind[] {
    return this.providedCodeActionKinds;
  }

  public provideCodeActions(document: TextDocument, clickedRange: Range): CodeAction[] | undefined {
    if (this.issues.size === 0) {
      return undefined;
    }

    for (const result of this.issues.entries()) {
      const folderPath = result[0];
      const issues = result[1];
      if (issues instanceof Error) {
        continue;
      }

      const { issue, range } = this.findIssueWithRange(issues, document, clickedRange);
      if (!issue || !range) {
        continue;
      }

      const showIssueAction = this.createShowIssueAction(folderPath, issue, range);

      this.analytics.logQuickFixIsDisplayed({
        quickFixType: ['Show Suggestion', 'Ignore Suggestion In Line', 'Ignore Suggestion In File'],
        ide: IDE_NAME,
      });

      // returns list of actions, all new actions should be added to this list
      return [showIssueAction];
    }

    return undefined;
  }

  private findIssueWithRange(
    result: Issue<CodeIssueData>[],
    document: TextDocument,
    clickedRange: Range,
  ): { issue: Issue<CodeIssueData> | undefined; range: Range | undefined } {
    let range = undefined;

    const issue = result.find(issue => {
      if (issue.filePath !== document.uri.fsPath) {
        return false;
      }

      range = IssueUtils.createVsCodeRange(issue.additionalData, this.languages);

      return range.contains(clickedRange);
    });

    return { issue, range };
  }

  private createShowIssueAction(folderPath: string, issue: Issue<CodeIssueData>, issueRange: Range): CodeAction {
    const showIssueAction = this.codeActionAdapter.create(SHOW_ISSUE_ACTION_NAME, this.providedCodeActionKinds[0]);

    showIssueAction.command = {
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

    return showIssueAction;
  }
}
