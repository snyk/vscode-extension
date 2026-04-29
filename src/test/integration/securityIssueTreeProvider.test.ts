import sinon from 'sinon';
import * as vscode from 'vscode';

import { IVSCodeLanguages } from '../../snyk/common/vscode/languages';
import { CodeIssueData, Issue, PresentableError, ScanProduct } from '../../snyk/common/languageServer/types';
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
import {
  DEFAULT_ISSUE_VIEW_OPTIONS,
  FolderConfig,
  IssueViewOptions,
} from '../../snyk/common/configuration/configuration';
import { NODE_ICONS, TreeNode } from '../../snyk/common/views/treeNode';
import { SNYK_SHOW_LS_OUTPUT_COMMAND } from '../../snyk/common/constants/commands';
import { SNYK_ANALYSIS_STATUS } from '../../snyk/common/constants/views';
import { LS_KEY } from '../../snyk/common/languageServer/serverSettingsToLspConfigurationParam';

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
    deepStrictEqual(errorNode.label, '');
    deepStrictEqual(errorNode.description, expectedDescription);
    deepStrictEqual(errorNode.tooltip, expectedDescription);
    deepStrictEqual(errorNode.iconPath, undefined);
    deepStrictEqual(errorNode.internal.isError, true);
    deepStrictEqual(errorNode.command?.command, SNYK_SHOW_LS_OUTPUT_COMMAND);
  }

  function verifyFolderNodeWithError(folderNode: TreeNode, expectedFolderName: string, expectedSuffix: string): void {
    deepStrictEqual(folderNode.label, expectedFolderName);
    deepStrictEqual(folderNode.description, expectedSuffix);
    deepStrictEqual(folderNode.tooltip, expectedSuffix);
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
      issues: [makeMockCodeIssue({ isIgnored: true }), makeMockCodeIssue({ additionalData: { hasAIFix: true } })],
      expectedNodeLabels: ['✋ 1 open issue & 1 ignored issue', '⚡️ 1 open issue is fixable by Snyk Agent Fix.'],
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
        const issueTreeProvider = createIssueTreeProvider(
          new Map([['fake-dir', { isSuccess: true, issues: testCase.issues }]]),
        );
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
      const repositoryInvalidError: PresentableError = {
        error: 'repository does not exist',
        showNotification: false,
        treeNodeSuffix: '(repository not found)',
      };
      await setCCIAndIVOs(false);
      const issueTreeProvider = createIssueTreeProvider(
        new Map([['fake-dir', { isSuccess: false, error: repositoryInvalidError }]]),
      );

      // Act
      const rootChildren = issueTreeProvider.getRootChildren();

      // Verify
      // ⚠️ fake-dir  (repository not found)
      //    Scan failed  Click here to see the problem.
      deepStrictEqual(rootChildren.length, 2);
      verifyFolderNodeWithError(rootChildren[0], 'fake-dir', repositoryInvalidError.treeNodeSuffix);
      verifyScanFailedErrorNode(rootChildren[1]);
    } finally {
      await setCCIAndIVOs(true, DEFAULT_ISSUE_VIEW_OPTIONS);
    }
  });

  test('getRootChildren returns correctly for multi folder workspace scan errors', async () => {
    try {
      // Setup
      await setCCIAndIVOs(false);
      const folderNames = ['dir-one', 'dir-two'];
      const scanError: PresentableError = {
        error: 'Scan failed',
        showNotification: false,
        treeNodeSuffix: '(scan failed)',
      };
      const issueTreeProvider = createIssueTreeProvider(
        new Map(folderNames.map(name => [name, { isSuccess: false, error: scanError }])),
      );

      // Act
      const rootChildren = issueTreeProvider.getRootChildren();

      // Verify
      // V ⚠️ dir-one  (scan failed)
      // |    Scan failed  Click here to see the problem.
      // V ⚠️ dir-two  (scan failed)
      // |    Scan failed  Click here to see the problem.
      deepStrictEqual(rootChildren.length, 2);
      for (let i = 0; i < folderNames.length; i++) {
        const folderNode = rootChildren[i];
        verifyFolderNodeWithError(folderNode, folderNames[i], scanError.treeNodeSuffix);
        const folderChildren = folderNode.getChildren();
        deepStrictEqual(folderChildren.length, 1);
        verifyScanFailedErrorNode(folderChildren[0]);
      }
    } finally {
      await setCCIAndIVOs(true, DEFAULT_ISSUE_VIEW_OPTIONS);
    }
  });

  suite('folder-level enablement (early-exit)', () => {
    const codeFolder = new FolderConfig('/folder/with-code-enabled', {
      [LS_KEY.snykCodeEnabled]: { value: true },
    });

    teardown(async () => {
      await configuration.setFolderConfigs([]);
      await configuration.setFeaturesConfiguration({
        ossEnabled: true,
        codeSecurityEnabled: true,
        iacEnabled: true,
        secretsEnabled: true,
      });
    });

    test('returns disabled message when global is off and no folder config enables Code', async () => {
      await configuration.setFeaturesConfiguration({
        ossEnabled: true,
        codeSecurityEnabled: false,
        iacEnabled: true,
        secretsEnabled: true,
      });
      await configuration.setFolderConfigs([]);

      const issueTreeProvider = createIssueTreeProvider(new Map());

      const rootChildren = issueTreeProvider.getRootChildren();

      deepStrictEqual(
        rootChildren.map(node => node.label),
        [SNYK_ANALYSIS_STATUS.CODE_SECURITY_DISABLED],
      );
    });

    test('does NOT return disabled message when global is off but a folder config has snyk_code_enabled=true', async () => {
      await configuration.setFeaturesConfiguration({
        ossEnabled: true,
        codeSecurityEnabled: false,
        iacEnabled: true,
        secretsEnabled: true,
      });
      await configuration.setFolderConfigs([codeFolder]);

      const issueTreeProvider = createIssueTreeProvider(new Map());
      sinon.stub(issueTreeProvider, 'getResultNodes').returns([]);

      const rootChildren = issueTreeProvider.getRootChildren();

      const labels = rootChildren.map(node => node.label);
      deepStrictEqual(
        labels.includes(SNYK_ANALYSIS_STATUS.CODE_SECURITY_DISABLED),
        false,
        `expected no disabled-message in ${JSON.stringify(labels)}`,
      );
    });

    test('returns disabled message when global is off and folder config explicitly sets snyk_code_enabled=false', async () => {
      await configuration.setFeaturesConfiguration({
        ossEnabled: true,
        codeSecurityEnabled: false,
        iacEnabled: true,
        secretsEnabled: true,
      });
      await configuration.setFolderConfigs([
        new FolderConfig('/folder/disabled', { [LS_KEY.snykCodeEnabled]: { value: false } }),
      ]);

      const issueTreeProvider = createIssueTreeProvider(new Map());

      const rootChildren = issueTreeProvider.getRootChildren();

      deepStrictEqual(
        rootChildren.map(node => node.label),
        [SNYK_ANALYSIS_STATUS.CODE_SECURITY_DISABLED],
      );
    });

    test('falls back to global when a folder config does not override snyk_code_enabled', async () => {
      await configuration.setFeaturesConfiguration({
        ossEnabled: true,
        codeSecurityEnabled: true,
        iacEnabled: true,
        secretsEnabled: true,
      });
      // Folder config exists but has no `snyk_code_enabled` override (e.g. only baseBranch was sent
      // by LS). Per-folder lookup should fall back to the global value (`true`) instead of treating
      // the missing folder flag as "disabled".
      await configuration.setFolderConfigs([new FolderConfig('/folder/no-override', {})]);

      const issueTreeProvider = createIssueTreeProvider(new Map());
      sinon.stub(issueTreeProvider, 'getResultNodes').returns([]);

      const rootChildren = issueTreeProvider.getRootChildren();

      const labels = rootChildren.map(node => node.label);
      deepStrictEqual(
        labels.includes(SNYK_ANALYSIS_STATUS.CODE_SECURITY_DISABLED),
        false,
        `expected no disabled-message in ${JSON.stringify(labels)}`,
      );
    });
  });
});
