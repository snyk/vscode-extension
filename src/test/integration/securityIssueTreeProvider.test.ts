import sinon from 'sinon';
import * as vscode from 'vscode';

import { IVSCodeLanguages } from '../../snyk/common/vscode/languages';
import { CodeIssueData, Issue, ScanProduct } from '../../snyk/common/languageServer/types';
import { IContextService } from '../../snyk/common/services/contextService';
import { IProductService } from '../../snyk/common/services/productService';
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

suite('Code Security Issue Tree Provider', () => {
  let viewManagerService: IViewManagerService;
  let contextService: IContextService;
  let codeService: IProductService<CodeIssueData>;
  let languages: IVSCodeLanguages;
  let folderConfigs: IFolderConfigs;

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
    folderConfigs = {} as unknown as IFolderConfigs;
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
        configuration.setFeatureFlag(FEATURE_FLAGS.consistentIgnores, testCase.consistentIgnores);
        if (testCase.consistentIgnores) {
          await vscode.workspace.getConfiguration().update(ISSUE_VIEW_OPTIONS_SETTING, testCase.issueViewOptions);
        } else {
          // The issue view options shouldn't matter, but we'll test with them disabled to be sure.
          await vscode.workspace
            .getConfiguration()
            .update(ISSUE_VIEW_OPTIONS_SETTING, { openIssues: false, ignoredIssues: false });
        }

        const issueTreeProvider = new CodeSecurityIssueTreeProvider(
          new LoggerMockFailOnErrors(),
          viewManagerService,
          contextService,
          {
            ...codeService,
            result: new Map([['fake-dir', testCase.issues]]),
          } as IProductService<CodeIssueData>,
          configuration,
          languages,
          folderConfigs,
        );

        sinon.stub(issueTreeProvider, 'getResultNodes').returns([]);

        const rootChildren = issueTreeProvider.getRootChildren();
        const rootChildrenLabels = rootChildren.map(node => node.label);
        deepStrictEqual(rootChildrenLabels, testCase.expectedNodeLabels);
      } finally {
        configuration.setFeatureFlag(FEATURE_FLAGS.consistentIgnores, true);
        await vscode.workspace.getConfiguration().update(ISSUE_VIEW_OPTIONS_SETTING, DEFAULT_ISSUE_VIEW_OPTIONS);
      }
    });
  }
});
