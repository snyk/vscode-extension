import { strictEqual } from 'assert';
import sinon from 'sinon';
import { IAnalytics } from '../../../../snyk/common/analytics/itly';
import { ICodeActionAdapter, ICodeActionKindAdapter } from '../../../../snyk/common/vscode/codeAction';
import {
  CodeActionKind,
  Diagnostic,
  DiagnosticCollection,
  Range,
  TextDocument,
  Uri,
} from '../../../../snyk/common/vscode/types';
import { SnykIssuesActionProvider } from '../../../../snyk/snykCode/codeActions/issuesActionsProvider';
import { IssueUtils } from '../../../../snyk/snykCode/utils/issueUtils';

suite('Snyk Code actions provider', () => {
  let issuesActionsProvider: SnykIssuesActionProvider;
  const logQuickFixIsDisplayed = sinon.fake();

  setup(() => {
    const snykReview = {
      has: (_: Uri): boolean => true,
      get: sinon.fake(),
    } as unknown as DiagnosticCollection;

    const analytics = {
      logQuickFixIsDisplayed,
    } as unknown as IAnalytics;

    const fakeCodeAction = {
      command: {},
    };

    const codeActionAdapter = {
      create: (_: string, _kind?: CodeActionKind) => fakeCodeAction,
    } as ICodeActionAdapter;
    const codeActionKindAdapter = {
      getQuickFix: sinon.fake(),
    } as ICodeActionKindAdapter;

    const callbacks = {
      findSuggestion: () => true,
    };

    issuesActionsProvider = new SnykIssuesActionProvider(
      snykReview,
      callbacks,
      codeActionAdapter,
      codeActionKindAdapter,
      analytics,
    );
  });

  teardown(() => {
    sinon.restore();
  });

  test("Logs 'Quick Fix is Displayed' analytical event", () => {
    // prepare objects
    sinon.stub(IssueUtils, 'findIssueWithRange').returns({} as Diagnostic);
    const document = {
      uri: 'test.js',
    } as unknown as TextDocument;

    // act
    issuesActionsProvider.provideCodeActions(document, {} as Range);

    // verify
    strictEqual(logQuickFixIsDisplayed.calledOnce, true);
  });
});
