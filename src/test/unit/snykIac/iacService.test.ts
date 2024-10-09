import { strictEqual } from 'assert';
import sinon from 'sinon';
import { IConfiguration } from '../../../snyk/common/configuration/configuration';
import { WorkspaceTrust } from '../../../snyk/common/configuration/trustedFolders';
import { ILanguageServer } from '../../../snyk/common/languageServer/languageServer';
import { IacIssueData, ScanProduct, ScanStatus } from '../../../snyk/common/languageServer/types';
import { IProductService } from '../../../snyk/common/services/productService';
import { IViewManagerService } from '../../../snyk/common/services/viewManagerService';
import { ICodeActionAdapter, ICodeActionKindAdapter } from '../../../snyk/common/vscode/codeAction';
import { ExtensionContext } from '../../../snyk/common/vscode/extensionContext';
import { IVSCodeLanguages } from '../../../snyk/common/vscode/languages';
import { IVSCodeWorkspace } from '../../../snyk/common/vscode/workspace';
import { IacService } from '../../../snyk/snykIac/iacService';
import { IacSuggestionWebviewProvider } from '../../../snyk/snykIac/views/suggestion/iacSuggestionWebviewProvider';
import { LanguageServerMock } from '../mocks/languageServer.mock';
import { LoggerMock } from '../mocks/logger.mock';
import { IDiagnosticsIssueProvider } from '../../../snyk/common/services/diagnosticsService';

suite('IaC Service', () => {
  let ls: ILanguageServer;
  let service: IProductService<IacIssueData>;
  let refreshViewFake: sinon.SinonSpy;

  setup(() => {
    ls = new LanguageServerMock();
    refreshViewFake = sinon.fake();

    const viewManagerService = {
      refreshIacView: refreshViewFake,
    } as unknown as IViewManagerService;

    service = new IacService(
      {} as ExtensionContext,
      {} as IConfiguration,
      {} as IacSuggestionWebviewProvider,
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
      {
        registerCodeActionsProvider: sinon.fake(),
      } as unknown as IVSCodeLanguages,
      {} as IDiagnosticsIssueProvider<IacIssueData>,
      new LoggerMock(),
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
      errorMessage: '',
    });

    strictEqual(service.isAnalysisRunning, false);
    sinon.assert.notCalled(refreshViewFake);
  });
});
