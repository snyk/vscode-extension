import { ILog } from '../../common/logger/interfaces';
import { IHoverAdapter } from '../../common/vscode/hover';
import { IVSCodeLanguages } from '../../common/vscode/languages';
import { IMarkdownStringAdapter } from '../../common/vscode/markdownString';
import { DiagnosticCollection, Disposable, Hover, Position, TextDocument } from '../../common/vscode/types';
import { IGNORE_TIP_FOR_USER } from '../constants/analysis';
import { ISnykCodeAnalyzer } from '../interfaces';
import { IssueUtils } from '../utils/issueUtils';

export class DisposableHoverProvider implements Disposable {
  private hoverProvider: Disposable | undefined;

  constructor(
    private readonly analyzer: ISnykCodeAnalyzer,
    private readonly logger: ILog,
    private readonly vscodeLanguages: IVSCodeLanguages,
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
        const ignoreMarkdown = this.markdownStringAdapter.get(IGNORE_TIP_FOR_USER);
        return hoverAdapter.create(ignoreMarkdown);
      }
    };
  }

  dispose(): void {
    if (this.hoverProvider) {
      this.hoverProvider.dispose();
    }
  }
}
