import { rejects, strictEqual } from 'assert';
import fs from 'fs/promises';
import sinon from 'sinon';
import { IStaticCliApi } from '../../../snyk/cli/api/staticCliApi';
import { Checksum } from '../../../snyk/cli/checksum';
import { CliExecutable } from '../../../snyk/cli/cliExecutable';
import { Downloader } from '../../../snyk/cli/downloader';
import { IConfiguration } from '../../../snyk/common/configuration/configuration';
import { ILog } from '../../../snyk/common/logger/interfaces';
import { Platform } from '../../../snyk/common/platform';
import { LoggerMock } from '../mocks/logger.mock';
import { windowMock } from '../mocks/window.mock';
import { IStaticLsApi } from '../../../snyk/cli/api/staticLsApi';

suite('CLI Downloader', () => {
  let logger: ILog;
  let cliApi: IStaticCliApi;
  let lsApi: IStaticLsApi;
  let configuration: IConfiguration;
  const extensionDir = '/.vscode/extensions/snyk-security';

  setup(() => {
    cliApi = {
      getDownloadUrl: sinon.fake(),
      getExecutable: sinon.fake(),
      getLatestVersion: sinon.fake(),
      getSha256Checksum: sinon.fake(),
    };
    lsApi = {
      getDownloadUrl: sinon.fake(),
      downloadBinary: sinon.fake(),
      getMetadata: sinon.fake(),
      getSha256Checksum: sinon.fake(),
    };
    logger = new LoggerMock();
    configuration = {
      isAutomaticDependencyManagementEnabled: () => true,
      getCustomCliPath: () => undefined,
    } as IConfiguration;
  });

  teardown(() => {
    sinon.restore();
  });

  test('Download fails if platform is not supported', async () => {
    const downloader = new Downloader(configuration, cliApi, lsApi, extensionDir, windowMock, logger);
    sinon.stub(Platform, 'getCurrent').returns('freebsd');
    await rejects(() => downloader.download());
  });

  test('Download removes executable, if it exists', async () => {
    const downloader = new Downloader(configuration, cliApi, lsApi, extensionDir, windowMock, logger);

    sinon.stub(Platform, 'getCurrent').returns('darwin');
    sinon.stub(fs, 'access').returns(Promise.resolve());
    const unlink = sinon.stub(fs, 'unlink');

    await downloader.download();
    const cliPath = CliExecutable.getPath(extensionDir);

    strictEqual(unlink.calledOnceWith(cliPath), true);
  });

  test('Rejects when integrity check fails', async () => {
    const downloader = new Downloader(configuration, cliApi, lsApi, extensionDir, windowMock, logger);
    sinon.stub(Platform, 'getCurrent').returns('darwin');
    sinon.stub(fs);

    sinon.stub(downloader, 'downloadCli').resolves(new Checksum('test'));

    await rejects(() => downloader.download());
  });
});
