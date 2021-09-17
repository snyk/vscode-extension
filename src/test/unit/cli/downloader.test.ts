import { rejects, strictEqual } from 'assert';
import fs from 'fs/promises';
import sinon from 'sinon';
import { IStaticCliApi } from '../../../snyk/cli/api/staticCliApi';
import { Checksum } from '../../../snyk/cli/checksum';
import { CliExecutable } from '../../../snyk/cli/cliExecutable';
import { CliDownloader } from '../../../snyk/cli/downloader';
import { ILog } from '../../../snyk/common/logger/interfaces';
import { Platform } from '../../../snyk/common/platform';
import { IVSCodeWindow } from '../../../snyk/common/vscode/window';
import { LoggerMock } from '../mocks/logger.mock';
import { windowMock } from '../mocks/window.mock';

suite('CLI Downloader', () => {
  let logger: ILog;
  let api: IStaticCliApi;
  const extensionDir = '/.vscode/extensions/snyk-security';

  setup(() => {
    api = {
      getDownloadUrl: sinon.fake(),
      getExecutable: sinon.fake(),
      getLatestVersion: sinon.fake(),
      getSha256Checksum: sinon.fake(),
    };
    logger = new LoggerMock();
  });

  teardown(() => {
    sinon.restore();
  });

  test('Download fails if platform is not supported', async () => {
    const downloader = new CliDownloader(api, extensionDir, windowMock, logger);
    sinon.stub(Platform, 'getCurrent').returns('freebsd');
    await rejects(() => downloader.download());
  });

  test('Download removes executable, if it exists', async () => {
    const downloader = new CliDownloader(api, extensionDir, windowMock, logger);

    sinon.stub(Platform, 'getCurrent').returns('darwin');
    sinon.stub(fs, 'access').returns(Promise.resolve());
    const unlink = sinon.stub(fs, 'unlink');

    await downloader.download();
    const cliPath = CliExecutable.getPath(extensionDir);

    strictEqual(unlink.calledOnceWith(cliPath), true);
  });

  test('Rejects when integrity check fails', async () => {
    const downloader = new CliDownloader(api, extensionDir, windowMock, logger);
    sinon.stub(Platform, 'getCurrent').returns('darwin');
    sinon.stub(fs);

    sinon.stub(downloader, 'downloadCli').resolves(new Checksum('test'));

    await rejects(() => downloader.download());
  });
});
