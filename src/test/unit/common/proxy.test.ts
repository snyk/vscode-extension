/* eslint-disable camelcase */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import assert from 'assert';
import sinon from 'sinon';
import { getAxiosConfig, getHttpsProxyAgent, getProxyEnvVariable, getProxyOptions } from '../../../snyk/common/proxy';
import { IVSCodeWorkspace } from '../../../snyk/common/vscode/workspace';
import { IConfiguration } from '../../../snyk/common/configuration/configuration';
import { ILog } from '../../../snyk/common/logger/interfaces';

suite('Proxy', () => {
  // Proxy settings
  const host = 'my.proxy.com';
  const port = 8080;
  const auth = 'user:password';
  const protocol = 'https:';
  const proxy = `${protocol}//${auth}@${host}:${port}`;
  const proxyStrictSSL = true;
  const error = sinon.stub();
  const logger = { error } as unknown as ILog;

  teardown(() => {
    sinon.restore();
  });

  test('No proxy configured by user (default case)', async () => {
    const getConfiguration = sinon.stub();
    const getInsecure = sinon.stub();
    getInsecure.returns(!proxyStrictSSL);

    const configuration = {
      getInsecure,
    } as unknown as IConfiguration;

    getConfiguration.withArgs('http', 'proxy').returns(undefined);

    const workspace = {
      getConfiguration,
    } as unknown as IVSCodeWorkspace;

    const configOptions = await getAxiosConfig(workspace, configuration, logger);

    // should still set rejectUnauthorized flag
    // @ts-ignore: cannot test options otherwise
    assert.deepStrictEqual(configOptions.httpAgent?.options.rejectUnauthorized, proxyStrictSSL);
    assert.deepStrictEqual(configOptions.httpsAgent?.options.rejectUnauthorized, proxyStrictSSL);
  });

  suite('.getAxiosConfig()', () => {
    suite('when proxyStrictSsl checkbox is checked', () => {
      const getConfiguration = sinon.stub();
      const workspace = {
        getConfiguration,
      } as unknown as IVSCodeWorkspace;

      const getInsecure = sinon.stub();
      getInsecure.returns(false);

      const configuration = {
        getInsecure,
      } as unknown as IConfiguration;

      test('should return rejectUnauthorized true', async () => {
        const config = await getAxiosConfig(workspace, configuration, logger);
        assert.deepStrictEqual(config.httpAgent?.options.rejectUnauthorized, true);
      });
    });

    suite('when proxyStrictSsl checkbox is not checked', () => {
      const getConfiguration = sinon.stub();
      const workspace = {
        getConfiguration,
      } as unknown as IVSCodeWorkspace;

      const getInsecure = sinon.stub();
      getInsecure.returns(true);

      const configuration = {
        getInsecure,
      } as unknown as IConfiguration;

      test('should return rejectUnauthorized false', async () => {
        const config = await getAxiosConfig(workspace, configuration, logger);
        assert.deepStrictEqual(config.httpsAgent?.options.rejectUnauthorized, false);
      });
    });
  });

  test('Proxy is configured in VS Code settings', async () => {
    const getConfiguration = sinon.stub();
    getConfiguration.withArgs('http', 'proxy').returns(proxy);
    getConfiguration.withArgs('http', 'proxyStrictSSL').returns(proxyStrictSSL);

    const workspace = {
      getConfiguration,
    } as unknown as IVSCodeWorkspace;

    const getInsecure = sinon.stub();
    getInsecure.returns(!proxyStrictSSL);

    const configuration = {
      getInsecure,
    } as unknown as IConfiguration;

    const agent = await getHttpsProxyAgent(workspace, configuration, logger);

    // @ts-ignore: cannot test options otherwise
    assert.deepStrictEqual(agent?.proxy.host, host);
    // @ts-ignore: cannot test options otherwise
    assert.deepStrictEqual(agent?.proxy.port, port);
    // @ts-ignore: cannot test options otherwise
    assert.deepStrictEqual(agent?.proxy.auth, auth);
    // @ts-ignore: cannot test options otherwise
    assert.deepStrictEqual(agent?.proxy.rejectUnauthorized, proxyStrictSSL);
  });

  test('Proxy is configured in environment', async () => {
    const getConfiguration = sinon.stub();
    getConfiguration.withArgs('http', 'proxy').returns(undefined);
    getConfiguration.withArgs('http', 'proxyStrictSSL').returns(proxyStrictSSL);

    const workspace = {
      getConfiguration,
    } as unknown as IVSCodeWorkspace;

    const getInsecure = sinon.stub();
    getInsecure.returns(!proxyStrictSSL);
    const configuration = {
      getInsecure,
    } as unknown as IConfiguration;

    const agent = await getHttpsProxyAgent(workspace, configuration, logger, {
      https_proxy: proxy,
      http_proxy: proxy,
    });

    // @ts-ignore: cannot test options otherwise
    assert.deepStrictEqual(agent?.proxy.host, host);
    // @ts-ignore: cannot test options otherwise
    assert.deepStrictEqual(agent?.proxy.port, port);
    // @ts-ignore: cannot test options otherwise
    assert.deepStrictEqual(agent?.proxy.auth, auth);
    // @ts-ignore: cannot test options otherwise
    assert.deepStrictEqual(agent?.proxy.rejectUnauthorized, proxyStrictSSL);
  });

  test('getProxyEnvVariable should return the https proxy as env var', async () => {
    const getConfiguration = sinon.stub();
    getConfiguration.withArgs('http', 'proxy').returns(proxy);
    getConfiguration.withArgs('http', 'proxyStrictSSL').returns(proxyStrictSSL);

    const workspace = {
      getConfiguration,
    } as unknown as IVSCodeWorkspace;

    const getInsecure = sinon.stub();
    getInsecure.returns(!proxyStrictSSL);

    const configuration = {
      getInsecure,
    } as unknown as IConfiguration;

    const envVariable = getProxyEnvVariable(await getProxyOptions(workspace, configuration, logger));

    // noinspection HttpUrlsUsage
    assert.deepStrictEqual(envVariable, `${protocol}//${auth}@${host}:${port}`);
  });
});
