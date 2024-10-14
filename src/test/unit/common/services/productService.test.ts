import { strictEqual } from 'assert';
import { Subscription } from 'rxjs';
import sinon from 'sinon';
import { IConfiguration } from '../../../../snyk/common/configuration/configuration';
import { WorkspaceTrust } from '../../../../snyk/common/configuration/trustedFolders';
import { ILanguageServer } from '../../../../snyk/common/languageServer/languageServer';
import { Issue, Scan, ScanProduct, ScanStatus } from '../../../../snyk/common/languageServer/types';
import { IProductService, ProductService } from '../../../../snyk/common/services/productService';
import { IViewManagerService } from '../../../../snyk/common/services/viewManagerService';
import { IProductWebviewProvider } from '../../../../snyk/common/views/webviewProvider';
import { ExtensionContext } from '../../../../snyk/common/vscode/extensionContext';
import { IVSCodeLanguages } from '../../../../snyk/common/vscode/languages';
import { IVSCodeWorkspace } from '../../../../snyk/common/vscode/workspace';
import { LanguageServerMock } from '../../mocks/languageServer.mock';
import { LoggerMock } from '../../mocks/logger.mock';
import { IDiagnosticsIssueProvider } from '../../../../snyk/common/services/diagnosticsService';

type ProductData = {
  productName: string;
};
class MockProductService extends ProductService<ProductData> {
  productType: ScanProduct;

  subscribeToLsScanMessages(): Subscription {
    return this.languageServer.scan$.subscribe((scan: Scan<unknown>) => {
      super.handleLsScanMessage(scan as Scan<ProductData>);
    });
  }

  refreshTreeView(): void {
    this.viewManagerService.refreshAllViews();
  }
}

suite('Product Service', () => {
  let ls: ILanguageServer;
  let service: IProductService<ProductData>;
  let refreshViewFake: sinon.SinonSpy;

  setup(() => {
    ls = new LanguageServerMock();
    refreshViewFake = sinon.fake();

    const viewManagerService = {
      refreshAllViews: refreshViewFake,
    } as unknown as IViewManagerService;

    service = new MockProductService(
      {} as ExtensionContext,
      {} as IConfiguration,
      {} as unknown as IProductWebviewProvider<Issue<ProductData>>,
      viewManagerService,
      {
        getWorkspaceFolders: () => [''],
      } as IVSCodeWorkspace,
      new WorkspaceTrust(),
      ls,
      {} as IVSCodeLanguages,
      {
        getIssuesFromDiagnostics: () => [],
      } as IDiagnosticsIssueProvider<ProductData>,
      new LoggerMock(),
    );
  });

  teardown(() => {
    sinon.restore();
  });

  test('Scan in progress', () => {
    ls.scan$.next({
      product: ScanProduct.InfrastructureAsCode,
      folderPath: 'test/path',
      issues: [],
      status: ScanStatus.InProgress,
      errorMessage: '',
    });

    strictEqual(service.isAnalysisRunning, true);
    sinon.assert.calledOnce(refreshViewFake);
  });

  test('Scan successfully finished', () => {
    const folderPath = 'test/path';
    ls.scan$.next({
      product: ScanProduct.InfrastructureAsCode,
      folderPath,
      issues: [],
      status: ScanStatus.InProgress,
      errorMessage: '',
    });
    ls.scan$.next({
      product: ScanProduct.InfrastructureAsCode,
      folderPath,
      issues: [],
      status: ScanStatus.Success,
      errorMessage: '',
    });

    strictEqual(service.isAnalysisRunning, false);
    sinon.assert.calledTwice(refreshViewFake);
  });

  test('Scan failed', () => {
    const folderPath = 'test/path';
    ls.scan$.next({
      product: ScanProduct.InfrastructureAsCode,
      folderPath,
      issues: [],
      status: ScanStatus.InProgress,
      errorMessage: 'Scan failed',
    });
    ls.scan$.next({
      product: ScanProduct.InfrastructureAsCode,
      folderPath,
      issues: [],
      status: ScanStatus.Error,
      errorMessage: 'Scan failed',
    });

    strictEqual(service.isAnalysisRunning, false);
    sinon.assert.calledTwice(refreshViewFake);
  });

  test('Scan finished when all scans in progress completed', () => {
    const folder1Path = 'test/path';
    const folder2Path = 'test/path2';
    ls.scan$.next({
      product: ScanProduct.InfrastructureAsCode,
      folderPath: folder1Path,
      issues: [],
      status: ScanStatus.InProgress,
      errorMessage: '',
    });
    ls.scan$.next({
      product: ScanProduct.InfrastructureAsCode,
      folderPath: folder2Path,
      issues: [],
      status: ScanStatus.InProgress,
      errorMessage: '',
    });
    ls.scan$.next({
      product: ScanProduct.InfrastructureAsCode,
      folderPath: folder1Path,
      issues: [],
      status: ScanStatus.Success,
      errorMessage: '',
    });

    strictEqual(service.isAnalysisRunning, true);

    ls.scan$.next({
      product: ScanProduct.InfrastructureAsCode,
      folderPath: folder2Path,
      issues: [],
      status: ScanStatus.Success,
      errorMessage: '',
    });

    strictEqual(service.isAnalysisRunning, false);
    sinon.assert.calledTwice(refreshViewFake);
  });
});
