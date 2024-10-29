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

suite('LS Downloader (LS)', () => {
  let logger: ILog;
  let lsApi: IStaticCliApi;
  let configuration: IConfiguration;

  setup(() => {
    lsApi = {
      getDownloadUrl: sinon.fake(),
      downloadBinary: sinon.fake(),
      getSha256Checksum: sinon.fake(),
    };
    logger = new LoggerMock();
    configuration = {
      isAutomaticDependencyManagementEnabled: () => true,
      getSnykLanguageServerPath(): string {
        return 'abc/d';
      },
    } as IConfiguration;
  });

  // noinspection DuplicatedCode
  teardown(() => {
    sinon.restore();
  });

  test('Download of LS fails if platform is not supported', async () => {
    const downloader = new Downloader(configuration, lsApi, windowMock, logger);
    sinon.stub(CliExecutable, 'getCurrentWithArch').throws(new Error());
    await rejects(() => downloader.download());
  });

  test('Download of LS removes executable, if it exists', async () => {
    const downloader = new Downloader(configuration, lsApi, windowMock, logger);

    sinon.stub(CliExecutable, 'getCurrentWithArch').returns('darwinArm64');
    sinon.stub(fs, 'access').returns(Promise.resolve());
    const unlink = sinon.stub(fs, 'unlink');

    await downloader.download();
    const lsPath = CliExecutable.getPath(configuration.getSnykLanguageServerPath());

    strictEqual(unlink.calledOnceWith(lsPath), true);
  });

  test('Rejects downloaded LS when integrity check fails', async () => {
    const downloader = new Downloader(configuration, lsApi, windowMock, logger);
    sinon.stub(CliExecutable, 'getCurrentWithArch').returns('darwinAmd64');
    sinon.stub(fs);

    sinon.stub(downloader, 'downloadLs').resolves(new Checksum('test'));

    await rejects(() => downloader.download());
  });
});
