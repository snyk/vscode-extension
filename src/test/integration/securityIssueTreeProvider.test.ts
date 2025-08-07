import sinon from 'sinon';
import * as vscode from 'vscode';

import { IVSCodeLanguages } from '../../snyk/common/vscode/languages';
import { CodeIssueData, Issue, LsErrorMessage, ScanProduct } from '../../snyk/common/languageServer/types';
import { IContextService } from '../../snyk/common/services/contextService';
import { IProductService, ProductResult } from '../../snyk/common/services/productService';
import { deepStrictEqual } from 'assert';
import { FEATURE_FLAGS } from '../../snyk/common/constants/featureFlags';
import { configuration } from '../../snyk/common/configuration/instance';
import { ISSUE_VIEW_OPTIONS_SETTING } from '../../snyk/common/constants/settings';
import { IFolderConfigs } from '../../snyk/common/configuration/folderConfigs';
import { LoggerMockFailOnErrors } from '../unit/mocks/logger.mock';
import CodeSecurityIssueTreeProvider from '../../snyk/snykCode/views/securityIssueTreeProvider';
import { IViewManagerService } from '../../snyk/common/services/viewManagerService';
import { makeMockCodeIssue } from '../unit/mocks/issue.mock';
import { DEFAULT_ISSUE_VIEW_OPTIONS, IssueViewOptions } from '../../snyk/common/configuration/configuration';
import { NODE_ICONS, TreeNode } from '../../snyk/common/views/treeNode';
import { SNYK_SHOW_LS_OUTPUT_COMMAND } from '../../snyk/common/constants/commands';

suite('Code Security Issue Tree Provider', () => {
  let viewManagerService: IViewManagerService;
  let contextService: IContextService;
  let codeService: IProductService<CodeIssueData>;
  let languages: IVSCodeLanguages;
  let folderConfigs: IFolderConfigs;

  async function setCCIAndIVOs(consistentIgnores: boolean, issueViewOptions?: IssueViewOptions) {
    configuration.setFeatureFlag(FEATURE_FLAGS.consistentIgnores, consistentIgnores);
    const options =
      issueViewOptions ||
      (consistentIgnores ? DEFAULT_ISSUE_VIEW_OPTIONS : { openIssues: false, ignoredIssues: false });
    await vscode.workspace.getConfiguration().update(ISSUE_VIEW_OPTIONS_SETTING, options);
  }

  function createIssueTreeProvider(resultData: ProductResult<CodeIssueData>): CodeSecurityIssueTreeProvider {
    return new CodeSecurityIssueTreeProvider(
      new LoggerMockFailOnErrors(),
      viewManagerService,
      contextService,
      {
        ...codeService,
        result: resultData,
      } as IProductService<CodeIssueData>,
      configuration,
      languages,
      folderConfigs,
    );
  }

  function verifyScanFailedErrorNode(
    errorNode: TreeNode,
    expectedDescription: string = 'Click here to see the problem.',
  ): void {
    deepStrictEqual(errorNode.label, 'Scan failed');
    deepStrictEqual(errorNode.description, expectedDescription);
    deepStrictEqual(errorNode.tooltip, expectedDescription);
    deepStrictEqual(errorNode.iconPath, undefined);
    deepStrictEqual(errorNode.internal.isError, true);
    deepStrictEqual(errorNode.command?.command, SNYK_SHOW_LS_OUTPUT_COMMAND);
  }

  function verifyFolderNodeWithError(folderNode: TreeNode, expectedFolderName: string): void {
    deepStrictEqual(folderNode.label, expectedFolderName);
    deepStrictEqual(folderNode.description, 'An error occurred');
    deepStrictEqual(folderNode.tooltip, 'An error occurred');
    deepStrictEqual(folderNode.iconPath, NODE_ICONS.error);
  }

  setup(() => {
    viewManagerService = {
      refreshCodeSecurityViewEmitter: sinon.stub(),
    } as unknown as IViewManagerService;
    contextService = {
      shouldShowCodeAnalysis: true,
    } as unknown as IContextService;
    codeService = {
      isLsDownloadSuccessful: true,
      isAnyWorkspaceFolderTrusted: true,
      isAnalysisRunning: false,
      isAnyResultAvailable: () => true,
      result: {
        values: () => [[]],
      },
      getSnykProductType: () => ScanProduct.Code,
    } as unknown as IProductService<CodeIssueData>;
    languages = {} as unknown as IVSCodeLanguages;
    folderConfigs = {
      getFolderConfig: () => undefined,
      getFolderConfigs: () => [],
      setFolderConfig: () => Promise.resolve(),
      setBranch: () => Promise.resolve(),
      setReferenceFolder: () => Promise.resolve(),
      resetFolderConfigsCache: () => {},
    } as IFolderConfigs;
  });

  teardown(() => {
    sinon.restore();
  });

  const testCases: ({
    name: string;
  } & (
    | {
        consistentIgnores: false;
      }
    | {
        consistentIgnores: true;
        issueViewOptions: IssueViewOptions;
      }
  ) & {
      issues: Issue<CodeIssueData>[];
      expectedNodeLabels: string[];
    })[] = [
    {
      name: 'getRootChildren returns correctly for no issues found with CCI disabled',
      consistentIgnores: false,
      issues: [],
      expectedNodeLabels: ['✅ Congrats! No issues found!'],
    },
    {
      name: 'getRootChildren returns correctly when viewing open & ignored and no issues found with CCI enabled',
      consistentIgnores: true,
      issueViewOptions: { openIssues: true, ignoredIssues: true },
      issues: [],
      expectedNodeLabels: ['✅ Congrats! No issues found!'],
    },
    {
      name: 'getRootChildren returns correctly for one non-fixable issue with CCI diabled',
      consistentIgnores: false,
      issues: [makeMockCodeIssue()],
      expectedNodeLabels: ['✋ 1 issue', 'There are no issues fixable by Snyk Agent Fix.'],
    },
    {
      name: 'getRootChildren returns correctly when viewing open & ignored and have two open issues one fixable with CCI enabled',
      consistentIgnores: true,
      issueViewOptions: { openIssues: true, ignoredIssues: true },
      issues: [makeMockCodeIssue(), makeMockCodeIssue({ additionalData: { hasAIFix: true } })],
      expectedNodeLabels: ['✋ 2 open issues & 0 ignored issues', '⚡️ 1 open issue is fixable by Snyk Agent Fix.'],
    },
    {
      name: 'getRootChildren returns correctly when viewing only open and have none with CCI enabled',
      consistentIgnores: true,
      issueViewOptions: { openIssues: true, ignoredIssues: false },
      issues: [],
      expectedNodeLabels: ['✅ Congrats! No open issues found!', 'Adjust your settings to view Ignored issues.'],
    },
    {
      name: 'getRootChildren returns correctly when viewing only open and have one non-fixable with CCI enabled',
      consistentIgnores: true,
      issueViewOptions: { openIssues: true, ignoredIssues: false },
      issues: [makeMockCodeIssue()],
      expectedNodeLabels: ['✋ 1 open issue', 'There are no issues fixable by Snyk Agent Fix.'],
    },
    {
      name: 'getRootChildren returns correctly when viewing only ignored and have none with CCI enabled',
      consistentIgnores: true,
      issueViewOptions: { openIssues: false, ignoredIssues: true },
      issues: [],
      expectedNodeLabels: [
        '✋ No ignored issues, open issues are disabled',
        'Adjust your settings to view Open issues.',
      ],
    },
    {
      name: 'getRootChildren returns correctly when viewing only ignored and have one with CCI enabled',
      consistentIgnores: true,
      issueViewOptions: { openIssues: false, ignoredIssues: true },
      issues: [makeMockCodeIssue({ isIgnored: true })],
      expectedNodeLabels: ['✋ 1 ignored issue, open issues are disabled'],
    },
    {
      name: 'getRootChildren returns correctly when viewing nothing with CCI enabled',
      consistentIgnores: true,
      issueViewOptions: { openIssues: false, ignoredIssues: false },
      issues: [],
      expectedNodeLabels: [
        'Open and Ignored issues are disabled!',
        'Adjust your settings to view Open or Ignored issues.',
      ],
    },
  ];

  for (const testCase of testCases) {
    test(testCase.name, async () => {
      try {
        // Setup
        await setCCIAndIVOs(
          testCase.consistentIgnores,
          testCase.consistentIgnores ? testCase.issueViewOptions : undefined,
        );
        const issueTreeProvider = createIssueTreeProvider(new Map([['fake-dir', testCase.issues]]));
        sinon.stub(issueTreeProvider, 'getResultNodes').returns([]); // Not checking the issue nodes are created properly.

        // Act
        const rootChildren = issueTreeProvider.getRootChildren();

        // Verify
        deepStrictEqual(
          rootChildren.map(node => node.label),
          testCase.expectedNodeLabels,
        );
      } finally {
        await setCCIAndIVOs(true, DEFAULT_ISSUE_VIEW_OPTIONS);
      }
    });
  }

  test('getRootChildren returns correctly for single folder workspace scan error', async () => {
    try {
      // Setup
      const repositoryInvalidError = new Error(LsErrorMessage.repositoryInvalidError);
      await setCCIAndIVOs(false);
      const issueTreeProvider = createIssueTreeProvider(new Map([['fake-dir', repositoryInvalidError]]));

      // Act
      const rootChildren = issueTreeProvider.getRootChildren();

      // Verify
      // ⚠️ fake-dir  An error occurred
      //    Scan failed  Error: repository does not exist
      deepStrictEqual(rootChildren.length, 2);
      verifyFolderNodeWithError(rootChildren[0], 'fake-dir');
      verifyScanFailedErrorNode(rootChildren[1], repositoryInvalidError.toString());
    } finally {
      await setCCIAndIVOs(true, DEFAULT_ISSUE_VIEW_OPTIONS);
    }
  });

  test('getRootChildren returns correctly for multi folder workspace scan errors', async () => {
    try {
      // Setup
      await setCCIAndIVOs(false);
      const folderNames = ['dir-one', 'dir-two'];
      const issueTreeProvider = createIssueTreeProvider(
        new Map(folderNames.map(name => [name, new Error('Some scan error')])),
      );

      // Act
      const rootChildren = issueTreeProvider.getRootChildren();

      // Verify
      // V ⚠️ dir-one  An error occurred
      // |    Scan failed  Click here to see the problem.
      // V ⚠️ dir-two  An error occurred
      // |    Scan failed  Click here to see the problem.
      deepStrictEqual(rootChildren.length, 2);
      for (let i = 0; i < folderNames.length; i++) {
        const folderNode = rootChildren[i];
        verifyFolderNodeWithError(folderNode, folderNames[i]);
        const folderChildren = folderNode.getChildren();
        deepStrictEqual(folderChildren.length, 1);
        verifyScanFailedErrorNode(folderChildren[0]);
      }
    } finally {
      await setCCIAndIVOs(true, DEFAULT_ISSUE_VIEW_OPTIONS);
    }
  });
});
