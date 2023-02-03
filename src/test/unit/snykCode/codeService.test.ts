import { strictEqual } from 'assert';
import sinon from 'sinon';
import { IAnalytics } from '../../../snyk/common/analytics/itly';
import { IConfiguration } from '../../../snyk/common/configuration/configuration';
import { WorkspaceTrust } from '../../../snyk/common/configuration/trustedFolders';
import { ILanguageServer } from '../../../snyk/common/languageServer/languageServer';
import { ScanProduct, ScanStatus } from '../../../snyk/common/languageServer/types';
import { IViewManagerService } from '../../../snyk/common/services/viewManagerService';
import { ICodeActionAdapter, ICodeActionKindAdapter } from '../../../snyk/common/vscode/codeAction';
import { ExtensionContext } from '../../../snyk/common/vscode/extensionContext';
import { IVSCodeWindow } from '../../../snyk/common/vscode/window';
import { IVSCodeWorkspace } from '../../../snyk/common/vscode/workspace';
import { ISnykCodeService, SnykCodeService } from '../../../snyk/snykCode/codeService';
import { ICodeSuggestionWebviewProvider } from '../../../snyk/snykCode/views/interfaces';
import { languagesMock } from '../mocks/languages.mock';
import { LanguageServerMock } from '../mocks/languageServer.mock';
import { LoggerMock } from '../mocks/logger.mock';

suite('Snyk Code Service', () => {
  let ls: ILanguageServer;
  let service: ISnykCodeService;
  let refreshViewFake: sinon.SinonSpy;

  setup(() => {
    ls = new LanguageServerMock();
    refreshViewFake = sinon.fake();
    service = new SnykCodeService(
      {} as ExtensionContext,
      {} as IConfiguration,
      {} as ICodeSuggestionWebviewProvider,
      {} as ICodeActionAdapter,
      {
        getQuickFix: sinon.fake(),
      } as ICodeActionKindAdapter,
      {
        refreshAllCodeAnalysisViews: refreshViewFake,
      } as unknown as IViewManagerService,
      {
        getWorkspaceFolders: () => [''],
      } as IVSCodeWorkspace,
      new WorkspaceTrust(),
      ls,
      {} as IVSCodeWindow,
      languagesMock,
      new LoggerMock(),
      {} as IAnalytics,
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
      product: ScanProduct.Code,
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
      product: ScanProduct.Code,
      folderPath,
      issues: [],
      status: ScanStatus.InProgress,
    });
    ls.scan$.next({
      product: ScanProduct.Code,
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
      product: ScanProduct.Code,
      folderPath,
      issues: [],
      status: ScanStatus.InProgress,
    });
    ls.scan$.next({
      product: ScanProduct.Code,
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
      product: ScanProduct.Code,
      folderPath: folder1Path,
      issues: [],
      status: ScanStatus.InProgress,
    });
    ls.scan$.next({
      product: ScanProduct.Code,
      folderPath: folder2Path,
      issues: [],
      status: ScanStatus.InProgress,
    });
    ls.scan$.next({
      product: ScanProduct.Code,
      folderPath: folder1Path,
      issues: [],
      status: ScanStatus.Success,
    });

    strictEqual(service.isAnalysisRunning, true);

    ls.scan$.next({
      product: ScanProduct.Code,
      folderPath: folder2Path,
      issues: [],
      status: ScanStatus.Success,
    });

    strictEqual(service.isAnalysisRunning, false);
    sinon.assert.calledTwice(refreshViewFake);
  });
});
