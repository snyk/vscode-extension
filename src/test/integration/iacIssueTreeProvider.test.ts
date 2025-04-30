import sinon from 'sinon';
import * as vscode from 'vscode';

import { IVSCodeLanguages } from '../../snyk/common/vscode/languages';
import { IacIssueData, Issue, ScanProduct } from '../../snyk/common/languageServer/types';
import { IContextService } from '../../snyk/common/services/contextService';
import { IProductService } from '../../snyk/common/services/productService';
import { deepStrictEqual } from 'assert';
import { FEATURE_FLAGS } from '../../snyk/common/constants/featureFlags';
import { configuration } from '../../snyk/common/configuration/instance';
import { ISSUE_VIEW_OPTIONS_SETTING } from '../../snyk/common/constants/settings';
import { IFolderConfigs } from '../../snyk/common/configuration/folderConfigs';
import { LoggerMockFailOnErrors } from '../unit/mocks/logger.mock';
import { DEFAULT_ISSUE_VIEW_OPTIONS, IssueViewOptions } from '../../snyk/common/configuration/configuration';
import IacIssueTreeProvider from '../../snyk/snykIac/views/iacIssueTreeProvider';
import { IViewManagerService } from '../../snyk/common/services/viewManagerService';
import { makeMockIaCIssue } from '../unit/mocks/issue.mock';

suite('IaC Issue Tree Provider', () => {
  let viewManagerService: IViewManagerService;
  let contextService: IContextService;
  let iacService: IProductService<IacIssueData>;
  let languages: IVSCodeLanguages;
  let folderConfigs: IFolderConfigs;

  setup(() => {
    viewManagerService = {
      refreshIacViewEmitter: sinon.stub(),
    } as unknown as IViewManagerService;
    contextService = {
      shouldShowIacAnalysis: true,
    } as unknown as IContextService;
    iacService = {
      isLsDownloadSuccessful: true,
      isAnyWorkspaceFolderTrusted: true,
      isAnalysisRunning: false,
      isAnyResultAvailable: () => true,
      result: {
        values: () => [[]],
      },
      getSnykProductType: () => ScanProduct.InfrastructureAsCode,
    } as unknown as IProductService<IacIssueData>;
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
      issues: Issue<IacIssueData>[];
      expectedNodeLabels: string[];
    })[] = [
    {
      name: 'getRootChildren returns correctly for no issues found with CCI disabled',
      consistentIgnores: false,
      issues: [],
      expectedNodeLabels: ['✅ Congrats! No issues found!'],
    },
    {
      name: 'getRootChildren returns correctly when viewing open and no issues found with CCI enabled',
      consistentIgnores: true,
      issueViewOptions: { openIssues: true, ignoredIssues: true /* value should be irrelevant */ },
      issues: [],
      expectedNodeLabels: ['✅ Congrats! No issues found!'],
    },
    {
      name: 'getRootChildren returns correctly for one issue with CCI disabled',
      consistentIgnores: false,
      issues: [makeMockIaCIssue()],
      expectedNodeLabels: ['✋ 1 issue'],
    },
    {
      name: 'getRootChildren returns correctly when not viewing open issues with CCI enabled',
      consistentIgnores: true,
      issueViewOptions: { openIssues: false, ignoredIssues: true /* value should be irrelevant */ },
      issues: [],
      expectedNodeLabels: ['Open issues are disabled!', 'Adjust your settings to view Open issues.'],
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

        const issueTreeProvider = new IacIssueTreeProvider(
          new LoggerMockFailOnErrors(),
          viewManagerService,
          contextService,
          {
            ...iacService,
            result: new Map([['fake-dir', testCase.issues]]),
          } as IProductService<IacIssueData>,
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
