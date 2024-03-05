import { strictEqual } from 'assert';
import sinon from 'sinon';
import { CLI_INTEGRATION_NAME } from '../../../snyk/cli/contants/integration';
import { CliProcess } from '../../../snyk/cli/process';
import { Configuration, IConfiguration } from '../../../snyk/common/configuration/configuration';
import { ILog } from '../../../snyk/common/logger/interfaces';
import { IVSCodeWorkspace } from '../../../snyk/common/vscode/workspace';
import { LoggerMock } from '../mocks/logger.mock';
import { OAuthToken } from '../../../snyk/base/services/authenticationService';

suite('CliProcess', () => {
  let logger: ILog;
  const snykOssApiEndpoint = 'https://snykgov.io/api/';
  const emptyWorkspace = {
    getConfiguration: () => undefined,
  } as unknown as IVSCodeWorkspace;

  setup(() => {
    logger = new LoggerMock();
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

  test('Sets correct token if oauth authentication', async () => {
    const token = '{"access_token": "fake-token"}';
    const snykOssApiEndpoint = 'https://snykgov.io/api/';
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
    const oauthToken = JSON.parse(token) as OAuthToken;
    strictEqual(envVars['SNYK_TOKEN'], undefined);
    strictEqual(envVars['SNYK_OAUTH_TOKEN'], oauthToken.access_token);
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
        getToken: () => Promise.resolve(),
        snykOssApiEndpoint: snykOssApiEndpoint,
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
