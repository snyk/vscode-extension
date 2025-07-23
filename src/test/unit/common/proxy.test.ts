/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import assert from 'assert';
import sinon from 'sinon';
import fs from 'fs/promises';
import * as tls from 'tls';
import { getDefaultAgentOptions } from '../../../snyk/common/proxy';
import { IConfiguration } from '../../../snyk/common/configuration/configuration';
import { ILog } from '../../../snyk/common/logger/interfaces';

suite('Proxy', () => {
  const error = sinon.stub();
  const logger = { error, debug: sinon.stub() } as unknown as ILog;

  teardown(() => {
    sinon.restore();
  });

  suite('Certificate handling', () => {
    let configuration: IConfiguration;
    let accessStub: sinon.SinonStub;
    let readFileStub: sinon.SinonStub;

    setup(() => {
      configuration = {
        getInsecure: sinon.stub().returns(false),
      } as unknown as IConfiguration;

      accessStub = sinon.stub(fs, 'access');
      readFileStub = sinon.stub(fs, 'readFile');
    });

    test('Returns basic options when no custom certificates', async () => {
      const options = await getDefaultAgentOptions(configuration, logger, {});

      assert.deepStrictEqual(options, { rejectUnauthorized: true });
    });

    test('Respects insecure mode', async () => {
      (configuration.getInsecure as sinon.SinonStub).returns(true);

      const options = await getDefaultAgentOptions(configuration, logger, {});

      assert.deepStrictEqual(options, { rejectUnauthorized: false });
    });

    test('NODE_EXTRA_CA_CERTS adds additional CA certificate', async () => {
      const testCert = '-----BEGIN CERTIFICATE-----\ntest certificate\n-----END CERTIFICATE-----';
      const processEnv = { NODE_EXTRA_CA_CERTS: '/path/to/cert.pem' };

      accessStub.resolves();
      readFileStub.resolves(testCert);

      const options = await getDefaultAgentOptions(configuration, logger, processEnv);

      assert(options);
      assert.strictEqual(options.rejectUnauthorized, true);
      assert(Array.isArray(options.ca));
      assert(options.ca.includes(testCert));

      // Should include system certificates plus our test certificate
      const systemCertsCount = tls.rootCertificates.length;
      assert.strictEqual(options.ca.length, systemCertsCount + 1);
    });

    test('NODE_EXTRA_CA_CERTS with invalid path logs error and continues', async () => {
      const processEnv = { NODE_EXTRA_CA_CERTS: '/invalid/path/cert.pem' };
      const testError = new Error('File not found');

      accessStub.rejects(testError);

      const options = await getDefaultAgentOptions(configuration, logger, processEnv);

      assert.deepStrictEqual(options, { rejectUnauthorized: true });
      assert(error.calledWith(`Failed to read NODE_EXTRA_CA_CERTS file: ${testError}`));
    });

    test('NODE_EXTRA_CA_CERTS adds CA certificate even when insecure mode is enabled', async () => {
      const testCert = '-----BEGIN CERTIFICATE-----\ntest certificate\n-----END CERTIFICATE-----';
      const processEnv = { NODE_EXTRA_CA_CERTS: '/path/to/cert.pem' };

      (configuration.getInsecure as sinon.SinonStub).returns(true);
      accessStub.resolves();
      readFileStub.resolves(testCert);

      const options = await getDefaultAgentOptions(configuration, logger, processEnv);

      assert(options);
      assert.strictEqual(options.rejectUnauthorized, false);
      assert(Array.isArray(options.ca));
      assert(options.ca.includes(testCert));
    });

    test('Empty certificate file returns default options', async () => {
      const processEnv = { NODE_EXTRA_CA_CERTS: '/path/to/empty.pem' };

      accessStub.resolves();
      readFileStub.resolves('');

      const options = await getDefaultAgentOptions(configuration, logger, processEnv);

      assert.deepStrictEqual(options, { rejectUnauthorized: true });
    });
  });
});
