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
        assert.deepStrictEqual(config.httpsAgent?.options.rejectUnauthorized, true);
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

    assert.deepStrictEqual(agent?.['proxy'].host, host);
    assert.deepStrictEqual(agent?.['proxy'].port, port);
    assert.deepStrictEqual(agent?.['proxy'].auth, auth);
    assert.deepStrictEqual(agent?.['proxy'].rejectUnauthorized, proxyStrictSSL);
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
      HTTPS_PROXY: proxy,
      HTTP_PROXY: proxy,
    });

    assert.deepStrictEqual(agent?.['proxy'].host, host);
    assert.deepStrictEqual(agent?.['proxy'].port, port);
    assert.deepStrictEqual(agent?.['proxy'].auth, auth);
    assert.deepStrictEqual(agent?.['proxy'].rejectUnauthorized, proxyStrictSSL);
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

    suite('Certificate handling and insecure mode', () => {
    let originalEnv: string | undefined;

    setup(() => {
      originalEnv = process.env.NODE_EXTRA_CA_CERTS;
    });

    teardown(() => {
      // Restore original environment
      if (originalEnv) {
        process.env.NODE_EXTRA_CA_CERTS = originalEnv;
      } else {
        delete process.env.NODE_EXTRA_CA_CERTS;
      }
    });

    test('should disable certificate validation in insecure mode without custom certs', async () => {
      delete process.env.NODE_EXTRA_CA_CERTS;

      const getConfiguration = sinon.stub();
      getConfiguration.withArgs('http', 'proxy').returns(undefined);

      const workspace = {
        getConfiguration,
      } as unknown as IVSCodeWorkspace;

      const getInsecure = sinon.stub();
      getInsecure.returns(true); // Insecure mode

      const configuration = {
        getInsecure,
      } as unknown as IConfiguration;

      const config = await getAxiosConfig(workspace, configuration, logger);

      // Should disable certificate validation
      assert.deepStrictEqual(config.httpsAgent?.options.rejectUnauthorized, false);
    });

    test('should enable certificate validation in secure mode without custom certs', async () => {
      delete process.env.NODE_EXTRA_CA_CERTS;

      const getConfiguration = sinon.stub();
      getConfiguration.withArgs('http', 'proxy').returns(undefined);

      const workspace = {
        getConfiguration,
      } as unknown as IVSCodeWorkspace;

      const getInsecure = sinon.stub();
      getInsecure.returns(false); // Secure mode

      const configuration = {
        getInsecure,
      } as unknown as IConfiguration;

      const config = await getAxiosConfig(workspace, configuration, logger);

      // Should enable certificate validation
      assert.deepStrictEqual(config.httpsAgent?.options.rejectUnauthorized, true);
    });

    test('should preserve insecure mode setting with proxy configuration', async () => {
      const getConfiguration = sinon.stub();
      getConfiguration.withArgs('http', 'proxy').returns(proxy);
      getConfiguration.withArgs('http', 'proxyStrictSSL').returns(false); // Insecure proxy

      const workspace = {
        getConfiguration,
      } as unknown as IVSCodeWorkspace;

      const getInsecure = sinon.stub();
      getInsecure.returns(true); // Insecure mode

      const configuration = {
        getInsecure,
      } as unknown as IConfiguration;

      const agent = await getHttpsProxyAgent(workspace, configuration, logger);

      // Should disable certificate validation in proxy settings
      assert.deepStrictEqual(agent?.['proxy'].rejectUnauthorized, false);
    });

    test('should preserve secure mode setting with proxy configuration', async () => {
      const getConfiguration = sinon.stub();
      getConfiguration.withArgs('http', 'proxy').returns(proxy);
      getConfiguration.withArgs('http', 'proxyStrictSSL').returns(true); // Secure proxy

      const workspace = {
        getConfiguration,
      } as unknown as IVSCodeWorkspace;

      const getInsecure = sinon.stub();
      getInsecure.returns(false); // Secure mode

      const configuration = {
        getInsecure,
      } as unknown as IConfiguration;

      const agent = await getHttpsProxyAgent(workspace, configuration, logger);

      // Should enable certificate validation in proxy settings
      assert.deepStrictEqual(agent?.['proxy'].rejectUnauthorized, true);
    });

    test('should handle NODE_EXTRA_CA_CERTS environment variable being set', async () => {
      // Set the environment variable but don't mock file system
      // This tests that the code doesn't crash when the env var is set
      process.env.NODE_EXTRA_CA_CERTS = '/nonexistent/path/cert.pem';

      const getConfiguration = sinon.stub();
      getConfiguration.withArgs('http', 'proxy').returns(undefined);

      const workspace = {
        getConfiguration,
      } as unknown as IVSCodeWorkspace;

      const getInsecure = sinon.stub();
      getInsecure.returns(false); // Secure mode

      const configuration = {
        getInsecure,
      } as unknown as IConfiguration;

      // This should not throw an error even if the cert file doesn't exist
      const config = await getAxiosConfig(workspace, configuration, logger);

      // Should still respect the insecure mode setting
      assert.deepStrictEqual(config.httpsAgent?.options.rejectUnauthorized, true);
    });

    test('should handle NODE_EXTRA_CA_CERTS in insecure mode', async () => {
      // Set the environment variable but don't mock file system
      process.env.NODE_EXTRA_CA_CERTS = '/nonexistent/path/cert.pem';

      const getConfiguration = sinon.stub();
      getConfiguration.withArgs('http', 'proxy').returns(undefined);

      const workspace = {
        getConfiguration,
      } as unknown as IVSCodeWorkspace;

      const getInsecure = sinon.stub();
      getInsecure.returns(true); // Insecure mode

      const configuration = {
        getInsecure,
      } as unknown as IConfiguration;

      // This should not throw an error even if the cert file doesn't exist
      const config = await getAxiosConfig(workspace, configuration, logger);

      // Should disable certificate validation even with NODE_EXTRA_CA_CERTS set
      assert.deepStrictEqual(config.httpsAgent?.options.rejectUnauthorized, false);
    });

    test('should log error when certificate file operations fail', async () => {
      const errorStub = sinon.stub();
      const testLogger = { 
        error: errorStub, 
        debug: sinon.stub() 
      } as unknown as ILog;

      // Set to a path that likely doesn't exist
      process.env.NODE_EXTRA_CA_CERTS = '/nonexistent/path/cert.pem';

      const getConfiguration = sinon.stub();
      getConfiguration.withArgs('http', 'proxy').returns(undefined);

      const workspace = {
        getConfiguration,
      } as unknown as IVSCodeWorkspace;

      const getInsecure = sinon.stub();
      getInsecure.returns(false);

      const configuration = {
        getInsecure,
      } as unknown as IConfiguration;

      await getAxiosConfig(workspace, configuration, testLogger);

      // Should log an error about the certificate file
      assert.ok(errorStub.called);
    });
  });
});
