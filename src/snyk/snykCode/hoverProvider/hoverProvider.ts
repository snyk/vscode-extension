import { IAnalytics } from '../../common/analytics/itly';
import { IDE_NAME } from '../../common/constants/general';
import { ILog } from '../../common/logger/interfaces';
import { IHoverAdapter } from '../../common/vscode/hover';
import { IVSCodeLanguages } from '../../common/vscode/languages';
import { IMarkdownStringAdapter } from '../../common/vscode/markdownString';
import { Diagnostic, DiagnosticCollection, Disposable, Hover, Position, TextDocument } from '../../common/vscode/types';
import { IGNORE_TIP_FOR_USER } from '../constants/analysis';
import { ISnykCodeAnalyzer } from '../interfaces';
import { IssueUtils } from '../utils/issueUtils';

export class DisposableHoverProvider implements Disposable {
  private hoverProvider: Disposable | undefined;

  constructor(
    private readonly analyzer: ISnykCodeAnalyzer,
    private readonly logger: ILog,
    private readonly vscodeLanguages: IVSCodeLanguages,
    private readonly analytics: IAnalytics,
    private readonly markdownStringAdapter: IMarkdownStringAdapter,
  ) {}

  register(snykReview: DiagnosticCollection | undefined, hoverAdapter: IHoverAdapter): Disposable {
    this.hoverProvider = this.vscodeLanguages.registerHoverProvider(
      { scheme: 'file', language: '*' },
      {
        provideHover: this.getHover(snykReview, hoverAdapter),
      },
    );
    return this;
  }

  getHover(snykReview: DiagnosticCollection | undefined, hoverAdapter: IHoverAdapter) {
    return (document: TextDocument, position: Position): Hover | undefined => {
      if (!snykReview || !snykReview.has(document.uri)) {
        return undefined;
      }
      const currentFileReviewIssues = snykReview.get(document.uri);
      const issue = IssueUtils.findIssueWithRange(position, currentFileReviewIssues);
      if (issue) {
        this.logIssueHoverIsDisplayed(issue);
        const ignoreMarkdown = this.markdownStringAdapter.get(IGNORE_TIP_FOR_USER);
        return hoverAdapter.create(ignoreMarkdown);
      }
    };
  }

  private logIssueHoverIsDisplayed(issue: Diagnostic): void {
    const suggestion = this.analyzer.findSuggestion(issue);
    if (!suggestion) {
      this.logger.debug('Failed to log hover displayed analytical event.');
      return;
    }

    this.analytics.logIssueHoverIsDisplayed({
      issueId: suggestion.id,
      issueType: IssueUtils.getIssueType(suggestion.isSecurityType),
      severity: IssueUtils.severityAsText(suggestion.severity),
      ide: IDE_NAME,
    });
  }

  dispose(): void {
    if (this.hoverProvider) {
      this.hoverProvider.dispose();
    }
  }
}
