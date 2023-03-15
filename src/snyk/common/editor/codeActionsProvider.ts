import { IAnalytics, SupportedQuickFixProperties } from '../../common/analytics/itly';
import { IDE_NAME } from '../../common/constants/general';
import { Issue } from '../../common/languageServer/types';
import { ICodeActionKindAdapter } from '../../common/vscode/codeAction';
import { CodeAction, CodeActionKind, CodeActionProvider, Range, TextDocument } from '../../common/vscode/types';
import { ProductResult } from '../services/productService';

export abstract class CodeActionsProvider<T> implements CodeActionProvider {
  protected readonly providedCodeActionKinds = [this.codeActionKindAdapter.getQuickFix()];

  constructor(
    private readonly issues: ProductResult<T>,
    private readonly codeActionKindAdapter: ICodeActionKindAdapter,
    private readonly analytics: IAnalytics,
  ) {}

  abstract getActions(folderPath: string, document: TextDocument, issue: Issue<T>, issueRange: Range): CodeAction[];

  abstract getAnalyticsActionTypes(): [string, ...string[]] &
    [SupportedQuickFixProperties, ...SupportedQuickFixProperties[]];

  abstract getIssueRange(issue: Issue<T>): Range;

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
      if (issues instanceof Error || !issues) {
        continue;
      }

      const { issue, range } = this.findIssueWithRange(issues, document, clickedRange);
      if (!issue || !range) {
        continue;
      }

      const codeActions = this.getActions(folderPath, document, issue, range);
      const analyticsType = this.getAnalyticsActionTypes();

      this.analytics.logQuickFixIsDisplayed({
        quickFixType: analyticsType,
        ide: IDE_NAME,
      });

      // returns list of actions, all new actions should be added to this list
      return codeActions;
    }

    return undefined;
  }

  private findIssueWithRange(
    result: Issue<T>[],
    document: TextDocument,
    clickedRange: Range,
  ): { issue: Issue<T> | undefined; range: Range | undefined } {
    let range = undefined;

    const issue = result.find(issue => {
      if (issue.filePath !== document.uri.fsPath) {
        return false;
      }

      range = this.getIssueRange(issue);

      return range.contains(clickedRange);
    });

    return { issue, range };
  }
}
