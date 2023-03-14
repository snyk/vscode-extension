import { strictEqual } from 'assert';
import sinon from 'sinon';
import { IAnalytics } from '../../../snyk/common/analytics/itly';
import { IConfiguration } from '../../../snyk/common/configuration/configuration';
import { WorkspaceTrust } from '../../../snyk/common/configuration/trustedFolders';
import { ILanguageServer } from '../../../snyk/common/languageServer/languageServer';
import { CodeIssueData, ScanProduct, ScanStatus } from '../../../snyk/common/languageServer/types';
import { IProductService } from '../../../snyk/common/services/productService';
import { IViewManagerService } from '../../../snyk/common/services/viewManagerService';
import { ICodeActionAdapter, ICodeActionKindAdapter } from '../../../snyk/common/vscode/codeAction';
import { ExtensionContext } from '../../../snyk/common/vscode/extensionContext';
import { IVSCodeWorkspace } from '../../../snyk/common/vscode/workspace';
import { SnykCodeService } from '../../../snyk/snykCode/codeService';
import { ICodeSuggestionWebviewProvider } from '../../../snyk/snykCode/views/interfaces';
import { LanguageServerMock } from '../mocks/languageServer.mock';
import { languagesMock } from '../mocks/languages.mock';
import { LoggerMock } from '../mocks/logger.mock';

suite('IaC Service', () => {
  let ls: ILanguageServer;
  let service: IProductService<CodeIssueData>;
  let refreshViewFake: sinon.SinonSpy;

  setup(() => {
    ls = new LanguageServerMock();
    refreshViewFake = sinon.fake();

    const viewManagerService = {
      refreshAllCodeAnalysisViews: refreshViewFake,
    } as unknown as IViewManagerService;

    service = new SnykCodeService(
      {} as ExtensionContext,
      {} as IConfiguration,
      {} as ICodeSuggestionWebviewProvider,
      {} as ICodeActionAdapter,
      {
        getQuickFix: sinon.fake(),
      } as ICodeActionKindAdapter,
      viewManagerService,
      {
        getWorkspaceFolders: () => [''],
      } as IVSCodeWorkspace,
      new WorkspaceTrust(),
      ls,
      languagesMock,
      new LoggerMock(),
      {} as IAnalytics,
    );
  });

  teardown(() => {
    sinon.restore();
  });

  test('Scan returned for non-IaC product', () => {
    ls.scan$.next({
      product: ScanProduct.OpenSource,
      folderPath: 'test/path',
      issues: [],
      status: ScanStatus.InProgress,
    });

    strictEqual(service.isAnalysisRunning, false);
    sinon.assert.notCalled(refreshViewFake);
  });
});
