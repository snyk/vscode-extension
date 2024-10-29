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
  let lsApi: IStaticCliApi;
  let context: ExtensionContext;
  let downloader: Downloader;
  let configuration: IConfiguration;

  // Stubbed functions to re-wrap
  let contextGetGlobalStateValue: sinon.SinonStub;
  let apigetSha256Checksum: sinon.SinonStub;

  setup(() => {
    contextGetGlobalStateValue = sinon.stub();
    apigetSha256Checksum = sinon.stub();

    lsApi = {
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
      getCliReleaseChannel: () => 'stable',
      getCliPath: () => Promise.resolve('path/to/cli'),
    } as IConfiguration;

    downloader = new Downloader(configuration, lsApi, windowMock, logger, context);
  });

  teardown(() => {
    sinon.restore();
  });

  test('Tries to download LS if not installed', async () => {
    configuration = {
      isAutomaticDependencyManagementEnabled: () => true,
      getCliReleaseChannel: () => 'stable',
      getCliPath: () => Promise.resolve('path/to/cli'),
    } as IConfiguration;
    const service = new DownloadService(context, configuration, lsApi, windowMock, logger, downloader);
    const downloadSpy = stub(service, 'download');
    const updateSpy = stub(service, 'update');
    await service.downloadOrUpdate();

    strictEqual(downloadSpy.calledOnce, true);
    strictEqual(updateSpy.called, false);
  });

  test('Tries to update LS if installed', async () => {
    configuration = {
      isAutomaticDependencyManagementEnabled: () => true,
      getCliReleaseChannel: () => 'stable',
      getCliPath: () => Promise.resolve('path/to/cli'),
    } as IConfiguration;
    const service = new DownloadService(context, configuration, lsApi, windowMock, logger, downloader);
    stub(service, 'isCliInstalled').resolves(true);
    const downloadSpy = stub(service, 'download');
    const updateSpy = stub(service, 'update');

    await service.downloadOrUpdate();

    strictEqual(downloadSpy.called, false);
    strictEqual(updateSpy.calledOnce, true);
  });

  test("Doesn't download LS if automatic dependency management disabled", async () => {
    configuration = {
      isAutomaticDependencyManagementEnabled: () => false,
      getCliReleaseChannel: () => 'stable',
      getCliPath: () => Promise.resolve('path/to/cli'),
    } as IConfiguration;
    const service = new DownloadService(context, configuration, lsApi, windowMock, logger, downloader);
    stub(service, 'isCliInstalled').resolves(false);
    const downloadSpy = stub(service, 'download');
    const updateSpy = stub(service, 'update');

    const downloaded = await service.downloadOrUpdate();

    strictEqual(downloaded, false);
    strictEqual(downloadSpy.called, false);
    strictEqual(updateSpy.called, false);
  });
});

function stubSuccessDownload(apigetSha256Checksum: sinon.SinonStub, downloader: Downloader) {
  const curChecksumStr = 'ba6b3c08ce5b9067ecda4f410e3b6c2662e01c064490994555f57b1cc25840f9';
  const latestChecksumStr = 'bdf6446bfaed1ae551b6eca14e8e101a53d855d33622094495e68e9a0b0069fc';
  const latestChecksum = Checksum.fromDigest(curChecksumStr, latestChecksumStr);
  apigetSha256Checksum.returns(latestChecksumStr);

  sinon.stub(Platform, 'getCurrent').returns('darwin');
  sinon.stub(Checksum, 'getChecksumOf').resolves(latestChecksum);
  sinon.stub(downloader, 'download').resolves(new CliExecutable('1.0.1', new Checksum(latestChecksumStr)));
}
