/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable no-param-reassign */
/* eslint-disable @typescript-eslint/ban-types */
import { IAnalytics } from '../../common/analytics/itly';
import { OpenCommandIssueType, OpenIssueCommandArg } from '../../common/commands/types';
import { SNYK_IGNORE_ISSUE_COMMAND, SNYK_OPEN_ISSUE_COMMAND } from '../../common/constants/commands';
import { IDE_NAME } from '../../common/constants/general';
import { ICodeActionAdapter, ICodeActionKindAdapter } from '../../common/vscode/codeAction';
import {
  CodeAction,
  CodeActionKind,
  CodeActionProvider,
  Diagnostic,
  DiagnosticCollection,
  Range,
  TextDocument,
} from '../../common/vscode/types';
import { FILE_IGNORE_ACTION_NAME, IGNORE_ISSUE_ACTION_NAME, SHOW_ISSUE_ACTION_NAME } from '../constants/analysis';
import { ICodeSuggestion } from '../interfaces';
import { IssueUtils } from '../utils/issueUtils';
import { CodeIssueCommandArg } from '../views/interfaces';
import { CodeActionsCallbackFunctions } from './disposableCodeActionsProvider';

export class SnykIssuesActionProvider implements CodeActionProvider {
  private readonly providedCodeActionKinds = [this.codeActionKindProvider.getQuickFix()];

  private issuesList: DiagnosticCollection | undefined;
  private findSuggestion: (diagnostic: Diagnostic) => ICodeSuggestion | undefined;
  private trackIgnoreSuggestion: (vscodeSeverity: number, options: { [key: string]: any }) => void;

  constructor(
    issuesList: DiagnosticCollection | undefined,
    callbacks: CodeActionsCallbackFunctions,
    private readonly codeActionAdapter: ICodeActionAdapter,
    private readonly codeActionKindProvider: ICodeActionKindAdapter,
    private readonly analytics: IAnalytics,
  ) {
    this.issuesList = issuesList;
    this.findSuggestion = callbacks.findSuggestion;
    this.trackIgnoreSuggestion = callbacks.trackIgnoreSuggestion;
  }

  getProvidedCodeActionKinds(): CodeActionKind[] {
    return this.providedCodeActionKinds;
  }

  private createIgnoreIssueAction({
    document,
    matchedIssue,
    isFileIgnore,
  }: {
    document: TextDocument;
    matchedIssue: Diagnostic;
    isFileIgnore?: boolean;
  }): CodeAction {
    const ignoreIssueAction = this.codeActionAdapter.create(
      isFileIgnore ? FILE_IGNORE_ACTION_NAME : IGNORE_ISSUE_ACTION_NAME,
      this.providedCodeActionKinds[0],
    );

    const suggestion = this.findSuggestion(matchedIssue);
    if (suggestion)
      ignoreIssueAction.command = {
        command: SNYK_IGNORE_ISSUE_COMMAND,
        title: SNYK_IGNORE_ISSUE_COMMAND,
        arguments: [{ uri: document.uri, matchedIssue, issueId: suggestion.id, ruleId: suggestion.rule, isFileIgnore }],
      };

    return ignoreIssueAction;
  }

  private createShowIssueAction({
    document,
    matchedIssue,
  }: {
    document: TextDocument;
    matchedIssue: Diagnostic;
  }): CodeAction {
    const showIssueAction = this.codeActionAdapter.create(SHOW_ISSUE_ACTION_NAME, this.providedCodeActionKinds[0]);

    const suggestion = this.findSuggestion(matchedIssue);
    if (suggestion)
      showIssueAction.command = {
        command: SNYK_OPEN_ISSUE_COMMAND,
        title: SNYK_OPEN_ISSUE_COMMAND,
        arguments: [
          {
            issueType: OpenCommandIssueType.CodeIssue,
            issue: {
              message: matchedIssue.message,
              uri: document.uri,
              range: matchedIssue.range,
              diagnostic: matchedIssue,
            } as CodeIssueCommandArg,
          } as OpenIssueCommandArg,
        ],
      };

    return showIssueAction;
  }

  public provideCodeActions(document: TextDocument, clickedRange: Range): CodeAction[] | undefined {
    if (!this.issuesList || !this.issuesList.has(document.uri)) {
      return undefined;
    }
    const fileIssues = this.issuesList && this.issuesList.get(document.uri);
    const matchedIssue = IssueUtils.findIssueWithRange(clickedRange, fileIssues);
    if (matchedIssue) {
      const codeActionParams = { document, matchedIssue };
      const showIssueAction = this.createShowIssueAction(codeActionParams);
      const ignoreIssueAction = this.createIgnoreIssueAction(codeActionParams);
      const fileIgnoreIssueAction = this.createIgnoreIssueAction({
        ...codeActionParams,
        isFileIgnore: true,
      });

      this.analytics.logQuickFixIsDisplayed({
        quickFixType: ['Show Suggestion', 'Ignore Suggestion In Line', 'Ignore Suggestion In File'],
        ide: IDE_NAME,
      });

      // returns list of actions, all new actions should be added to this list
      return [showIssueAction, ignoreIssueAction, fileIgnoreIssueAction];
    }

    return undefined;
  }
}
