import { strictEqual } from 'assert';
import sinon from 'sinon';
import { IAnalytics } from '../../../../snyk/common/analytics/itly';
import { SNYK_OPEN_ISSUE_COMMAND } from '../../../../snyk/common/constants/commands';
import { IacIssueData, Issue } from '../../../../snyk/common/languageServer/types';
import { WorkspaceFolderResult } from '../../../../snyk/common/services/productService';
import { ICodeActionAdapter, ICodeActionKindAdapter } from '../../../../snyk/common/vscode/codeAction';
import { IVSCodeLanguages } from '../../../../snyk/common/vscode/languages';
import { CodeActionKind, Range, TextDocument } from '../../../../snyk/common/vscode/types';
import { IacCodeActionsProvider } from '../../../../snyk/snykIac/codeActions/iacCodeActionsProvider';
import { IacIssue } from '../../../../snyk/snykIac/issue';

suite('IaC code actions provider', () => {
  let issuesActionsProvider: IacCodeActionsProvider;
  let logQuickFixIsDisplayed: sinon.SinonSpy;

  setup(() => {
    const codeResults = new Map<string, WorkspaceFolderResult<IacIssueData>>();
    codeResults.set('folderName', [
      {
        filePath: '//folderName//test.js',
        additionalData: {},
      } as unknown as Issue<IacIssueData>,
    ]);

    logQuickFixIsDisplayed = sinon.fake();
    const analytics = {
      logQuickFixIsDisplayed,
    } as unknown as IAnalytics;

    const codeActionAdapter = {
      create: (_: string, _kind?: CodeActionKind) => ({
        command: {},
      }),
    } as ICodeActionAdapter;

    const codeActionKindAdapter = {
      getQuickFix: sinon.fake(),
    } as ICodeActionKindAdapter;

    const rangeMock = {
      contains: () => true,
    } as unknown as Range;

    sinon.stub(IacIssue, 'getRange').returns(rangeMock);

    issuesActionsProvider = new IacCodeActionsProvider(
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
    strictEqual(codeActions[0].command?.command, SNYK_OPEN_ISSUE_COMMAND);
  });

  test("Logs 'Quick Fix is Displayed' analytical event", () => {
    // arrange
    const document = {
      uri: {
        fsPath: '//folderName//test.js',
      },
    } as unknown as TextDocument;

    // act
    issuesActionsProvider.provideCodeActions(document, {} as Range);

    // verify
    strictEqual(logQuickFixIsDisplayed.calledOnce, true);
  });
});
