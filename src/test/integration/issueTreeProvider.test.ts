import sinon from 'sinon';

import { IConfiguration, IssueViewOptions, SeverityFilter } from '../../snyk/common/configuration/configuration';
import { IVSCodeLanguages } from '../../snyk/common/vscode/languages';
import { CodeIssueData } from '../../snyk/common/languageServer/types';
import { IContextService } from '../../snyk/common/services/contextService';
import { IProductService } from '../../snyk/common/services/productService';
import { IssueTreeProvider } from '../../snyk/snykCode/views/issueTreeProvider';
import { strictEqual } from 'assert';

suite('Code ASecurity Issue Tree Provider', () => {
  let contextService: IContextService;
  let config: IConfiguration;
  let codeService: IProductService<CodeIssueData>;
  let languages: IVSCodeLanguages;

  let issueTreeProvider: IssueTreeProvider;

  setup(() => {
    contextService = {
      shouldShowCodeAnalysis: true,
    } as unknown as IContextService;
    config = {
      issueViewOptions: {
        ignoredIssues: true,
        openIssues: true,
      } as IssueViewOptions,
      severityFilter: {
        critical: true,
        high: true,
        medium: true,
        low: true,
      } as SeverityFilter,
    } as unknown as IConfiguration;
    codeService = {
      isLsDownloadSuccessful: true,
      isAnyWorkspaceFolderTrusted: true,
      isAnalysisRunning: false,
      isAnyResultAvailable: () => true,
      result: {
        values: () => [[]],
      },
    } as unknown as IProductService<CodeIssueData>;
    languages = {} as unknown as IVSCodeLanguages;
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

    issueTreeProvider = new IssueTreeProvider(contextService, localCodeService, config, languages, true);

    sinon.stub(issueTreeProvider, 'getResultNodes').returns([]);
    const rootChildren = issueTreeProvider.getRootChildren();
    strictEqual(rootChildren.length, 2);
    strictEqual(rootChildren[0].label, 'Snyk found 1 issue');
    strictEqual(rootChildren[1].label, 'There are no vulnerabilities fixable by Snyk DeepCode AI');
  });

  test('getRootChildren returns a root child for no results', () => {
    const localCodeService = {
      ...codeService,
      result: {
        values: () => [[]],
      },
    } as unknown as IProductService<CodeIssueData>;

    issueTreeProvider = new IssueTreeProvider(contextService, localCodeService, config, languages, true);

    sinon.stub(issueTreeProvider, 'getResultNodes').returns([]);
    const rootChildren = issueTreeProvider.getRootChildren();
    strictEqual(rootChildren.length, 2);
    strictEqual(rootChildren[0].label, 'Snyk found no issues! ✅');
    strictEqual(rootChildren[1].label, 'There are no vulnerabilities fixable by Snyk DeepCode AI');
  });

  test('getRootChildren returns a root child for only open but not visible issues', () => {
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

    config.issueViewOptions.openIssues = false;
    issueTreeProvider = new IssueTreeProvider(contextService, localCodeService, config, languages, true);

    sinon.stub(issueTreeProvider, 'getResultNodes').returns([]);
    const rootChildren = issueTreeProvider.getRootChildren();
    strictEqual(rootChildren.length, 3);
    strictEqual(rootChildren[0].label, 'Snyk found 1 issue');
    strictEqual(rootChildren[1].label, 'There are no vulnerabilities fixable by Snyk DeepCode AI');
    strictEqual(rootChildren[2].label, 'Adjust your Issue View Options to see open issues.');
    config.issueViewOptions.openIssues = true;
  });

  test('getRootChildren returns a root child for only ignored but not visible issues', () => {
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

    config.issueViewOptions.ignoredIssues = false;
    issueTreeProvider = new IssueTreeProvider(contextService, localCodeService, config, languages, true);

    sinon.stub(issueTreeProvider, 'getResultNodes').returns([]);
    const rootChildren = issueTreeProvider.getRootChildren();
    strictEqual(rootChildren.length, 3);
    strictEqual(rootChildren[0].label, 'Snyk found 1 issue');
    strictEqual(rootChildren[1].label, 'There are no vulnerabilities fixable by Snyk DeepCode AI');
    strictEqual(rootChildren[2].label, 'Adjust your Issue View Options to see ignored issues.');
    config.issueViewOptions.ignoredIssues = true;
  });

  test('getRootChildren returns a root child for no visible issues', () => {
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

    config.issueViewOptions.openIssues = false;
    config.issueViewOptions.ignoredIssues = false;
    issueTreeProvider = new IssueTreeProvider(contextService, localCodeService, config, languages, true);

    sinon.stub(issueTreeProvider, 'getResultNodes').returns([]);
    const rootChildren = issueTreeProvider.getRootChildren();
    strictEqual(rootChildren.length, 3);
    strictEqual(rootChildren[0].label, 'Snyk found 1 issue');
    strictEqual(rootChildren[1].label, 'There are no vulnerabilities fixable by Snyk DeepCode AI');
    strictEqual(rootChildren[2].label, 'Adjust your Issue View Options to see all issues.');
    config.issueViewOptions.openIssues = true;
    config.issueViewOptions.ignoredIssues = true;
  });
});
