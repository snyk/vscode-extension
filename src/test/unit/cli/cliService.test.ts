import { strictEqual } from 'assert';
import sinon, { stub } from 'sinon';
import { IStaticCliApi } from '../../../snyk/cli/api/staticCliApi';
import { CliDownloader } from '../../../snyk/cli/downloader';
import { ILog } from '../../../snyk/common/logger/interfaces';
import { IVSCodeWindow } from '../../../snyk/common/vscode/window';
import { LoggerMock } from '../mocks/logger.mock';

import { CliExecutable } from '../../../snyk/cli/cliExecutable';
import { Checksum } from '../../../snyk/cli/checksum';
import { CliService } from '../../../snyk/cli/cliService';
import { ExtensionContext } from '../../../snyk/common/vscode/extensionContext';
import { MEMENTO_CLI_LAST_UPDATE_DATE, MEMENTO_CLI_VERSION_KEY } from '../../../snyk/common/constants/globalState';

suite('CliService', () => {
  let logger: ILog;
  let api: IStaticCliApi;
  let window: IVSCodeWindow;
  let context: ExtensionContext;
  let downloader: CliDownloader;

  // Stubbed functions to re-wrap
  let contextGetGlobalStateValue: sinon.SinonStub;
  let apiGetLatestVersion: sinon.SinonStub;

  setup(() => {
    contextGetGlobalStateValue = sinon.stub();
    apiGetLatestVersion = sinon.stub();

    window = {
      withProgress: sinon.fake(),
    };
    api = {
      getDownloadUrl: sinon.fake(),
      getExecutable: sinon.fake(),
      getLatestVersion: apiGetLatestVersion,
      getSha256Checksum: sinon.fake(),
    };
    logger = new LoggerMock();
    context = {
      extensionPath: 'test/path',
      getGlobalStateValue: contextGetGlobalStateValue,
      updateGlobalStateValue: sinon.fake(),
      setContext: sinon.fake(),
      subscriptions: [],
    };

    downloader = new CliDownloader(api, context.extensionPath, window, logger);
  });

  teardown(() => {
    sinon.restore();
  });

  test('Tries to download if not installed', async () => {
    const service = new CliService(context, api, window, logger, downloader);
    stub(service, 'isInstalled').resolves(false);
    const downloadSpy = stub(service, 'downloadCli');
    const updateSpy = stub(service, 'updateCli');

    await service.downloadOrUpdateCli();

    strictEqual(downloadSpy.calledOnce, true);
    strictEqual(updateSpy.called, false);
  });

  test('Tries to update if installed', async () => {
    const service = new CliService(context, api, window, logger, downloader);
    stub(service, 'isInstalled').resolves(true);
    const downloadSpy = stub(service, 'downloadCli');
    const updateSpy = stub(service, 'updateCli');

    await service.downloadOrUpdateCli();

    strictEqual(downloadSpy.called, false);
    strictEqual(updateSpy.calledOnce, true);
  });

  test('Updates if >4 days passed since last update and new version available', async () => {
    const service = new CliService(context, api, window, logger, downloader);
    stub(service, 'isInstalled').resolves(true);

    const fiveDaysInMs = 5 * 24 * 3600 * 1000;
    const [currentVersion, latestVersion] = ['1.0.0', '1.0.1'];

    contextGetGlobalStateValue.withArgs(MEMENTO_CLI_LAST_UPDATE_DATE).returns(Date.now() - fiveDaysInMs);
    contextGetGlobalStateValue.withArgs(MEMENTO_CLI_VERSION_KEY).returns(currentVersion);
    apiGetLatestVersion.returns(latestVersion);

    sinon.stub(downloader, 'download').resolves(new CliExecutable(latestVersion, new Checksum('test')));

    const updated = await service.updateCli();

    strictEqual(updated, true);
  });

  test("Doesn't update if >4 days passed since last update but no new version available", async () => {
    const service = new CliService(context, api, window, logger, downloader);
    stub(service, 'isInstalled').resolves(true);

    const fiveDaysInMs = 5 * 24 * 3600 * 1000;
    const [currentVersion, latestVersion] = ['1.0.0', '1.0.0'];

    contextGetGlobalStateValue.withArgs(MEMENTO_CLI_LAST_UPDATE_DATE).returns(Date.now() - fiveDaysInMs);
    contextGetGlobalStateValue.withArgs(MEMENTO_CLI_VERSION_KEY).returns(currentVersion);
    apiGetLatestVersion.returns(latestVersion);

    sinon.stub(downloader, 'download').resolves(new CliExecutable(latestVersion, new Checksum('test')));

    const updated = await service.updateCli();

    strictEqual(updated, false);
  });

  test("Doesn't update if 3 days passed since last update", async () => {
    const service = new CliService(context, api, window, logger, downloader);
    stub(service, 'isInstalled').resolves(true);

    const threeDaysInMs = 3 * 24 * 3600 * 1000;
    contextGetGlobalStateValue.withArgs(MEMENTO_CLI_LAST_UPDATE_DATE).returns(Date.now() - threeDaysInMs);

    sinon.stub(downloader, 'download').resolves(new CliExecutable('1.0.0', new Checksum('test')));

    const updated = await service.updateCli();

    strictEqual(updated, false);
  });
});
