import * as vscode from 'vscode';
import { analytics } from '../../common/analytics/analytics';
import { IDE_NAME } from '../../common/constants/general';
import { ILog } from '../../common/logger/interfaces';
import { IGNORE_TIP_FOR_USER } from '../constants/analysis';
import { ISnykCodeAnalyzer } from '../interfaces';
import { findIssueWithRange, severityAsText } from '../utils/analysisUtils';

export class DisposableHoverProvider implements vscode.Disposable {
  private hoverProvider: vscode.Disposable | undefined;

  constructor(
    private readonly analyzer: ISnykCodeAnalyzer,
    snykReview: vscode.DiagnosticCollection | undefined,
    private readonly logger: ILog,
  ) {
    this.registerDisposableProvider(snykReview);
  }

  private registerDisposableProvider(snykReview: vscode.DiagnosticCollection | undefined) {
    this.hoverProvider = vscode.languages.registerHoverProvider(
      { scheme: 'file', language: '*' },
      {
        provideHover: (document, position) => {
          if (!snykReview || !snykReview.has(document.uri)) {
            return undefined;
          }

          const currentFileReviewIssues = snykReview.get(document.uri);
          const issue = findIssueWithRange(position, currentFileReviewIssues);
          if (issue) {
            this.logIssueHoverIsDisplayed(issue);
            return new vscode.Hover(IGNORE_TIP_FOR_USER);
          }
        },
      },
    );
  }

  private logIssueHoverIsDisplayed(issue: vscode.Diagnostic): void {
    const suggestion = this.analyzer.findSuggestion(issue.message);
    if (!suggestion) {
      this.logger.debug('Failed to log hover displayed analytical event.');
      return;
    }

    analytics.logIssueHoverIsDisplayed({
      issueId: suggestion.id,
      issueType: suggestion.isSecurityType ? 'Code Security Vulnerability' : 'Code Quality Issue',
      severity: severityAsText(suggestion.severity),
      ide: IDE_NAME,
    });
  }

  dispose(): void {
    if (this.hoverProvider) {
      this.hoverProvider.dispose();
    }
  }
}
