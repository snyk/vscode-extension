import { strictEqual } from 'assert';
import sinon, { stub } from 'sinon';
import { firstValueFrom } from 'rxjs';
import { IConfiguration } from '../../../../snyk/common/configuration/configuration';
import { Downloader } from '../../../../snyk/common/download/downloader';
import { IStaticCliApi } from '../../../../snyk/cli/staticCliApi';
import { ILog } from '../../../../snyk/common/logger/interfaces';
import { DownloadService } from '../../../../snyk/common/services/downloadService';
import { ExtensionContext } from '../../../../snyk/common/vscode/extensionContext';
import { MEMENTO_CLI_VERSION, MEMENTO_LS_PROTOCOL_VERSION } from '../../../../snyk/common/constants/globalState';
import { Checksum } from '../../../../snyk/cli/checksum';
import { CliExecutable } from '../../../../snyk/cli/cliExecutable';
import { messages } from '../../../../snyk/cli/messages/messages';
import { PROTOCOL_VERSION } from '../../../../snyk/common/constants/languageServer';
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
  let contextUpdateGlobalStateValue: sinon.SinonStub;
  let apigetSha256Checksum: sinon.SinonStub;

  setup(() => {
    contextGetGlobalStateValue = sinon.stub();
    contextUpdateGlobalStateValue = sinon.stub().resolves();
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
      updateGlobalStateValue: contextUpdateGlobalStateValue,
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
    stub(service, 'isCliInstalled').resolves(true);
    const downloadSpy = stub(service, 'download');
    const updateSpy = stub(service, 'update');

    const downloaded = await service.downloadOrUpdate();

    strictEqual(downloaded, false);
    strictEqual(downloadSpy.called, false);
    strictEqual(updateSpy.called, false);
  });

  test('download() stores LSP protocol version after successful download', async () => {
    const mockChecksum = Checksum.fromDigest('abc123', 'abc123');
    const mockExecutable = { version: '1.1300.0', checksum: mockChecksum };

    const service = new DownloadService(context, configuration, cliApi, windowMock, logger, downloader);
    stub(downloader, 'download').resolves(mockExecutable as never);

    await service.download();

    // Verify that the LSP protocol version was stored
    const lspVersionStored = contextUpdateGlobalStateValue
      .getCalls()
      .some((call: sinon.SinonSpyCall) => call.args[0] === MEMENTO_LS_PROTOCOL_VERSION);
    strictEqual(lspVersionStored, true, 'download() should store LSP protocol version');
  });

  test('downloadOrUpdate() emits downloadReady$ even when update() throws', async () => {
    configuration = {
      isAutomaticDependencyManagementEnabled: () => true,
      getCliReleaseChannel: () => Promise.resolve('stable'),
      getCliPath: () => Promise.resolve('path/to/cli'),
    } as IConfiguration;
    const service = new DownloadService(context, configuration, cliApi, windowMock, logger, downloader);
    stub(service, 'isCliInstalled').resolves(true);
    stub(service, 'update').rejects(new Error('Network error'));

    // downloadOrUpdate should still emit downloadReady$ even on error
    let readyEmitted = false;
    const readyPromise = firstValueFrom(service.downloadReady$).then(() => {
      readyEmitted = true;
    });

    try {
      await service.downloadOrUpdate();
    } catch {
      // expected to throw
    }

    // Wait a tick for the ReplaySubject emission
    await readyPromise;
    strictEqual(readyEmitted, true, 'downloadReady$ should be emitted even when update() throws');
  });

  test('downloadOrUpdate() emits downloadReady$ even when download() throws', async () => {
    configuration = {
      isAutomaticDependencyManagementEnabled: () => true,
      getCliReleaseChannel: () => Promise.resolve('stable'),
      getCliPath: () => Promise.resolve('path/to/cli'),
    } as IConfiguration;
    const service = new DownloadService(context, configuration, cliApi, windowMock, logger, downloader);
    stub(service, 'isCliInstalled').resolves(false);
    stub(service, 'download').rejects(new Error('Download failed'));

    let readyEmitted = false;
    const readyPromise = firstValueFrom(service.downloadReady$).then(() => {
      readyEmitted = true;
    });

    try {
      await service.downloadOrUpdate();
    } catch {
      // expected to throw
    }

    await readyPromise;
    strictEqual(readyEmitted, true, 'downloadReady$ should be emitted even when download() throws');
  });

  test('downloadOrUpdate() logs info when auto-management is disabled', async () => {
    const infoSpy = sinon.spy(logger, 'info');
    configuration = {
      isAutomaticDependencyManagementEnabled: () => false,
      getCliReleaseChannel: () => Promise.resolve('stable'),
      getCliPath: () => Promise.resolve('path/to/cli'),
    } as IConfiguration;
    const service = new DownloadService(context, configuration, cliApi, windowMock, logger, downloader);
    stub(service, 'isCliInstalled').resolves(true);

    await service.downloadOrUpdate();

    const loggedAutoManagement = infoSpy
      .getCalls()
      .some(call => (call.args[0] as string).includes('Automatic dependency management is disabled'));
    strictEqual(loggedAutoManagement, true, 'Should log that automatic dependency management is disabled');
  });

  test('downloadOrUpdate() throws when CLI is missing and auto-management is disabled so extension shows error notification', async () => {
    configuration = {
      isAutomaticDependencyManagementEnabled: () => false,
      getCliReleaseChannel: () => Promise.resolve('stable'),
      getCliPath: () => Promise.resolve('path/to/cli'),
    } as IConfiguration;
    const service = new DownloadService(context, configuration, cliApi, windowMock, logger, downloader);
    stub(service, 'isCliInstalled').resolves(false);

    let thrownError: Error | undefined;
    try {
      await service.downloadOrUpdate();
    } catch (err) {
      thrownError = err as Error;
    }

    strictEqual(thrownError !== undefined, true, 'Should throw when CLI is missing and auto-management is disabled');
    strictEqual(
      thrownError!.message.includes('not installed'),
      true,
      'Error message should mention that the CLI is not installed',
    );
  });

  test('downloadOrUpdate() does not throw when CLI is installed and auto-management is disabled', async () => {
    configuration = {
      isAutomaticDependencyManagementEnabled: () => false,
      getCliReleaseChannel: () => Promise.resolve('stable'),
      getCliPath: () => Promise.resolve('path/to/cli'),
    } as IConfiguration;
    const service = new DownloadService(context, configuration, cliApi, windowMock, logger, downloader);
    stub(service, 'isCliInstalled').resolves(true);

    const result = await service.downloadOrUpdate();

    strictEqual(result, false, 'Should return false without throwing when CLI exists but auto-management is disabled');
  });

  test('update() returns true when no update is needed', async () => {
    cliApi = {
      ...cliApi,
      getLatestCliVersion: sinon.stub().resolves('1.1300.0'),
    };
    // Stored version matches latest, stored protocol matches current
    contextGetGlobalStateValue.withArgs(MEMENTO_CLI_VERSION).returns('1.1300.0');
    contextGetGlobalStateValue.withArgs(MEMENTO_LS_PROTOCOL_VERSION).returns(PROTOCOL_VERSION);

    const service = new DownloadService(context, configuration, cliApi, windowMock, logger, downloader);

    const result = await service.update();

    strictEqual(result, true, 'Should return true when CLI is already up-to-date');
  });

  test('update() persists metadata and returns true when checksum matches but metadata is stale', async () => {
    cliApi = {
      ...cliApi,
      getLatestCliVersion: sinon.stub().resolves('1.1301.0'),
      getSha256Checksum: sinon.stub().resolves('abc123'),
    };
    // Stored version is older → needsUpdate is true
    contextGetGlobalStateValue.withArgs(MEMENTO_CLI_VERSION).returns('1.1300.0');
    contextGetGlobalStateValue.withArgs(MEMENTO_LS_PROTOCOL_VERSION).returns(PROTOCOL_VERSION);

    const service = new DownloadService(context, configuration, cliApi, windowMock, logger, downloader);
    sinon.stub(CliExecutable, 'getCurrentWithArch').resolves('macos_arm64');
    sinon.stub(CliExecutable, 'exists').resolves(true);
    sinon.stub(CliExecutable, 'isPathInExtensionDirectory').returns(false);
    sinon.stub(Checksum, 'getChecksumOf').resolves(Checksum.fromDigest('abc123', 'abc123'));

    const result = await service.update();

    strictEqual(result, true, 'Should return true when binary is correct despite stale metadata');
    const versionPersisted = contextUpdateGlobalStateValue
      .getCalls()
      .some((call: sinon.SinonSpyCall) => call.args[0] === MEMENTO_CLI_VERSION && call.args[1] === '1.1301.0');
    strictEqual(versionPersisted, true, 'Should persist the new CLI version');
    const protocolPersisted = contextUpdateGlobalStateValue
      .getCalls()
      .some((call: sinon.SinonSpyCall) => call.args[0] === MEMENTO_LS_PROTOCOL_VERSION);
    strictEqual(protocolPersisted, true, 'Should persist the current protocol version');
  });

  test('download() shows progress notification pop-up during CLI download', async () => {
    sinon.stub(CliExecutable, 'getCurrentWithArch').resolves('macos_arm64');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const withProgressFake = windowMock.withProgress as sinon.SinonSpy;
    withProgressFake.resetHistory();

    const service = new DownloadService(context, configuration, cliApi, windowMock, logger, downloader);

    await service.download();

    strictEqual(withProgressFake.calledOnce, true, 'Progress notification pop-up should be shown during download');
    strictEqual(
      withProgressFake.firstCall.args[0],
      messages.progressTitle,
      `Progress notification should display "${messages.progressTitle}"`,
    );
  });
});
