import { strictEqual } from 'assert';
import sinon, { stub } from 'sinon';
import { Checksum } from '../../../../snyk/cli/checksum';
import { IConfiguration } from '../../../../snyk/common/configuration/configuration';
import { Downloader } from '../../../../snyk/common/download/downloader';
import { CliExecutable } from '../../../../snyk/cli/cliExecutable';
import { IStaticCliApi } from '../../../../snyk/cli/staticCliApi';
import { ILog } from '../../../../snyk/common/logger/interfaces';
import { Platform } from '../../../../snyk/common/platform';
import { DownloadService } from '../../../../snyk/common/services/downloadService';
import { ExtensionContext } from '../../../../snyk/common/vscode/extensionContext';
import { LoggerMock } from '../../mocks/logger.mock';
import { windowMock } from '../../mocks/window.mock';

suite('DownloadService', () => {
  let logger: ILog;
  let cliApi: IStaticCliApi;
  let context: ExtensionContext;
  let downloader: Downloader;
  let configuration: IConfiguration;

  // Stubbed functions to re-wrap
  let contextGetGlobalStateValue: sinon.SinonStub;
  let apigetSha256Checksum: sinon.SinonStub;

  setup(() => {
    contextGetGlobalStateValue = sinon.stub();
    apigetSha256Checksum = sinon.stub();

    cliApi = {
      getLatestCliVersion: sinon.fake(),
      downloadBinary: sinon.fake(),
      getSha256Checksum: apigetSha256Checksum,
    };

    logger = new LoggerMock();

    context = {
      extensionPath: 'test/path',
      getGlobalStateValue: contextGetGlobalStateValue,
      updateGlobalStateValue: sinon.fake(),
      setContext: sinon.fake(),
      subscriptions: [],
      addDisposables: sinon.fake(),
      getExtensionUri: sinon.fake(),
    } as unknown as ExtensionContext;

    configuration = {
      isAutomaticDependencyManagementEnabled: () => true,
      getCliReleaseChannel: () => Promise.resolve('stable'),
      getCliPath: () => Promise.resolve('path/to/cli'),
    } as IConfiguration;

    downloader = new Downloader(configuration, cliApi, windowMock, logger, context);
  });

  teardown(() => {
    sinon.restore();
  });

  test('Tries to download CLI if not installed', async () => {
    configuration = {
      isAutomaticDependencyManagementEnabled: () => true,
      getCliReleaseChannel: () => Promise.resolve('stable'),
      getCliPath: () => Promise.resolve('path/to/cli'),
    } as IConfiguration;
    const service = new DownloadService(context, configuration, cliApi, windowMock, logger, downloader);
    const downloadSpy = stub(service, 'download');
    const updateSpy = stub(service, 'update');
    await service.downloadOrUpdate();

    strictEqual(downloadSpy.calledOnce, true);
    strictEqual(updateSpy.called, false);
  });

  test('Tries to update CLI if installed', async () => {
    configuration = {
      isAutomaticDependencyManagementEnabled: () => true,
      getCliReleaseChannel: () => Promise.resolve('stable'),
      getCliPath: () => Promise.resolve('path/to/cli'),
    } as IConfiguration;
    const service = new DownloadService(context, configuration, cliApi, windowMock, logger, downloader);
    stub(service, 'isCliInstalled').resolves(true);
    const downloadSpy = stub(service, 'download');
    const updateSpy = stub(service, 'update');

    await service.downloadOrUpdate();

    strictEqual(downloadSpy.called, false);
    strictEqual(updateSpy.calledOnce, true);
  });

  test("Doesn't download CLI if automatic dependency management disabled", async () => {
    configuration = {
      isAutomaticDependencyManagementEnabled: () => false,
      getCliReleaseChannel: () => Promise.resolve('stable'),
      getCliPath: () => Promise.resolve('path/to/cli'),
    } as IConfiguration;
    const service = new DownloadService(context, configuration, cliApi, windowMock, logger, downloader);
    stub(service, 'isCliInstalled').resolves(false);
    const downloadSpy = stub(service, 'download');
    const updateSpy = stub(service, 'update');

    const downloaded = await service.downloadOrUpdate();

    strictEqual(downloaded, false);
    strictEqual(downloadSpy.called, false);
    strictEqual(updateSpy.called, false);
  });
});


