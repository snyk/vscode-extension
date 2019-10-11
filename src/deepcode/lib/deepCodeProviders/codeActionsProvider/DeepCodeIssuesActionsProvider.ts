import * as vscode from "vscode";
import { findIssueWithRange } from "../../../utils/analysisUtils";
import {
  IGNORE_ISSUE_ACTION_NAME,
  IGNORE_ISSUE_COMMENT_TEXT
} from "../../../constants/analysis";

export class DeepCodeIssuesActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix
  ];

  private issuesList: vscode.DiagnosticCollection | undefined;
  private saveCommand: vscode.Command = {
    command: "workbench.action.files.save",
    title: "Ignore issue and save"
  };

  constructor(issuesList: vscode.DiagnosticCollection | undefined) {
    this.issuesList = issuesList;
  }

  private addSpacesToText(text: string = "", spacesCount: number = 0): string {
    if (!spacesCount) {
      return text;
    }
    while (spacesCount) {
      text += ` `;
      spacesCount--;
    }
    return text;
  }

  private createIgnoreIssueAction(
    document: vscode.TextDocument,
    matchedIssue: vscode.Diagnostic
  ): vscode.CodeAction {
    const ignoreIssueAction = new vscode.CodeAction(
      IGNORE_ISSUE_ACTION_NAME,
      DeepCodeIssuesActionProvider.providedCodeActionKinds[0]
    );
    ignoreIssueAction.edit = new vscode.WorkspaceEdit();
    const symbolIndexToInsert = document.lineAt(matchedIssue.range.start.line)
      .firstNonWhitespaceCharacterIndex;
    const text = this.addSpacesToText(
      `${IGNORE_ISSUE_COMMENT_TEXT}\n`,
      symbolIndexToInsert
    );
    ignoreIssueAction.edit.insert(
      document.uri,
      new vscode.Position(matchedIssue.range.start.line, symbolIndexToInsert),
      text
    );
    ignoreIssueAction.command = { ...this.saveCommand };
    return ignoreIssueAction;
  }

  public provideCodeActions(
    document: vscode.TextDocument,
    clickedRange: vscode.Range
  ): vscode.CodeAction[] | undefined {
    if (!this.issuesList || !this.issuesList.has(document.uri)) {
      return;
    }
    const fileIssues = this.issuesList && this.issuesList.get(document.uri);
    const matchedIssue = findIssueWithRange(clickedRange, fileIssues);
    if (matchedIssue) {
      const ignoreIssueAction = this.createIgnoreIssueAction(
        document,
        matchedIssue
      );
      return [ignoreIssueAction];
    }
  }
}

// disposable provider
export class DisposableCodeActionsProvider implements vscode.Disposable {
  private disposableProvider: vscode.Disposable | undefined;
  constructor(deepcodeReview: vscode.DiagnosticCollection | undefined) {
    this.registerProvider(deepcodeReview);
  }

  private registerProvider(
    deepcodeReview: vscode.DiagnosticCollection | undefined
  ) {
    this.disposableProvider = vscode.languages.registerCodeActionsProvider(
      { scheme: "file", language: "*" },
      new DeepCodeIssuesActionProvider(deepcodeReview),
      {
        providedCodeActionKinds:
          DeepCodeIssuesActionProvider.providedCodeActionKinds
      }
    );
  }

  public dispose() {
    if (this.disposableProvider) {
      this.disposableProvider.dispose();
    }
  }
}
