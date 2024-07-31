import sinon from 'sinon';
import * as vscode from 'vscode';

import { IVSCodeLanguages } from '../../snyk/common/vscode/languages';
import { CodeIssueData, ScanProduct } from '../../snyk/common/languageServer/types';
import { IContextService } from '../../snyk/common/services/contextService';
import { IProductService } from '../../snyk/common/services/productService';
import { IssueTreeProvider } from '../../snyk/snykCode/views/issueTreeProvider';
import { strictEqual } from 'assert';
import { FEATURE_FLAGS } from '../../snyk/common/constants/featureFlags';
import { configuration } from '../../snyk/common/configuration/instance';
import { ISSUE_VIEW_OPTIONS_SETTING } from '../../snyk/common/constants/settings';
import { IFolderConfigs } from '../../snyk/common/configuration/folderConfigs';

suite('Code Issue Tree Provider', () => {
  let contextService: IContextService;
  let codeService: IProductService<CodeIssueData>;
  let languages: IVSCodeLanguages;
  let folderConfigs: IFolderConfigs;

  let issueTreeProvider: IssueTreeProvider;

  setup(() => {
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
    configuration.setFeatureFlag(FEATURE_FLAGS.consistentIgnores, true);
    languages = {} as unknown as IVSCodeLanguages;
    folderConfigs = {} as unknown as IFolderConfigs;
  });

  teardown(() => {
    sinon.restore();
  });

  test('getRootChildren returns no extra root children', () => {
    const localCodeService = {
      ...codeService,
      result: {
        values: () => [
          [
            {
              filePath: '//folderName//test.js',
              isIgnored: false,
              additionalData: {
                rule: 'some-rule',
                hasAIFix: false,
                isSecurityType: true,
              },
            } as unknown as CodeIssueData,
          ],
        ],
      },
    } as unknown as IProductService<CodeIssueData>;

    issueTreeProvider = new IssueTreeProvider(
      contextService,
      localCodeService,
      configuration,
      languages,
      true,
      folderConfigs,
    );

    sinon.stub(issueTreeProvider, 'getResultNodes').returns([]);
    const rootChildren = issueTreeProvider.getRootChildren();
    strictEqual(rootChildren.length, 2);
    strictEqual(rootChildren[0].label, 'Snyk found 1 issue');
    strictEqual(rootChildren[1].label, 'There are no issues fixable by Snyk DeepCode AI');
  });

  test('getRootChildren returns a root child for no results', () => {
    const localCodeService = {
      ...codeService,
      result: {
        values: () => [[]],
      },
    } as unknown as IProductService<CodeIssueData>;

    issueTreeProvider = new IssueTreeProvider(
      contextService,
      localCodeService,
      configuration,
      languages,
      true,
      folderConfigs,
    );

    sinon.stub(issueTreeProvider, 'getResultNodes').returns([]);
    const rootChildren = issueTreeProvider.getRootChildren();
    strictEqual(rootChildren.length, 1);
    strictEqual(rootChildren[0].label, '✅ Congrats! No issues found!');
  });

  test('getRootChildren returns a root child for only open but not visible issues', async () => {
    const localCodeService = {
      ...codeService,
      result: {
        values: () => [
          [
            {
              filePath: '//folderName//test.js',
              additionalData: {
                rule: 'some-rule',
                hasAIFix: false,
                isIgnored: false,
                isSecurityType: true,
              },
            } as unknown as CodeIssueData,
          ],
        ],
      },
    } as unknown as IProductService<CodeIssueData>;

    await vscode.workspace.getConfiguration().update(ISSUE_VIEW_OPTIONS_SETTING, {
      openIssues: false,
      ignoredIssues: true,
    });
    configuration.issueViewOptions.openIssues = false;
    issueTreeProvider = new IssueTreeProvider(
      contextService,
      localCodeService,
      configuration,
      languages,
      true,
      folderConfigs,
    );

    sinon.stub(issueTreeProvider, 'getResultNodes').returns([]);
    const rootChildren = issueTreeProvider.getRootChildren();
    strictEqual(rootChildren.length, 3);
    strictEqual(rootChildren[0].label, 'Snyk found 1 issue');
    strictEqual(rootChildren[1].label, 'There are no issues fixable by Snyk DeepCode AI');
    strictEqual(rootChildren[2].label, 'Adjust your Issue View Options to see open issues.');
    await vscode.workspace.getConfiguration().update(ISSUE_VIEW_OPTIONS_SETTING, {
      openIssues: true,
      ignoredIssues: true,
    });
  });

  test('getRootChildren returns a root child for only ignored but not visible issues', async () => {
    const localCodeService = {
      ...codeService,
      result: {
        values: () => [
          [
            {
              filePath: '//folderName//test.js',
              isIgnored: true,
              additionalData: {
                rule: 'some-rule',
                hasAIFix: false,
                isSecurityType: true,
              },
            } as unknown as CodeIssueData,
          ],
        ],
      },
    } as unknown as IProductService<CodeIssueData>;

    await vscode.workspace.getConfiguration().update(ISSUE_VIEW_OPTIONS_SETTING, {
      openIssues: true,
      ignoredIssues: false,
    });
    issueTreeProvider = new IssueTreeProvider(
      contextService,
      localCodeService,
      configuration,
      languages,
      true,
      folderConfigs,
    );

    sinon.stub(issueTreeProvider, 'getResultNodes').returns([]);
    const rootChildren = issueTreeProvider.getRootChildren();
    strictEqual(rootChildren.length, 3);
    strictEqual(rootChildren[0].label, 'Snyk found 1 issue');
    strictEqual(rootChildren[1].label, 'There are no issues fixable by Snyk DeepCode AI');
    strictEqual(rootChildren[2].label, 'Adjust your Issue View Options to see ignored issues.');
    await vscode.workspace.getConfiguration().update(ISSUE_VIEW_OPTIONS_SETTING, {
      openIssues: true,
      ignoredIssues: true,
    });
  });

  test('getRootChildren returns a root child for no visible issues', async () => {
    const localCodeService = {
      ...codeService,
      result: {
        values: () => [
          [
            {
              filePath: '//folderName//test.js',
              isIgnored: false,
              additionalData: {
                rule: 'some-rule',
                hasAIFix: false,
                isSecurityType: true,
              },
            } as unknown as CodeIssueData,
          ],
        ],
      },
    } as unknown as IProductService<CodeIssueData>;

    await vscode.workspace.getConfiguration().update(ISSUE_VIEW_OPTIONS_SETTING, {
      openIssues: false,
      ignoredIssues: false,
    });
    issueTreeProvider = new IssueTreeProvider(
      contextService,
      localCodeService,
      configuration,
      languages,
      true,
      folderConfigs,
    );

    sinon.stub(issueTreeProvider, 'getResultNodes').returns([]);
    const rootChildren = issueTreeProvider.getRootChildren();
    strictEqual(rootChildren.length, 3);
    strictEqual(rootChildren[0].label, 'Snyk found 1 issue');
    strictEqual(rootChildren[1].label, 'There are no issues fixable by Snyk DeepCode AI');
    strictEqual(rootChildren[2].label, 'Adjust your Issue View Options to see all issues.');
    await vscode.workspace.getConfiguration().update(ISSUE_VIEW_OPTIONS_SETTING, {
      openIssues: true,
      ignoredIssues: true,
    });
  });
});
