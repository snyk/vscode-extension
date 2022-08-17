import { strictEqual } from 'assert';
import sinon from 'sinon';
import { IAnalytics } from '../../../../snyk/common/analytics/itly';
import { IHoverAdapter } from '../../../../snyk/common/vscode/hover';
import { IVSCodeLanguages } from '../../../../snyk/common/vscode/languages';
import { IMarkdownStringAdapter } from '../../../../snyk/common/vscode/markdownString';
import { Diagnostic, DiagnosticCollection, Position, TextDocument, Uri } from '../../../../snyk/common/vscode/types';
import { DisposableHoverProvider } from '../../../../snyk/snykCode/hoverProvider/hoverProvider';
import { ISnykCodeAnalyzer } from '../../../../snyk/snykCode/interfaces';
import { IssueUtils } from '../../../../snyk/snykCode/utils/issueUtils';
import { LoggerMock } from '../../mocks/logger.mock';

suite('Snyk Code hover provider', () => {
  let provider: DisposableHoverProvider;
  const logIssueHoverIsDisplayed = sinon.fake();

  setup(() => {
    const analyzer = {
      findSuggestion: (_: string) => true,
    } as unknown as ISnykCodeAnalyzer;
    const vscodeLanguagesMock = sinon.fake() as unknown as IVSCodeLanguages;

    const analytics = {
      logIssueHoverIsDisplayed,
    } as unknown as IAnalytics;

    provider = new DisposableHoverProvider(analyzer, new LoggerMock(), vscodeLanguagesMock, analytics, {
      get: sinon.fake(),
    } as IMarkdownStringAdapter);
  });

  teardown(() => {
    sinon.restore();
  });

  test("Logs 'Issue Hover is Displayed' analytical event", () => {
    // prepare objects
    const snykReview = {
      has: (_: Uri): boolean => true,
      get: sinon.fake(),
    } as unknown as DiagnosticCollection;

    sinon.stub(IssueUtils, 'findIssueWithRange').returns({} as Diagnostic);

    const hoverProvider = provider.getHover(snykReview, {
      create: sinon.fake() as unknown,
    } as IHoverAdapter);

    const document = {
      uri: 'test.js',
    } as unknown as TextDocument;

    // act
    hoverProvider(document, {} as Position);

    // verify
    strictEqual(logIssueHoverIsDisplayed.calledOnce, true);
  });
});
