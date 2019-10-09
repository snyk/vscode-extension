import * as vscode from "vscode";
import { findIssueWithRange } from "../../utils/analysisUtils";
import {
  IGNORE_ISSUE_ACTION_NAME,
  IGNORE_ISSUE_COMMENT_TEXT
} from "../../constants/analysis";

export class IgnoreIssuesActionProvider implements vscode.CodeActionProvider {
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
      const fix = new vscode.CodeAction(
        IGNORE_ISSUE_ACTION_NAME,
        IgnoreIssuesActionProvider.providedCodeActionKinds[0]
      );
      fix.edit = new vscode.WorkspaceEdit();
      const symbolIndexToInsert = document.lineAt(matchedIssue.range.start.line)
        .firstNonWhitespaceCharacterIndex;
      const text = this.addSpacesToText(
        `${IGNORE_ISSUE_COMMENT_TEXT}\n`,
        symbolIndexToInsert
      );
      fix.edit.insert(
        document.uri,
        new vscode.Position(matchedIssue.range.start.line, symbolIndexToInsert),
        text
      );
      fix.command = { ...this.saveCommand };
      return [fix];
    }
  }
}
