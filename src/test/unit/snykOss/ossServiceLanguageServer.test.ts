import { strictEqual } from 'assert';
import sinon from 'sinon';
import { IAnalytics } from '../../../snyk/common/analytics/itly';
import { IConfiguration } from '../../../snyk/common/configuration/configuration';
import { WorkspaceTrust } from '../../../snyk/common/configuration/trustedFolders';
import { ILanguageServer } from '../../../snyk/common/languageServer/languageServer';
import { OssIssueData, ScanProduct, ScanStatus } from '../../../snyk/common/languageServer/types';
import { IProductService } from '../../../snyk/common/services/productService';
import { IViewManagerService } from '../../../snyk/common/services/viewManagerService';
import { ICodeActionAdapter, ICodeActionKindAdapter } from '../../../snyk/common/vscode/codeAction';
import { ExtensionContext } from '../../../snyk/common/vscode/extensionContext';
import { IVSCodeLanguages } from '../../../snyk/common/vscode/languages';
import { IVSCodeWorkspace } from '../../../snyk/common/vscode/workspace';
import { OssServiceLanguageServer } from '../../../snyk/snykOss/ossServiceLanguageServer';
import { OssDetailPanelProvider } from '../../../snyk/snykOss/providers/ossDetailPanelProvider';
import { LanguageServerMock } from '../mocks/languageServer.mock';
import { LoggerMock } from '../mocks/logger.mock';

suite('OSS Service', () => {
  let ls: ILanguageServer;
  let service: IProductService<OssIssueData>;
  let refreshViewFake: sinon.SinonSpy;

  setup(() => {
    ls = new LanguageServerMock();
    refreshViewFake = sinon.fake();

    const viewManagerService = {
      refreshOssView: refreshViewFake,
    } as unknown as IViewManagerService;

    service = new OssServiceLanguageServer(
      {} as ExtensionContext,
      {} as IConfiguration,
      {} as OssDetailPanelProvider,
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
      new LoggerMock(),
      {} as IAnalytics,
    );
  });

  teardown(() => {
    sinon.restore();
  });

  test('Scan returned for OSS product', () => {
    ls.scan$.next({
      product: ScanProduct.OpenSource,
      folderPath: 'test/path',
      issues: [],
      status: ScanStatus.InProgress,
    });

    strictEqual(service.isAnalysisRunning, true);
    sinon.assert.calledOnce(refreshViewFake);
  });

  test('Scan not returned for non-OSS product', () => {
    ls.scan$.next({
      product: ScanProduct.Code,
      folderPath: 'test/path',
      issues: [],
      status: ScanStatus.InProgress,
    });

    strictEqual(service.isAnalysisRunning, false);
    sinon.assert.notCalled(refreshViewFake);
  });
});
