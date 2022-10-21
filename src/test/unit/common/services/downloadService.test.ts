import { strictEqual } from 'assert';
import sinon, { stub } from 'sinon';
import { Checksum } from '../../../../snyk/cli/checksum';
import { CliExecutable } from '../../../../snyk/cli/cliExecutable';
import { IConfiguration } from '../../../../snyk/common/configuration/configuration';
import { MEMENTO_LS_CHECKSUM, MEMENTO_LS_LAST_UPDATE_DATE } from '../../../../snyk/common/constants/globalState';
import { Downloader } from '../../../../snyk/common/download/downloader';
import { LsExecutable } from '../../../../snyk/common/languageServer/lsExecutable';
import { IStaticLsApi } from '../../../../snyk/common/languageServer/staticLsApi';
import { ILog } from '../../../../snyk/common/logger/interfaces';
import { Platform } from '../../../../snyk/common/platform';
import { DownloadService } from '../../../../snyk/common/services/downloadService';
import { ExtensionContext } from '../../../../snyk/common/vscode/extensionContext';
import { LoggerMock } from '../../mocks/logger.mock';
import { windowMock } from '../../mocks/window.mock';

suite('DownloadService', () => {
  let logger: ILog;
  let lsApi: IStaticLsApi;
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
      getDownloadUrl: sinon.fake(),
      downloadBinary: sinon.fake(),
      getMetadata: sinon.fake(),
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
      getSnykLanguageServerPath: () => 'ab/c',
    } as unknown as IConfiguration;

    downloader = new Downloader(configuration, lsApi, windowMock, logger);
  });

  teardown(() => {
    sinon.restore();
  });

  test('Tries to download LS if not installed', async () => {
    configuration = {
      isAutomaticDependencyManagementEnabled: () => true,
      getCustomCliPath: () => undefined,
      getSnykLanguageServerPath: () => 'abc/d',
    } as unknown as IConfiguration;
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
      getCustomCliPath: () => undefined,
      getSnykLanguageServerPath: () => 'abc/d',
    } as unknown as IConfiguration;
    const service = new DownloadService(context, configuration, lsApi, windowMock, logger, downloader);
    stub(service, 'isLsInstalled').resolves(true);
    const downloadSpy = stub(service, 'download');
    const updateSpy = stub(service, 'update');

    await service.downloadOrUpdate();

    strictEqual(downloadSpy.called, false);
    strictEqual(updateSpy.calledOnce, true);
  });

  test('Updates LS if >4 days passed since last update and new version available', async () => {
    configuration = {
      isAutomaticDependencyManagementEnabled: () => true,
      getCustomCliPath: () => undefined,
      getSnykLanguageServerPath: () => 'abc/d',
    } as unknown as IConfiguration;
    const service = new DownloadService(context, configuration, lsApi, windowMock, logger, downloader);
    stub(service, 'isLsInstalled').resolves(true);

    const fiveDaysInMs = 5 * 24 * 3600 * 1000;

    contextGetGlobalStateValue.withArgs(MEMENTO_LS_LAST_UPDATE_DATE).returns(Date.now() - fiveDaysInMs);

    const curChecksumStr = 'ba6b3c08ce5b9067ecda4f410e3b6c2662e01c064490994555f57b1cc25840f9';
    const latestChecksumStr = 'bdf6446bfaed1ae551b6eca14e8e101a53d855d33622094495e68e9a0b0069fc';
    const latestChecksum = Checksum.fromDigest(curChecksumStr, latestChecksumStr);
    apigetSha256Checksum.returns(latestChecksumStr);

    sinon.stub(Platform, 'getCurrent').returns('darwin');
    sinon.stub(Checksum, 'getChecksumOf').resolves(latestChecksum);
    sinon.stub(downloader, 'download').resolves(new LsExecutable('1.0.1', new Checksum(latestChecksumStr)));

    const updated = await service.update();

    strictEqual(updated, true);
  });

  test("Doesn't update LS if >4 days passed since last update but no new version available", async () => {
    configuration = {
      isAutomaticDependencyManagementEnabled: () => true,
      getCustomCliPath: () => undefined,
      getSnykLanguageServerPath: () => 'abc/d',
    } as unknown as IConfiguration;
    const service = new DownloadService(context, configuration, lsApi, windowMock, logger, downloader);
    stub(service, 'isLsInstalled').resolves(true);

    const fiveDaysInMs = 5 * 24 * 3600 * 1000;

    contextGetGlobalStateValue.withArgs(MEMENTO_LS_LAST_UPDATE_DATE).returns(Date.now() - fiveDaysInMs);

    const curChecksumStr = 'ba6b3c08ce5b9067ecda4f410e3b6c2662e01c064490994555f57b1cc25840f9';
    const latestChecksumStr = 'ba6b3c08ce5b9067ecda4f410e3b6c2662e01c064490994555f57b1cc25840f9';
    const latestChecksum = Checksum.fromDigest(curChecksumStr, latestChecksumStr);
    apigetSha256Checksum.returns(latestChecksumStr);

    sinon.stub(Platform, 'getCurrent').returns('darwin');
    sinon.stub(Checksum, 'getChecksumOf').resolves(latestChecksum);
    sinon.stub(downloader, 'download').resolves(new LsExecutable('1.0.0', new Checksum(latestChecksumStr)));

    const updated = await service.update();

    strictEqual(updated, false);
  });

  test("Doesn't update LS if 3 days passed since last update", async () => {
    const service = new DownloadService(context, configuration, lsApi, windowMock, logger, downloader);
    stub(service, 'isLsInstalled').resolves(true);

    const threeDaysInMs = 3 * 24 * 3600 * 1000;
    contextGetGlobalStateValue.withArgs(MEMENTO_LS_LAST_UPDATE_DATE).returns(Date.now() - threeDaysInMs);

    sinon.stub(downloader, 'download').resolves(new LsExecutable('1.0.0', new Checksum('test')));

    const updated = await service.update();

    strictEqual(updated, false);
  });

  test("Doesn't try to update if last LS update date was not set", async () => {
    configuration = {
      isAutomaticDependencyManagementEnabled: () => true,
      getCustomCliPath: () => undefined,
      getSnykLanguageServerPath: () => 'abc/d',
    } as unknown as IConfiguration;
    const service = new DownloadService(context, configuration, lsApi, windowMock, logger, downloader);
    contextGetGlobalStateValue.withArgs(MEMENTO_LS_CHECKSUM).returns(undefined);
    contextGetGlobalStateValue.withArgs(MEMENTO_LS_LAST_UPDATE_DATE).returns(undefined);

    stub(CliExecutable, 'exists').resolves(true);

    const downloadSpy = stub(service, 'download');
    const updateSpy = stub(service, 'update');

    await service.downloadOrUpdate();

    strictEqual(downloadSpy.called, true);
    strictEqual(updateSpy.calledOnce, false);
  });

  test("Doesn't download LS if automatic dependency management disabled", async () => {
    configuration = {
      isAutomaticDependencyManagementEnabled: () => false,
      getCustomCliPath: () => undefined,
      getSnykLanguageServerPath: () => 'abc/d',
    } as unknown as IConfiguration;
    const service = new DownloadService(context, configuration, lsApi, windowMock, logger, downloader);
    stub(service, 'isLsInstalled').resolves(false);
    const downloadSpy = stub(service, 'download');
    const updateSpy = stub(service, 'update');

    const downloaded = await service.downloadOrUpdate();

    strictEqual(downloaded, false);
    strictEqual(downloadSpy.called, false);
    strictEqual(updateSpy.called, false);
  });
});
