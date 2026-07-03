import { strictEqual } from 'assert';
import sinon from 'sinon';
import { IConfiguration } from '../../../snyk/common/configuration/configuration';
import { WorkspaceTrust } from '../../../snyk/common/configuration/trustedFolders';
import { ILanguageServer } from '../../../snyk/common/languageServer/languageServer';
import { OssIssueData, ScanProduct, ScanStatus } from '../../../snyk/common/languageServer/types';
import { IProductService } from '../../../snyk/common/services/productService';
import { ICodeActionAdapter, ICodeActionKindAdapter } from '../../../snyk/common/vscode/codeAction';
import { ExtensionContext } from '../../../snyk/common/vscode/extensionContext';
import { IVSCodeLanguages } from '../../../snyk/common/vscode/languages';
import { IVSCodeWorkspace } from '../../../snyk/common/vscode/workspace';
import { IOssSuggestionWebviewProvider } from '../../../snyk/snykOss/interfaces';
import { OssService } from '../../../snyk/snykOss/ossService';
import { LanguageServerMock } from '../mocks/languageServer.mock';
import { LoggerMock } from '../mocks/logger.mock';
import { IDiagnosticsIssueProvider } from '../../../snyk/common/services/diagnosticsService';

suite('OSS Service', () => {
  let ls: ILanguageServer;
  let service: IProductService<OssIssueData>;

  setup(() => {
    ls = new LanguageServerMock();

    service = new OssService(
      {} as ExtensionContext,
      {} as IConfiguration,
      {} as IOssSuggestionWebviewProvider,
      {} as ICodeActionAdapter,
      { getQuickFix: sinon.fake() } as ICodeActionKindAdapter,
      {
        getWorkspaceFolderPaths: () => [''],
      } as IVSCodeWorkspace,
      new WorkspaceTrust(),
      ls,
      {
        registerCodeActionsProvider: sinon.fake(),
      } as unknown as IVSCodeLanguages,
      {} as unknown as IDiagnosticsIssueProvider<OssIssueData>,
      new LoggerMock(),
    );
  });

  teardown(() => {
    sinon.restore();
  });

  test('Scan returned for OSS product', () => {
    ls.scan$.next({
      product: ScanProduct.OpenSource,
      folderPath: 'test/path',
      status: ScanStatus.InProgress,
    });

    strictEqual(service.isAnalysisRunning, true);
  });

  test('Scan not returned for non-OSS product', () => {
    ls.scan$.next({
      product: ScanProduct.Code,
      folderPath: 'test/path',
      status: ScanStatus.InProgress,
    });

    strictEqual(service.isAnalysisRunning, false);
  });
});
