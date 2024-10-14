import { Issue } from '../languageServer/types';
import { ICodeActionKindAdapter } from '../vscode/codeAction';
import { CodeAction, CodeActionContext, CodeActionProvider, Range, TextDocument } from '../vscode/types';
import { ProductResult } from '../services/productService';

export abstract class CodeActionsProvider<T> implements CodeActionProvider {
  protected readonly providedCodeActionKinds = [this.codeActionKindAdapter.getQuickFix()];

  constructor(
    protected readonly issues: ProductResult<T>,
    private readonly codeActionKindAdapter: ICodeActionKindAdapter,
  ) {}

  abstract getActions(folderPath: string, document: TextDocument, issue: Issue<T>, issueRange?: Range): CodeAction[];

  abstract getIssueRange(issue: Issue<T>): Range;

  public provideCodeActions(
    document: TextDocument,
    clickedRange: Range,
    _context: CodeActionContext,
  ): CodeAction[] | undefined {
    if (this.issues.size === 0) {
      return undefined;
    }

    for (const [folderPath, issues] of this.issues.entries()) {
      if (issues instanceof Error || !issues) {
        continue;
      }

      const { issue, range } = this.findIssueWithRange(issues, document, clickedRange);
      if (!issue || !range) {
        continue;
      }

      // If an issue is found, return the actions
      return this.getActions(folderPath, document, issue, range);
    }

    // If no issues were found after checking all entries, return undefined
    return undefined;
  }

  protected findIssueWithRange(
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
