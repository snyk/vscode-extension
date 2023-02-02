import { strictEqual } from 'assert';
import sinon from 'sinon';
import { IAnalytics } from '../../../../snyk/common/analytics/itly';
import { CodeIssueData, Issue } from '../../../../snyk/common/languageServer/types';
import { ICodeActionAdapter, ICodeActionKindAdapter } from '../../../../snyk/common/vscode/codeAction';
import { IVSCodeLanguages } from '../../../../snyk/common/vscode/languages';
import { CodeActionKind, Range, TextDocument } from '../../../../snyk/common/vscode/types';
import { SnykCodeActionsProvider } from '../../../../snyk/snykCode/codeActions/codeIssuesActionsProvider';
import { CodeWorkspaceFolderResult } from '../../../../snyk/snykCode/codeResult';
import { IssueUtils } from '../../../../snyk/snykCode/utils/issueUtils';

suite('Snyk Code actions provider', () => {
  let issuesActionsProvider: SnykCodeActionsProvider;
  let logQuickFixIsDisplayed: sinon.SinonSpy;

  setup(() => {
    const codeResults = new Map<string, CodeWorkspaceFolderResult>();
    codeResults.set('folderName', [
      {
        filePath: '//folderName//test.js',
      } as unknown as Issue<CodeIssueData>,
    ]);

    logQuickFixIsDisplayed = sinon.fake();
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

    const rangeMock = {
      contains: () => true,
    } as unknown as Range;

    sinon.stub(IssueUtils, 'createVsCodeRange').returns(rangeMock);

    issuesActionsProvider = new SnykCodeActionsProvider(
      codeResults,
      codeActionAdapter,
      codeActionKindAdapter,
      {} as IVSCodeLanguages,
      analytics,
    );
  });

  teardown(() => {
    sinon.restore();
  });

  test('Provides code actions', () => {
    // arrange
    const document = {
      uri: {
        fsPath: '//folderName//test.js',
      },
    } as unknown as TextDocument;

    // act
    const codeActions = issuesActionsProvider.provideCodeActions(document, {} as Range);

    // verify
    strictEqual(codeActions?.length, 1);
  });

  test("Logs 'Quick Fix is Displayed' analytical event", () => {
    // arrange
    const document = {
      uri: {
        fsPath: '//folderName//test.js',
      },
    } as unknown as TextDocument;

    // act
    const codeActions = issuesActionsProvider.provideCodeActions(document, {} as Range);

    // verify
    strictEqual(logQuickFixIsDisplayed.calledOnce, true);
  });
});
