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
import { IssueViewOptions } from '../../snyk/common/configuration/configuration';

suite('Code Security Issue Tree Provider', () => {
  let viewManagerService: IViewManagerService;
  let contextService: IContextService;
  let codeService: IProductService<CodeIssueData>;
  let languages: IVSCodeLanguages;
  let folderConfigs: IFolderConfigs;

  setup(async () => {
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

    configuration.setFeatureFlag(FEATURE_FLAGS.consistentIgnores, true);
    await vscode.workspace.getConfiguration().update(ISSUE_VIEW_OPTIONS_SETTING, {
      openIssues: true,
      ignoredIssues: true,
    });
  });

  teardown(() => {
    sinon.restore();
  });

  const testCases: {
    name: string;
    issueViewOptions: IssueViewOptions;
    issues: Issue<CodeIssueData>[];
    expectedNodeLabels: string[];
  }[] = [
    {
      name: 'getRootChildren returns correctly when viewing open & ignored and no issues found',
      issueViewOptions: { openIssues: true, ignoredIssues: true },
      issues: [],
      expectedNodeLabels: ['✅ Congrats! No issues found!'],
    },
    {
      name: 'getRootChildren returns correctly when viewing open & ignored and have one open non-fixable',
      issueViewOptions: { openIssues: true, ignoredIssues: true },
      issues: [makeMockCodeIssue()],
      expectedNodeLabels: ['✋ 1 open issue, 0 ignored issues', 'There are no issues fixable by Snyk DeepCode AI'],
    },
    {
      name: 'getRootChildren returns correctly when viewing only open and have none',
      issueViewOptions: { openIssues: true, ignoredIssues: false },
      issues: [],
      expectedNodeLabels: ['✅ Congrats! No open issues found!', 'Adjust your settings to view Ignored issues.'],
    },
    {
      name: 'getRootChildren returns correctly when viewing only open and have one non-fixable',
      issueViewOptions: { openIssues: true, ignoredIssues: false },
      issues: [makeMockCodeIssue()],
      expectedNodeLabels: ['✋ 1 open issue', 'There are no issues fixable by Snyk DeepCode AI'],
    },
    {
      name: 'getRootChildren returns correctly when viewing only ignored and have none',
      issueViewOptions: { openIssues: false, ignoredIssues: true },
      issues: [],
      expectedNodeLabels: [
        '✋ No ignored issues, open issues are disabled',
        'Adjust your settings to view Open issues.',
      ],
    },
    {
      name: 'getRootChildren returns correctly when viewing only ignored and have one',
      issueViewOptions: { openIssues: false, ignoredIssues: true },
      issues: [makeMockCodeIssue({ isIgnored: true })],
      expectedNodeLabels: ['✋ 1 ignored issue, open issues are disabled'],
    },
    {
      name: 'getRootChildren returns correctly when viewing nothing',
      issueViewOptions: { openIssues: false, ignoredIssues: false },
      issues: [],
      expectedNodeLabels: [
        'Open and Ignored issues are disabled!',
        'Adjust your setttings to view Open or Ignored issues.',
      ],
    },
  ];

  for (const testCase of testCases) {
    test(testCase.name, async () => {
      try {
        await vscode.workspace.getConfiguration().update(ISSUE_VIEW_OPTIONS_SETTING, testCase.issueViewOptions);

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
        await vscode.workspace.getConfiguration().update(ISSUE_VIEW_OPTIONS_SETTING, {
          openIssues: true,
          ignoredIssues: true,
        });
      }
    });
  }
});
