import { rejects } from 'assert';
import sinon from 'sinon';
import { StaticCliApi } from '../../../snyk/cli/staticCliApi';
import { IConfiguration } from '../../../snyk/common/configuration/configuration';
import { ILog } from '../../../snyk/common/logger/interfaces';
import { IVSCodeWorkspace } from '../../../snyk/common/vscode/workspace';
import { LoggerMock } from '../mocks/logger.mock';
import { ERRORS, TransientNetworkError } from '../../../snyk/common/constants/errors';
import * as requestLight from 'request-light';

suite('StaticCliApi', () => {
  let logger: ILog;
  let workspace: IVSCodeWorkspace;
  let configuration: IConfiguration;
  let xhrStub: sinon.SinonStub;

  setup(() => {
    logger = new LoggerMock();
    workspace = {
      getConfiguration: sinon.stub().returns(undefined),
    } as unknown as IVSCodeWorkspace;
    configuration = {
      getCliBaseDownloadUrl: () => 'https://example.com',
      getCliReleaseChannel: () => Promise.resolve('stable'),
    } as unknown as IConfiguration;
    xhrStub = sinon.stub(requestLight, 'xhr');
  });

  teardown(() => {
    sinon.restore();
  });

  const errorCases = [
    {
      name: 'getLatestCliVersion wraps non-network errors in DOWNLOAD_FAILED',
      invoke: (api: StaticCliApi) => api.getLatestCliVersion('stable'),
      rejection: ERRORS.DOWNLOAD_FAILED,
    },
    {
      name: 'getSha256Checksum wraps non-network errors in DOWNLOAD_FAILED',
      invoke: (api: StaticCliApi) => api.getSha256Checksum('1.0.0', 'linux'),
      rejection: ERRORS.DOWNLOAD_FAILED,
    },
  ];

  for (const { name, invoke, rejection } of errorCases) {
    test(name, async () => {
      xhrStub.rejects(new Error('some unexpected error'));
      const api = new StaticCliApi(workspace, configuration, logger);
      await rejects(() => invoke(api), { message: rejection });
    });
  }

  const networkErrorCases = [
    {
      name: 'getLatestCliVersion throws TransientNetworkError on network failure',
      invoke: (api: StaticCliApi) => api.getLatestCliVersion('stable'),
    },
    {
      name: 'getSha256Checksum throws TransientNetworkError on network failure',
      invoke: (api: StaticCliApi) => api.getSha256Checksum('1.0.0', 'linux'),
    },
  ];

  for (const { name, invoke } of networkErrorCases) {
    test(name, async () => {
      // request-light rejects with a plain object on network failure
      xhrStub.rejects({ status: 500, responseText: 'Unable to access url. Error: ENOTFOUND', headers: {} });
      const api = new StaticCliApi(workspace, configuration, logger);
      await rejects(
        () => invoke(api),
        (err: unknown) => err instanceof TransientNetworkError,
      );
    });
  }
});
