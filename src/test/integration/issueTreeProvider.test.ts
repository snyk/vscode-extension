import sinon from 'sinon';
import * as vscode from 'vscode';

import { IVSCodeLanguages } from '../../snyk/common/vscode/languages';
import { CodeIssueData, Issue, ScanProduct } from '../../snyk/common/languageServer/types';
import { IContextService } from '../../snyk/common/services/contextService';
import { IProductService } from '../../snyk/common/services/productService';
import { IssueTreeProvider } from '../../snyk/snykCode/views/issueTreeProvider';
import { deepStrictEqual } from 'assert';
import { FEATURE_FLAGS } from '../../snyk/common/constants/featureFlags';
import { configuration } from '../../snyk/common/configuration/instance';
import { ISSUE_VIEW_OPTIONS_SETTING } from '../../snyk/common/constants/settings';
import { IFolderConfigs } from '../../snyk/common/configuration/folderConfigs';
import { LoggerMockFailOnErrors } from '../unit/mocks/logger.mock';
import { makeMockCodeIssue } from '../unit/mocks/issue.mock';
import { IssueViewOptions } from '../../snyk/common/configuration/configuration';

suite('Code Issue Tree Provider', () => {
  let contextService: IContextService;
  let codeService: IProductService<CodeIssueData>;
  let languages: IVSCodeLanguages;
  let folderConfigs: IFolderConfigs;

  setup(async () => {
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
      name: 'getRootChildren returns correctly for no issues found',
      issueViewOptions: { openIssues: true, ignoredIssues: true },
      issues: [],
      expectedNodeLabels: ['✅ Congrats! No issues found!'],
    },
    {
      name: 'getRootChildren returns correctly for a visable non-fixable issue',
      issueViewOptions: { openIssues: true, ignoredIssues: true },
      issues: [makeMockCodeIssue()],
      expectedNodeLabels: ['✋ 1 issue', 'There are no issues fixable by Snyk DeepCode AI'],
    },
    {
      name: 'getRootChildren returns correctly when not viewing open issues',
      issueViewOptions: { openIssues: false, ignoredIssues: true /* value should be irrelevant */ },
      issues: [],
      expectedNodeLabels: ['Open issues are disabled!', 'Adjust your settings to view Open issues.'],
    },
  ];

  for (const testCase of testCases) {
    test(testCase.name, async () => {
      try {
        await vscode.workspace.getConfiguration().update(ISSUE_VIEW_OPTIONS_SETTING, testCase.issueViewOptions);

        const issueTreeProvider = new IssueTreeProvider(
          new LoggerMockFailOnErrors(),
          contextService,
          {
            ...codeService,
            result: new Map([['fake-dir', testCase.issues]]),
          } as IProductService<CodeIssueData>,
          configuration,
          languages,
          true,
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
