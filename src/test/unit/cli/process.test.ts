import { strictEqual } from 'assert';
import sinon from 'sinon';
import { CLI_INTEGRATION_NAME } from '../../../snyk/cli/contants/integration';
import { CliProcess } from '../../../snyk/cli/process';
import { Configuration, IConfiguration } from '../../../snyk/common/configuration/configuration';
import { ILog } from '../../../snyk/common/logger/interfaces';
import { IVSCodeWorkspace } from '../../../snyk/common/vscode/workspace';
import { LoggerMock } from '../mocks/logger.mock';

suite('CliProcess', () => {
  let logger: ILog;
  const emptyWorkspace = {
    getConfiguration: () => undefined,
  } as unknown as IVSCodeWorkspace;

  setup(() => {
    logger = new LoggerMock();
  });

  test('Sets DISABLE_ANALYTICS when telemetry is off ', async () => {
    const process = new CliProcess(
      logger,
      {
        shouldReportEvents: false,
        getToken: () => Promise.resolve(),
      } as IConfiguration,
      emptyWorkspace,
    );
    const vars = await process.getProcessEnv();
    strictEqual(Object.keys(vars).includes('SNYK_CFG_DISABLE_ANALYTICS'), true);
  });

  test("Doesn't set DISABLE_ANALYTICS when telemetry is on ", async () => {
    const process = new CliProcess(
      logger,
      {
        shouldReportEvents: true,
        getToken: () => Promise.resolve(),
      } as IConfiguration,
      emptyWorkspace,
    );
    const vars = await process.getProcessEnv();

    strictEqual(Object.keys(vars).includes('SNYK_CFG_DISABLE_ANALYTICS'), false);
  });

  test('Sets correct integration name, version, token, API endpoint and organization', async () => {
    const token = 'fake-token';
    const snykOssApiEndpoint = 'https://snyk.io/api/';
    const organization = 'test-org';
    const process = new CliProcess(
      logger,
      {
        getToken: () => Promise.resolve(token),
        snykOssApiEndpoint: snykOssApiEndpoint,
        organization: organization,
      } as IConfiguration,
      emptyWorkspace,
    );

    const envVars = await process.getProcessEnv();

    strictEqual(envVars['SNYK_INTEGRATION_NAME'], CLI_INTEGRATION_NAME);
    strictEqual(envVars['SNYK_INTEGRATION_VERSION'], await Configuration.getVersion());
    strictEqual(envVars['SNYK_TOKEN'], token);
    strictEqual(envVars['SNYK_API'], snykOssApiEndpoint);
    strictEqual(envVars['SNYK_CFG_ORG'], organization);
  });

  test('Sets correct proxy variable', async () => {
    // arrange
    const proxy = 'http://my.proxy.com:8080';
    const getConfiguration = sinon.stub();
    getConfiguration.withArgs('http', 'proxy').returns(proxy);

    const process = new CliProcess(
      logger,
      {
        shouldReportEvents: true,
        getToken: () => Promise.resolve(),
      } as IConfiguration,
      {
        getConfiguration: getConfiguration,
      } as unknown as IVSCodeWorkspace,
    );

    // act
    const vars = await process.getProcessEnv();

    // assert
    strictEqual(vars['HTTPS_PROXY'], proxy);
    strictEqual(vars['HTTP_PROXY'], proxy);
  });
});
