import { strictEqual } from 'assert';
import sinon from 'sinon';
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
import { IDiagnosticsIssueProvider } from '../../../snyk/common/services/diagnosticsService';

suite('Code Service', () => {
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
      {} as IDiagnosticsIssueProvider<CodeIssueData>,
      new LoggerMock(),
    );
  });

  teardown(() => {
    sinon.restore();
  });

  test('Scan returned for non-Code product', () => {
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
