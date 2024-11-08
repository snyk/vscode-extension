import assert from 'assert';
import sinon from 'sinon';
import { CodeAction, CodeActionContext, CodeActionKind, Range, TextDocument } from 'vscode';
import { OpenCommandIssueType, OpenIssueCommandArg } from '../../../../snyk/common/commands/types';
import { SNYK_OPEN_ISSUE_COMMAND } from '../../../../snyk/common/constants/commands';
import { Issue, IssueSeverity, OssIssueData } from '../../../../snyk/common/languageServer/types';
import { WorkspaceFolderResult } from '../../../../snyk/common/services/productService';
import { ICodeActionAdapter, ICodeActionKindAdapter } from '../../../../snyk/common/vscode/codeAction';
import { IVSCodeLanguages } from '../../../../snyk/common/vscode/languages';
import { OssCodeActionsProvider } from '../../../../snyk/snykOss/providers/ossCodeActionsProvider';

suite('OSS code actions provider', () => {
  let ossActionsProvider: OssCodeActionsProvider;
  let rangeMock: Range;

  setup(() => {
    const ossResults = new Map<string, WorkspaceFolderResult<OssIssueData>>();
    ossResults.set('folderName', [
      {
        filePath: '//folderName//package.json',
        additionalData: {},
      } as unknown as Issue<OssIssueData>,
    ]);

    const codeActionAdapter = {
      create: (_: string, _kind?: CodeActionKind) => ({
        command: {},
      }),
    } as ICodeActionAdapter;

    const codeActionKindAdapter = {
      getQuickFix: sinon.fake(),
    } as ICodeActionKindAdapter;

    rangeMock = {
      contains: () => true,
    } as unknown as Range;

    ossActionsProvider = new OssCodeActionsProvider(
      {} as IVSCodeLanguages,
      codeActionAdapter,
      codeActionKindAdapter,
      ossResults,
    );
  });

  teardown(() => {
    sinon.restore();
  });

  test('Provides the most severe vulnerability CodeAction', () => {
    // arrange
    const document = {
      uri: {
        fsPath: '//folderName//package.json',
      },
    } as unknown as TextDocument;

    const clickedRange = {} as Range;
    const context = {} as CodeActionContext;

    const vulnerabilities = [
      {
        id: 'vulnerability1',
        severity: IssueSeverity.High,
      },
      {
        id: 'vulnerability2',
        severity: IssueSeverity.Medium,
      },
      {
        id: 'vulnerability3',
        severity: IssueSeverity.Critical,
      },
    ] as Issue<OssIssueData>[];

    const mostSevereVulnerability = {
      id: 'vulnerability3',
      severity: IssueSeverity.Critical,
    } as Issue<OssIssueData>;

    const codeActions = [
      {
        command: {
          command: SNYK_OPEN_ISSUE_COMMAND,
          title: SNYK_OPEN_ISSUE_COMMAND,
          arguments: [
            {
              issueType: OpenCommandIssueType.OssVulnerability,
              issue: mostSevereVulnerability,
            } as OpenIssueCommandArg,
          ],
        },
      },
    ] as CodeAction[];

    sinon.stub(ossActionsProvider, 'getIssueRange').returns(rangeMock);
    // stubbing private methods workaround is to cast to any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sinon.stub(ossActionsProvider, <any>'getVulnerabilities').returns(vulnerabilities);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sinon.stub(ossActionsProvider, <any>'getMostSevereVulnerability').returns(mostSevereVulnerability);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sinon.stub(ossActionsProvider, <any>'getActions').returns(codeActions);

    // act
    const result = ossActionsProvider.provideCodeActions(document, clickedRange, context);

    // assert
    assert.deepStrictEqual(result, codeActions);
  });
});
