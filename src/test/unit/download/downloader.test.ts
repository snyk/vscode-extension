import { rejects, strictEqual } from 'assert';
import fs from 'fs/promises';
import sinon from 'sinon';
import { IStaticCliApi } from '../../../snyk/cli/api/staticCliApi';
import { Checksum } from '../../../snyk/cli/checksum';
import { CliExecutable } from '../../../snyk/cli/cliExecutable';
import { Downloader } from '../../../snyk/common/download/downloader';
import { IConfiguration, PreviewFeatures } from '../../../snyk/common/configuration/configuration';
import { ILog } from '../../../snyk/common/logger/interfaces';
import { Platform } from '../../../snyk/common/platform';
import { LoggerMock } from '../mocks/logger.mock';
import { windowMock } from '../mocks/window.mock';
import { IStaticLsApi, LsMetadata } from '../../../snyk/common/languageServer/staticLsApi';
import { LsExecutable } from '../../../snyk/common/languageServer/lsExecutable';

suite('Downloader (CLI)', () => {
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
      getSnykLanguageServerPath(): string {
        return 'abc/d';
      },
      getPreviewFeatures(): PreviewFeatures {
        return {
          advisor: false,
          reportFalsePositives: false,
          lsAuthenticate: false,
        };
      },
    } as IConfiguration;
  });

  teardown(() => {
    sinon.restore();
  });

  test('Download of CLI fails if platform is not supported', async () => {
    const downloader = new Downloader(configuration, cliApi, lsApi, extensionDir, windowMock, logger);
    sinon.stub(Platform, 'getCurrent').returns('freebsd');
    await rejects(() => downloader.download());
  });

  test('Download of CLI  removes executable, if it exists', async () => {
    const downloader = new Downloader(configuration, cliApi, lsApi, extensionDir, windowMock, logger);

    sinon.stub(Platform, 'getCurrent').returns('darwin');
    sinon.stub(fs, 'access').returns(Promise.resolve());
    const unlink = sinon.stub(fs, 'unlink');

    await downloader.download();
    const cliPath = CliExecutable.getPath(extensionDir);

    strictEqual(unlink.calledOnceWith(cliPath), true);
  });

  test('Rejects downloaded CLI when integrity check fails', async () => {
    const downloader = new Downloader(configuration, cliApi, lsApi, extensionDir, windowMock, logger);
    sinon.stub(Platform, 'getCurrent').returns('darwin');
    sinon.stub(fs);

    sinon.stub(downloader, 'downloadCli').resolves(new Checksum('test'));

    await rejects(() => downloader.download());
  });
});
suite('LS Downloader (LS)', () => {
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
      getMetadata(): Promise<LsMetadata> {
        return Promise.resolve({
          commit: 'abc',
          date: '01.01.2001',
          previous_tag: '',
          project_name: 'testProject',
          runtime: 'darwin',
          tag: 'v20010101.010101',
          version: 'v20010101.010101',
        });
      },
      getSha256Checksum: sinon.fake(),
    };
    logger = new LoggerMock();
    configuration = {
      isAutomaticDependencyManagementEnabled: () => true,
      getSnykLanguageServerPath(): string {
        return 'abc/d';
      },
      getPreviewFeatures(): PreviewFeatures {
        return {
          advisor: false,
          reportFalsePositives: false,
          lsAuthenticate: true,
        };
      },
    } as IConfiguration;
  });

  // noinspection DuplicatedCode
  teardown(() => {
    sinon.restore();
  });

  test('Download of LS fails if platform is not supported', async () => {
    const downloader = new Downloader(configuration, cliApi, lsApi, extensionDir, windowMock, logger);
    sinon.stub(Platform, 'getCurrentWithArch').returns(null);
    await rejects(() => downloader.download());
  });

  test('Download of LS  removes executable, if it exists', async () => {
    const downloader = new Downloader(configuration, cliApi, lsApi, extensionDir, windowMock, logger);

    sinon.stub(Platform, 'getCurrentWithArch').returns('darwinArm64');
    sinon.stub(fs, 'access').returns(Promise.resolve());
    const unlink = sinon.stub(fs, 'unlink');

    await downloader.download();
    const lsPath = LsExecutable.getPath(configuration.getSnykLanguageServerPath());

    strictEqual(unlink.calledOnceWith(lsPath), true);
  });

  test('Rejects downloaded LS when integrity check fails', async () => {
    const downloader = new Downloader(configuration, cliApi, lsApi, extensionDir, windowMock, logger);
    sinon.stub(Platform, 'getCurrentWithArch').returns('darwinAmd64');
    sinon.stub(fs);

    sinon.stub(downloader, 'downloadLs').resolves(new Checksum('test'));

    await rejects(() => downloader.download());
  });
});
