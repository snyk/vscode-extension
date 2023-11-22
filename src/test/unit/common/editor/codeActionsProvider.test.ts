import { strictEqual } from 'assert';
import sinon from 'sinon';
import { IAnalytics, SupportedQuickFixProperties } from '../../../../snyk/common/analytics/itly';
import { SNYK_OPEN_ISSUE_COMMAND, SNYK_OPEN_LOCAL_COMMAND } from '../../../../snyk/common/constants/commands';
import { CodeActionsProvider } from '../../../../snyk/common/editor/codeActionsProvider';
import { Issue } from '../../../../snyk/common/languageServer/types';
import { WorkspaceFolderResult } from '../../../../snyk/common/services/productService';
import { ICodeActionKindAdapter } from '../../../../snyk/common/vscode/codeAction';
import { CodeAction, CodeActionContext, Range, TextDocument } from '../../../../snyk/common/vscode/types';

type ProductData = {
  issueType: string;
};

class MockProductService extends CodeActionsProvider<ProductData> {
  getActions(
    _folderPath: string,
    _document: TextDocument,
    _issue: Issue<ProductData>,
    _issueRange: Range,
  ): CodeAction[] {
    return [
      {
        command: {
          title: 'Open Issue',
          command: SNYK_OPEN_ISSUE_COMMAND,
        },
      } as unknown as CodeAction,
      {
        command: {
          title: 'Open File',
          command: SNYK_OPEN_LOCAL_COMMAND,
        },
      } as unknown as CodeAction,
    ];
  }
  getAnalyticsActionTypes(): [string, ...string[]] & [SupportedQuickFixProperties, ...SupportedQuickFixProperties[]] {
    return ['Show Suggestion'];
  }
  getIssueRange(_: Issue<ProductData>): Range {
    return {
      contains: () => true,
    } as unknown as Range;
  }
}

suite('Code Actions Provider', () => {
  let issuesActionsProvider: CodeActionsProvider<ProductData>;
  let logQuickFixIsDisplayed: sinon.SinonSpy;

  setup(() => {
    const codeResults = new Map<string, WorkspaceFolderResult<ProductData>>();
    codeResults.set('folderName', [
      {
        filePath: '//folderName//test.js',
        additionalData: {
          rule: 'some-rule',
        },
      } as unknown as Issue<ProductData>,
    ]);

    logQuickFixIsDisplayed = sinon.fake();
    const analytics = {
      logQuickFixIsDisplayed,
    } as unknown as IAnalytics;

    const codeActionKindAdapter = {
      getQuickFix: sinon.fake(),
    } as ICodeActionKindAdapter;

    issuesActionsProvider = new MockProductService(codeResults, codeActionKindAdapter, analytics);
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
    const codeActions = issuesActionsProvider.provideCodeActions(document, {} as Range, {} as CodeActionContext);

    // verify
    strictEqual(codeActions?.length, 2);
    strictEqual(codeActions[0].command?.command, SNYK_OPEN_ISSUE_COMMAND);
    strictEqual(codeActions[1].command?.command, SNYK_OPEN_LOCAL_COMMAND);
  });

  test("Logs 'Quick Fix is Displayed' analytical event", () => {
    // arrange
    const document = {
      uri: {
        fsPath: '//folderName//test.js',
      },
    } as unknown as TextDocument;

    // act
    issuesActionsProvider.provideCodeActions(document, {} as Range, {} as CodeActionContext);

    // verify
    strictEqual(logQuickFixIsDisplayed.calledOnce, true);
  });
});
