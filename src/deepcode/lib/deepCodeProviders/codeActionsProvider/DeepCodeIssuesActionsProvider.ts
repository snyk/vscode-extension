import * as vscode from "vscode";
import {
  findIssueWithRange,
  ignoreIssueCommentText,
  extractIssueNameOutOfId
} from "../../../utils/analysisUtils";
import {
  IGNORE_ISSUE_ACTION_NAME,
  FILE_IGNORE_ACTION_NAME,
  IGNORE_ISSUE_BASE_COMMENT_TEXT,
  FILE_IGNORE_ISSUE_BASE_COMMENT_TEXT,
} from "../../../constants/analysis";
import {
  DEEPCODE_IGNORE_ISSUE_COMMAND,
  VSCODE_ADD_COMMENT_COMMAND
} from "../../../constants/commands";

export class DeepCodeIssuesActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix
  ];

  private issuesList: vscode.DiagnosticCollection | undefined;
  private findSuggestionId: Function;
  private trackIgnoreSuggestion: Function;

  constructor(
    issuesList: vscode.DiagnosticCollection | undefined,
    callbacks: { [key: string]: Function }
  ) {
    this.issuesList = issuesList;
    this.registerIgnoreIssuesCommand();
    this.findSuggestionId = callbacks.findSuggestionId;
    this.trackIgnoreSuggestion = callbacks.trackIgnoreSuggestion;
  }

  private registerIgnoreIssuesCommand() {
    vscode.commands.registerCommand(
      DEEPCODE_IGNORE_ISSUE_COMMAND,
      async ({
        uri,
        matchedIssue,
        issueId,
        isFileIgnore,
      }: {
        uri?: vscode.Uri;
        matchedIssue: {
          severity: number;
          message: string;
          range: vscode.Range
        };
        issueId: string;
        isFileIgnore?: boolean;
      }): Promise<void> => {
        console.error(DEEPCODE_IGNORE_ISSUE_COMMAND);
        this.trackIgnoreSuggestion(matchedIssue.severity, {
          message: matchedIssue.message,
          data: {
            issueId,
            isFileIgnore: !!isFileIgnore,
          }
        });
        console.error("0");
        const issueNameForComment: string = extractIssueNameOutOfId(issueId);
        console.error("1",issueNameForComment);
        const issueText: string = ignoreIssueCommentText(
          issueNameForComment,
          isFileIgnore
        );
        console.error("2",issueText);
        const editor: vscode.TextEditor | undefined =
          (uri && await vscode.window.showTextDocument(uri, {
            viewColumn: vscode.ViewColumn.One,
            selection: matchedIssue.range,
          })) || vscode.window.activeTextEditor; 
        console.error("3",!editor,!issueText,!matchedIssue);
        if (!editor || !issueText || !matchedIssue) {
          return;
        }
        const symbolIndexToInsert = editor.document.lineAt(
          matchedIssue.range.start.line
        ).firstNonWhitespaceCharacterIndex;
        let issuePosition = new vscode.Position(
          matchedIssue.range.start.line,
          symbolIndexToInsert
        );

        let deepCodeCommentPostition: vscode.Position | undefined;
        if (issuePosition.line > 0) {
          // const prevLinePosition = new vscode.Position(
          //   issuePosition.line - 1,
          //   issuePosition.character
          // );

          // console.error("4",issuePosition,prevLinePosition);
          // const {
          //   text: prevLineText,
          //   range: prevLineTextRange
          // }: {
          //   text: string;
          //   range: vscode.Range;
          // } = editor.document.lineAt(prevLinePosition);
          // const deepCodeCommentAlreadyExists = prevLineText.includes(
          //   IGNORE_ISSUE_BASE_COMMENT_TEXT
          // );
          const prevLineRange = new vscode.Range(
            new vscode.Position(issuePosition.line - 1, 0),
            new vscode.Position(issuePosition.line, 0),
          );
          const prevLine = editor.document.getText(prevLineRange).split("\n").shift() || "";
          // We have 3 cases:
          // 1) prevLine doesn't include any dcignore line
          // 2) prevLine is a dcignore comment
          // 3) prevLine is a file dcignore comment
          if (prevLine.includes(IGNORE_ISSUE_BASE_COMMENT_TEXT)) {
            if (prevLine.includes(FILE_IGNORE_ISSUE_BASE_COMMENT_TEXT)) {
              // case number 3
              if (isFileIgnore) deepCodeCommentPostition = new vscode.Position(
                prevLineRange.start.line,
                prevLine.length
              );
              // if !isFileIgnore we want to write a new comment instead of adding to the previous one
            } else {
              // case number 2
              if (!isFileIgnore) {
                deepCodeCommentPostition = new vscode.Position(
                  prevLineRange.start.line,
                  prevLine.length
                );
              } else {
                // we want to write a new comment 2 lines above the issue
                issuePosition = issuePosition.with(issuePosition.line - 1);
              } 
            }
          }
        }
        console.error("5",deepCodeCommentPostition);
        if (deepCodeCommentPostition) {
          const position = deepCodeCommentPostition;
          // if deepcode ignore of issue already exists, paste next comment in same line after existing comment
          editor.edit((e: vscode.TextEditorEdit) =>
            e.insert(
              position,
              `, ${issueText}`
            )
          );
        } else {
          editor.edit((e: vscode.TextEditorEdit) =>
            e.insert(
              issuePosition,
              this.addSpacesToText(`${issueText}\n`, symbolIndexToInsert)
            )
          );
        }
        editor.selections = [
          new vscode.Selection(issuePosition, issuePosition)
        ];
        if (!deepCodeCommentPostition) {
          await vscode.commands.executeCommand(VSCODE_ADD_COMMENT_COMMAND);
        }
        await editor.document.save();
      }
    );
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

  private createIgnoreIssueAction({
    document,
    matchedIssue,
    isFileIgnore
  }: {
    document: vscode.TextDocument;
    matchedIssue: vscode.Diagnostic;
    isFileIgnore?: boolean;
  }): vscode.CodeAction {
    const ignoreIssueAction = new vscode.CodeAction(
      isFileIgnore ? FILE_IGNORE_ACTION_NAME : IGNORE_ISSUE_ACTION_NAME,
      DeepCodeIssuesActionProvider.providedCodeActionKinds[0]
    );

    const issueFullId: string = this.findSuggestionId(
      matchedIssue.message,
      document.uri.fsPath
    );
    ignoreIssueAction.command = {
      command: DEEPCODE_IGNORE_ISSUE_COMMAND,
      title: DEEPCODE_IGNORE_ISSUE_COMMAND,
      arguments: [{ uri: document.uri, matchedIssue, issueId: issueFullId, isFileIgnore }]
    };

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
      const codeActionParams = { document, matchedIssue };
      const ignoreIssueAction = this.createIgnoreIssueAction(codeActionParams);
      const fileIgnoreIssueAction = this.createIgnoreIssueAction({
        ...codeActionParams,
        isFileIgnore: true
      });
      // returns list of actions, all new actions should be added to this list
      return [ignoreIssueAction, fileIgnoreIssueAction];
    }
  }
}

// disposable provider
export class DisposableCodeActionsProvider implements vscode.Disposable {
  private disposableProvider: vscode.Disposable | undefined;
  constructor(
    deepcodeReview: vscode.DiagnosticCollection | undefined,
    callbacks: { [key: string]: Function }
  ) {
    this.registerProvider(deepcodeReview, callbacks);
  }

  private registerProvider(
    deepcodeReview: vscode.DiagnosticCollection | undefined,
    callbacks: { [key: string]: Function }
  ) {
    this.disposableProvider = vscode.languages.registerCodeActionsProvider(
      { scheme: "file", language: "*" },
      new DeepCodeIssuesActionProvider(deepcodeReview, callbacks),
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
