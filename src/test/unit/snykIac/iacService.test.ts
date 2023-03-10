import { strictEqual } from 'assert';
import sinon from 'sinon';
import { IConfiguration } from '../../../snyk/common/configuration/configuration';
import { WorkspaceTrust } from '../../../snyk/common/configuration/trustedFolders';
import { ILanguageServer } from '../../../snyk/common/languageServer/languageServer';
import { ScanProduct, ScanStatus } from '../../../snyk/common/languageServer/types';
import { IViewManagerService } from '../../../snyk/common/services/viewManagerService';
import { ExtensionContext } from '../../../snyk/common/vscode/extensionContext';
import { IVSCodeWorkspace } from '../../../snyk/common/vscode/workspace';
import { IacService, IIacService } from '../../../snyk/snykIaC/iacService';
import { IIacSuggestionWebviewProvider } from '../../../snyk/snykIaC/views/interfaces';
import { LanguageServerMock } from '../mocks/languageServer.mock';
import { LoggerMock } from '../mocks/logger.mock';

suite('Snyk IaC Service', () => {
  let ls: ILanguageServer;
  let service: IIacService;
  let refreshViewFake: sinon.SinonSpy;

  setup(() => {
    ls = new LanguageServerMock();
    refreshViewFake = sinon.fake();
    service = new IacService(
      {} as ExtensionContext,
      {} as IConfiguration,
      {} as unknown as IIacSuggestionWebviewProvider,
      {
        refreshIacView: refreshViewFake,
      } as unknown as IViewManagerService,
      {
        getWorkspaceFolders: () => [''],
      } as IVSCodeWorkspace,
      new WorkspaceTrust(),
      ls,
      new LoggerMock(),
    );
  });

  teardown(() => {
    sinon.restore();
  });

  test('Scan returned for different product', () => {
    ls.scan$.next({
      product: ScanProduct.OpenSource,
      folderPath: 'test/path',
      issues: [],
      status: ScanStatus.InProgress,
    });

    strictEqual(service.isAnalysisRunning, false);
    sinon.assert.notCalled(refreshViewFake);
  });

  test('Scan in progress', () => {
    ls.scan$.next({
      product: ScanProduct.InfrastructureAsCode,
      folderPath: 'test/path',
      issues: [],
      status: ScanStatus.InProgress,
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
    });
    ls.scan$.next({
      product: ScanProduct.InfrastructureAsCode,
      folderPath,
      issues: [],
      status: ScanStatus.Success,
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
    });
    ls.scan$.next({
      product: ScanProduct.InfrastructureAsCode,
      folderPath,
      issues: [],
      status: ScanStatus.Error,
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
    });
    ls.scan$.next({
      product: ScanProduct.InfrastructureAsCode,
      folderPath: folder2Path,
      issues: [],
      status: ScanStatus.InProgress,
    });
    ls.scan$.next({
      product: ScanProduct.InfrastructureAsCode,
      folderPath: folder1Path,
      issues: [],
      status: ScanStatus.Success,
    });

    strictEqual(service.isAnalysisRunning, true);

    ls.scan$.next({
      product: ScanProduct.InfrastructureAsCode,
      folderPath: folder2Path,
      issues: [],
      status: ScanStatus.Success,
    });

    strictEqual(service.isAnalysisRunning, false);
    sinon.assert.calledTwice(refreshViewFake);
  });
});
