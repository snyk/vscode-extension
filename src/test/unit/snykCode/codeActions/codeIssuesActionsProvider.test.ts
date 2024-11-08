import { strictEqual } from 'assert';
import sinon from 'sinon';
import { SNYK_IGNORE_ISSUE_COMMAND, SNYK_OPEN_ISSUE_COMMAND } from '../../../../snyk/common/constants/commands';
import { CodeIssueData, Issue } from '../../../../snyk/common/languageServer/types';
import { WorkspaceFolderResult } from '../../../../snyk/common/services/productService';
import { ICodeActionAdapter, ICodeActionKindAdapter } from '../../../../snyk/common/vscode/codeAction';
import { IVSCodeLanguages } from '../../../../snyk/common/vscode/languages';
import { CodeActionContext, CodeActionKind, Range, TextDocument } from '../../../../snyk/common/vscode/types';
import { SnykCodeActionsProvider } from '../../../../snyk/snykCode/codeActions/codeIssuesActionsProvider';
import { IssueUtils } from '../../../../snyk/snykCode/utils/issueUtils';
import { IConfiguration } from '../../../../snyk/common/configuration/configuration';

suite('Snyk Code actions provider', () => {
  let issuesActionsProvider: SnykCodeActionsProvider;
  let configuration: IConfiguration;
  let codeResults: Map<string, WorkspaceFolderResult<CodeIssueData>>;
  let codeActionAdapter: ICodeActionAdapter;
  let codeActionKindAdapter: ICodeActionKindAdapter;

  setup(() => {
    codeResults = new Map<string, WorkspaceFolderResult<CodeIssueData>>();
    codeResults.set('folderName', [
      {
        filePath: '//folderName//test.js',
        additionalData: {
          rule: 'some-rule',
        },
      } as unknown as Issue<CodeIssueData>,
    ]);

    codeActionAdapter = {
      create: (_: string, _kind?: CodeActionKind) => ({
        command: {},
      }),
    } as ICodeActionAdapter;

    codeActionKindAdapter = {
      getQuickFix: sinon.fake(),
    } as ICodeActionKindAdapter;

    const rangeMock = {
      contains: () => true,
    } as unknown as Range;

    sinon.stub(IssueUtils, 'createVsCodeRange').returns(rangeMock);

    configuration = {
      getFeatureFlag(_: string): boolean {
        return true;
      },
    } as IConfiguration;

    issuesActionsProvider = new SnykCodeActionsProvider(
      codeResults,
      codeActionAdapter,
      codeActionKindAdapter,
      {} as IVSCodeLanguages,
      configuration,
    );
  });

  teardown(() => {
    sinon.restore();
  });

  test('Provides code actions, inline ignores disabled', () => {
    // arrange
    const document = {
      uri: {
        fsPath: '//folderName//test.js',
      },
    } as unknown as TextDocument;

    issuesActionsProvider = new SnykCodeActionsProvider(
      codeResults,
      codeActionAdapter,
      codeActionKindAdapter,
      {} as IVSCodeLanguages,
      {
        getFeatureFlag(_: string): boolean {
          return false;
        },
      } as IConfiguration,
    );

    // act
    const codeActions = issuesActionsProvider.provideCodeActions(document, {} as Range, {} as CodeActionContext);

    // verify
    strictEqual(codeActions?.length, 1);
    strictEqual(codeActions[0].command?.command, SNYK_OPEN_ISSUE_COMMAND);
  });

  test('Provides code actions, inline ignores enabled', () => {
    // arrange
    const document = {
      uri: {
        fsPath: '//folderName//test.js',
      },
    } as unknown as TextDocument;

    // act
    const codeActions = issuesActionsProvider.provideCodeActions(document, {} as Range, {} as CodeActionContext);

    // verify
    strictEqual(codeActions?.length, 3);
    strictEqual(codeActions[0].command?.command, SNYK_OPEN_ISSUE_COMMAND);
    strictEqual(codeActions[1].command?.command, SNYK_IGNORE_ISSUE_COMMAND);
    strictEqual(codeActions[2].command?.command, SNYK_IGNORE_ISSUE_COMMAND);
  });
});
