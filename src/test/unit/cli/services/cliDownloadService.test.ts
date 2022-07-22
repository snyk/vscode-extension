import { strictEqual } from 'assert';
import sinon, { stub } from 'sinon';
import { IStaticCliApi } from '../../../../snyk/cli/api/staticCliApi';
import { Checksum } from '../../../../snyk/cli/checksum';
import { CliExecutable } from '../../../../snyk/cli/cliExecutable';
import { CliDownloader } from '../../../../snyk/cli/downloader';
import { CliDownloadService } from '../../../../snyk/cli/services/cliDownloadService';
import { IConfiguration } from '../../../../snyk/common/configuration/configuration';
import { MEMENTO_CLI_CHECKSUM, MEMENTO_CLI_LAST_UPDATE_DATE } from '../../../../snyk/common/constants/globalState';
import { ILog } from '../../../../snyk/common/logger/interfaces';
import { Platform } from '../../../../snyk/common/platform';
import { ExtensionContext } from '../../../../snyk/common/vscode/extensionContext';
import { LoggerMock } from '../../mocks/logger.mock';
import { windowMock } from '../../mocks/window.mock';

suite('CliDownloadService', () => {
  let logger: ILog;
  let api: IStaticCliApi;
  let context: ExtensionContext;
  let downloader: CliDownloader;
  let configuration: IConfiguration;

  // Stubbed functions to re-wrap
  let contextGetGlobalStateValue: sinon.SinonStub;
  let apigetSha256Checksum: sinon.SinonStub;

  setup(() => {
    contextGetGlobalStateValue = sinon.stub();
    apigetSha256Checksum = sinon.stub();

    api = {
      getDownloadUrl: sinon.fake(),
      getExecutable: sinon.fake(),
      getLatestVersion: sinon.fake(),
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
      getCustomCliPath: () => undefined,
    } as IConfiguration;

    downloader = new CliDownloader(configuration, api, context.extensionPath, windowMock, logger);
  });

  teardown(() => {
    sinon.restore();
  });

  test('Tries to download if not installed', async () => {
    const service = new CliDownloadService(context, configuration, api, windowMock, logger, downloader);
    stub(service, 'isInstalled').resolves(false);
    const downloadSpy = stub(service, 'downloadCli');
    const updateSpy = stub(service, 'updateCli');
    await service.downloadOrUpdateCli();

    strictEqual(downloadSpy.calledOnce, true);
    strictEqual(updateSpy.called, false);
  });

  test('Tries to update if installed', async () => {
    const service = new CliDownloadService(context, configuration, api, windowMock, logger, downloader);
    stub(service, 'isInstalled').resolves(true);
    const downloadSpy = stub(service, 'downloadCli');
    const updateSpy = stub(service, 'updateCli');

    await service.downloadOrUpdateCli();

    strictEqual(downloadSpy.called, false);
    strictEqual(updateSpy.calledOnce, true);
  });

  test('Updates if >4 days passed since last update and new version available', async () => {
    const service = new CliDownloadService(context, configuration, api, windowMock, logger, downloader);
    stub(service, 'isInstalled').resolves(true);

    const fiveDaysInMs = 5 * 24 * 3600 * 1000;

    contextGetGlobalStateValue.withArgs(MEMENTO_CLI_LAST_UPDATE_DATE).returns(Date.now() - fiveDaysInMs);

    const curChecksumStr = 'ba6b3c08ce5b9067ecda4f410e3b6c2662e01c064490994555f57b1cc25840f9';
    const latestChecksumStr = 'bdf6446bfaed1ae551b6eca14e8e101a53d855d33622094495e68e9a0b0069fc';
    const latestChecksum = Checksum.fromDigest(curChecksumStr, latestChecksumStr);
    apigetSha256Checksum.returns(latestChecksumStr);

    sinon.stub(Platform, 'getCurrent').returns('darwin');
    sinon.stub(Checksum, 'getChecksumOf').resolves(latestChecksum);
    sinon.stub(downloader, 'download').resolves(new CliExecutable('1.0.1', new Checksum(latestChecksumStr)));

    const updated = await service.updateCli();

    strictEqual(updated, true);
  });

  test("Doesn't update if >4 days passed since last update but no new version available", async () => {
    const service = new CliDownloadService(context, configuration, api, windowMock, logger, downloader);
    stub(service, 'isInstalled').resolves(true);

    const fiveDaysInMs = 5 * 24 * 3600 * 1000;

    contextGetGlobalStateValue.withArgs(MEMENTO_CLI_LAST_UPDATE_DATE).returns(Date.now() - fiveDaysInMs);

    const curChecksumStr = 'ba6b3c08ce5b9067ecda4f410e3b6c2662e01c064490994555f57b1cc25840f9';
    const latestChecksumStr = 'ba6b3c08ce5b9067ecda4f410e3b6c2662e01c064490994555f57b1cc25840f9';
    const latestChecksum = Checksum.fromDigest(curChecksumStr, latestChecksumStr);
    apigetSha256Checksum.returns(latestChecksumStr);

    sinon.stub(Platform, 'getCurrent').returns('darwin');
    sinon.stub(Checksum, 'getChecksumOf').resolves(latestChecksum);
    sinon.stub(downloader, 'download').resolves(new CliExecutable('1.0.0', new Checksum(latestChecksumStr)));

    const updated = await service.updateCli();

    strictEqual(updated, false);
  });

  test("Doesn't update if 3 days passed since last update", async () => {
    const service = new CliDownloadService(context, configuration, api, windowMock, logger, downloader);
    stub(service, 'isInstalled').resolves(true);

    const threeDaysInMs = 3 * 24 * 3600 * 1000;
    contextGetGlobalStateValue.withArgs(MEMENTO_CLI_LAST_UPDATE_DATE).returns(Date.now() - threeDaysInMs);

    sinon.stub(downloader, 'download').resolves(new CliExecutable('1.0.0', new Checksum('test')));

    const updated = await service.updateCli();

    strictEqual(updated, false);
  });

  test("Doesn't try to update if last cli update date was not set", async () => {
    const service = new CliDownloadService(context, configuration, api, windowMock, logger, downloader);
    contextGetGlobalStateValue.withArgs(MEMENTO_CLI_CHECKSUM).returns(undefined);
    contextGetGlobalStateValue.withArgs(MEMENTO_CLI_LAST_UPDATE_DATE).returns(undefined);

    stub(CliExecutable, 'exists').resolves(true);

    const downloadSpy = stub(service, 'downloadCli');
    const updateSpy = stub(service, 'updateCli');

    await service.downloadOrUpdateCli();

    strictEqual(downloadSpy.called, true);
    strictEqual(updateSpy.calledOnce, false);
  });

  test("Doesn't try to update if last cli update date was not set", async () => {
    const service = new CliDownloadService(context, configuration, api, windowMock, logger, downloader);
    contextGetGlobalStateValue.withArgs(MEMENTO_CLI_CHECKSUM).returns(undefined);
    contextGetGlobalStateValue.withArgs(MEMENTO_CLI_LAST_UPDATE_DATE).returns(undefined);

    stub(CliExecutable, 'exists').resolves(true);

    const downloadSpy = stub(service, 'downloadCli');
    const updateSpy = stub(service, 'updateCli');

    await service.downloadOrUpdateCli();

    strictEqual(downloadSpy.called, true);
    strictEqual(updateSpy.calledOnce, false);
  });

  test("Doesn't download if automatic dependency management disabled", async () => {
    const service = new CliDownloadService(context, configuration, api, windowMock, logger, downloader);
    configuration.isAutomaticDependencyManagementEnabled = () => false;
    stub(service, 'isInstalled').resolves(false);
    const downloadSpy = stub(service, 'downloadCli');
    const updateSpy = stub(service, 'updateCli');

    const downloaded = await service.downloadOrUpdateCli();

    strictEqual(downloaded, false);
    strictEqual(downloadSpy.called, false);
    strictEqual(updateSpy.called, false);
  });
});
