import { rejects, strictEqual } from 'assert';
import fs from 'fs/promises';
import sinon from 'sinon';
import { Checksum } from '../../../snyk/cli/checksum';
import { IConfiguration } from '../../../snyk/common/configuration/configuration';
import { Downloader } from '../../../snyk/common/download/downloader';
import { CliExecutable } from '../../../snyk/cli/cliExecutable';
import { IStaticCliApi } from '../../../snyk/cli/staticCliApi';
import { ILog } from '../../../snyk/common/logger/interfaces';
import { LoggerMock } from '../mocks/logger.mock';
import { windowMock } from '../mocks/window.mock';
import { ExtensionContext } from '../../../snyk/common/vscode/extensionContext';

suite('CLI Downloader (CLI)', () => {
  let logger: ILog;
  let cliApi: IStaticCliApi;
  let configuration: IConfiguration;
  let extensionContextMock: ExtensionContext;
  setup(() => {
    cliApi = {
      getLatestCliVersion: sinon.fake(),
      downloadBinary: sinon.fake(),
      getSha256Checksum: sinon.fake(),
    };
    logger = new LoggerMock();
    configuration = {
      isAutomaticDependencyManagementEnabled: () => true,
      getCliReleaseChannel: () => Promise.resolve('stable'),
      getCliPath(): Promise<string> {
        return Promise.resolve('abc/d');
      },
    } as IConfiguration;
    extensionContextMock = {
      extensionPath: 'test/path',
      updateGlobalStateValue: sinon.fake(),
      setContext: sinon.fake(),
      subscriptions: [],
      addDisposables: sinon.fake(),
      getExtensionUri: sinon.fake(),
    } as unknown as ExtensionContext;
  });

  // noinspection DuplicatedCode
  teardown(() => {
    sinon.restore();
  });

  test('Download of CLI fails if platform is not supported', async () => {
    const downloader = new Downloader(configuration, cliApi, windowMock, logger, extensionContextMock);
    sinon.stub(CliExecutable, 'getCurrentWithArch').throws(new Error());
    await rejects(() => downloader.download());
  });

  test('Download of CLI removes executable, if it exists', async () => {
    const downloader = new Downloader(configuration, cliApi, windowMock, logger, extensionContextMock);

    sinon.stub(CliExecutable, 'getCurrentWithArch').resolves('macos_arm64');
    sinon.stub(fs, 'access').returns(Promise.resolve());
    const unlink = sinon.stub(fs, 'unlink');

    await downloader.download();
    const cliPath = (await configuration.getCliPath()) ?? '';
    strictEqual(unlink.calledOnceWith(cliPath), true);
  });

  test('Rejects downloaded CLI when integrity check fails', async () => {
    const downloader = new Downloader(configuration, cliApi, windowMock, logger, extensionContextMock);
    sinon.stub(CliExecutable, 'getCurrentWithArch').resolves('macos_arm64');
    sinon.stub(fs);

    sinon.stub(downloader, 'downloadCli').resolves(new Checksum('test'));

    await rejects(() => downloader.download());
  });
});
