/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import assert from 'assert';
import sinon from 'sinon';
import { getHttpsProxyAgent, getProxyEnvVariable, getProxyOptions } from '../../../snyk/common/proxy';
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

    const proxyAgent = await getHttpsProxyAgent(workspace, configuration, logger);

    // should return undefined when no proxy is configured
    assert.strictEqual(proxyAgent, undefined);
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

    const proxyOptions = await getProxyOptions(workspace, configuration, logger);

    assert.deepStrictEqual(proxyOptions?.host, host);
    assert.deepStrictEqual(proxyOptions?.port, port);
    assert.deepStrictEqual(proxyOptions?.auth, auth);
    assert.deepStrictEqual(proxyOptions?.protocol, protocol);
    assert.deepStrictEqual(proxyOptions?.rejectUnauthorized, proxyStrictSSL);
  });

  test('Proxy is configured in VS Code settings, but proxy protocol is not supported', async () => {
    const wrongProxy = `ftp://${auth}@${host}:${port}`;
    const getConfiguration = sinon.stub();
    getConfiguration.withArgs('http', 'proxy').returns(wrongProxy);
    getConfiguration.withArgs('http', 'proxyStrictSSL').returns(proxyStrictSSL);

    const workspace = {
      getConfiguration,
    } as unknown as IVSCodeWorkspace;

    const getInsecure = sinon.stub();
    getInsecure.returns(!proxyStrictSSL);

    const configuration = {
      getInsecure,
    } as unknown as IConfiguration;

    const proxyOptions = await getProxyOptions(workspace, configuration, logger);

    assert.deepStrictEqual(proxyOptions, undefined);
  });

  suite('Process environment variables', () => {
    const env = { ...process.env };

    teardown(() => {
      process.env = env;
    });

    const processEnvs = ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy'];
    processEnvs.forEach(envKey => {
      test(`Proxy is configured via ${envKey}`, async () => {
        const processEnv = {
          [envKey]: proxy,
        } as NodeJS.ProcessEnv;

        const getConfiguration = sinon.stub();
        const workspace = {
          getConfiguration,
        } as unknown as IVSCodeWorkspace;

        const getInsecure = sinon.stub();
        getInsecure.returns(!proxyStrictSSL);

        const configuration = {
          getInsecure,
        } as unknown as IConfiguration;

        const proxyOptions = await getProxyOptions(workspace, configuration, logger, processEnv);

        assert.deepStrictEqual(proxyOptions?.host, host);
        assert.deepStrictEqual(proxyOptions?.port, port);
        assert.deepStrictEqual(proxyOptions?.auth, auth);
        assert.deepStrictEqual(proxyOptions?.protocol, protocol);
        assert.deepStrictEqual(proxyOptions?.rejectUnauthorized, proxyStrictSSL);
      });
    });

    test(`VS Code setting should win over an environment variable`, async () => {
      const envVarProxy = 'https://my.wrongproxy.com:8888';
      const processEnv = {
        HTTPS_PROXY: envVarProxy,
      } as NodeJS.ProcessEnv;

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

      const proxyOptions = await getProxyOptions(workspace, configuration, logger, processEnv);

      assert.deepStrictEqual(proxyOptions?.host, host);
      assert.deepStrictEqual(proxyOptions?.port, port);
      assert.deepStrictEqual(proxyOptions?.auth, auth);
      assert.deepStrictEqual(proxyOptions?.protocol, protocol);
      assert.deepStrictEqual(proxyOptions?.rejectUnauthorized, proxyStrictSSL);
    });

    test(`getProxyEnvVariable should create valid proxy string from proxy options`, async () => {
      const processEnv = {
        HTTPS_PROXY: proxy,
      } as NodeJS.ProcessEnv;

      const getConfiguration = sinon.stub();
      const workspace = {
        getConfiguration,
      } as unknown as IVSCodeWorkspace;

      const getInsecure = sinon.stub();
      getInsecure.returns(!proxyStrictSSL);

      const configuration = {
        getInsecure,
      } as unknown as IConfiguration;

      const proxyOptions = await getProxyOptions(workspace, configuration, logger, processEnv);
      const result = getProxyEnvVariable(proxyOptions);

      assert.deepStrictEqual(result, proxy);
    });
  });

  suite('Node certs', () => {
    const env = { ...process.env };

    teardown(() => {
      process.env = env;
    });

    const testLogger = {
      debug: sinon.stub(),
      error: sinon.stub(),
    } as unknown as ILog;

    test('NODE_EXTRA_CA_CERTS adds additional CA certificate to proxy configuration', async () => {
      const processEnv = {
        HTTPS_PROXY: proxy,
        NODE_EXTRA_CA_CERTS: 'src/test/unit/mocks/test-certs/ca-cert.crt',
      } as NodeJS.ProcessEnv;

      const getConfiguration = sinon.stub();
      const workspace = {
        getConfiguration,
      } as unknown as IVSCodeWorkspace;

      const getInsecure = sinon.stub();
      getInsecure.returns(!proxyStrictSSL);

      const configuration = {
        getInsecure,
      } as unknown as IConfiguration;

      const proxyOptions = await getProxyOptions(workspace, configuration, testLogger, processEnv);

      // Ensure the ca option is set
      assert.ok(proxyOptions?.ca);
      assert.ok(Array.isArray(proxyOptions?.ca));
      assert.ok(proxyOptions?.ca.length > 0);
    });

    test('NODE_EXTRA_CA_CERTS with invalid path logs error and continues', async () => {
      const processEnv = {
        HTTPS_PROXY: proxy,
        NODE_EXTRA_CA_CERTS: '/invalid/path/ca-cert.crt',
      } as NodeJS.ProcessEnv;

      const getConfiguration = sinon.stub();
      const workspace = {
        getConfiguration,
      } as unknown as IVSCodeWorkspace;

      const getInsecure = sinon.stub();
      getInsecure.returns(!proxyStrictSSL);

      const configuration = {
        getInsecure,
      } as unknown as IConfiguration;

      const proxyOptions = await getProxyOptions(workspace, configuration, testLogger, processEnv);

      // Should still return proxy options, just without custom CA
      assert.deepStrictEqual(proxyOptions?.host, host);
      assert.deepStrictEqual(proxyOptions?.port, port);
      assert.deepStrictEqual(proxyOptions?.auth, auth);
      assert.deepStrictEqual(proxyOptions?.protocol, protocol);
      assert.deepStrictEqual(proxyOptions?.rejectUnauthorized, proxyStrictSSL);

      // Ensure error was logged
      assert.ok((testLogger.error as sinon.SinonStub).called);
    });

    test('NODE_EXTRA_CA_CERTS adds CA certificate even when insecure mode is enabled', async () => {
      const processEnv = {
        HTTPS_PROXY: proxy,
        NODE_EXTRA_CA_CERTS: 'src/test/unit/mocks/test-certs/ca-cert.crt',
      } as NodeJS.ProcessEnv;

      const getConfiguration = sinon.stub();
      const workspace = {
        getConfiguration,
      } as unknown as IVSCodeWorkspace;

      const getInsecure = sinon.stub();
      getInsecure.returns(true); // insecure mode

      const configuration = {
        getInsecure,
      } as unknown as IConfiguration;

      const proxyOptions = await getProxyOptions(workspace, configuration, testLogger, processEnv);

      // Even in insecure mode, CA should be loaded
      assert.ok(proxyOptions?.ca);
      assert.ok(Array.isArray(proxyOptions?.ca));
      assert.ok(proxyOptions?.ca.length > 0);
      assert.strictEqual(proxyOptions?.rejectUnauthorized, false); // Should still be insecure
    });
  });
});
