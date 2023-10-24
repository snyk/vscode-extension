import { CodeAction, Range, TextDocument } from 'vscode';
import { IAnalytics, SupportedQuickFixProperties } from '../../common/analytics/itly';
import { OpenCommandIssueType, OpenIssueCommandArg } from '../../common/commands/types';
import { SNYK_OPEN_ISSUE_COMMAND } from '../../common/constants/commands';
import { CodeActionsProvider } from '../../common/editor/codeActionsProvider';
import { Issue, OssIssueData } from '../../common/languageServer/types';
import { codeActionMessages } from '../../common/messages/codeActionMessages';
import { ProductResult } from '../../common/services/productService';
import { ICodeActionAdapter, ICodeActionKindAdapter } from '../../common/vscode/codeAction';
import { IVSCodeLanguages } from '../../common/vscode/languages';
import { OssIssueCommandArg } from '../views/interfaces';

// TODO: Where are OSS code actions implemented?
export class OssCodeActionsProvider extends CodeActionsProvider<OssIssueData> {
  constructor(
    issues: Readonly<ProductResult<OssIssueData>>,
    private readonly codeActionAdapter: ICodeActionAdapter,
    codeActionKindAdapter: ICodeActionKindAdapter,
    private readonly languages: IVSCodeLanguages,
    analytics: IAnalytics,
  ) {
    super(issues, codeActionKindAdapter, analytics);
  }

  getActions(folderPath: string, _: TextDocument, issue: Issue<OssIssueData>, range: Range): CodeAction[] {
    const openIssueAction = this.createOpenIssueAction(folderPath, issue, range);

    // returns list of actions, all new actions should be added to this list
    return [openIssueAction];
  }

  getAnalyticsActionTypes(): [string, ...string[]] & [SupportedQuickFixProperties, ...SupportedQuickFixProperties[]] {
    return ['Show Suggestion'];
  }

  getIssueRange(issue: Issue<OssIssueData>): Range {
    // TODO: where do we get OSS issue range from?
  }

  private createOpenIssueAction(folderPath: string, issue: Issue<OssIssueData>, issueRange: Range): CodeAction {
    const openIssueAction = this.codeActionAdapter.create(
      codeActionMessages.showSuggestion,
      this.providedCodeActionKinds[0],
    );

    openIssueAction.command = {
      command: SNYK_OPEN_ISSUE_COMMAND,
      title: SNYK_OPEN_ISSUE_COMMAND,
      arguments: [
        {
          issueType: OpenCommandIssueType.OssVulnerability,
          issue: {
            id: issue.id,
            folderPath,
            filePath: issue.filePath,
            range: issueRange,
          } as OssIssueCommandArg,
        } as OpenIssueCommandArg,
      ],
    };

    return openIssueAction;
  }
}
