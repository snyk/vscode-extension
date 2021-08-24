/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { strictEqual } from 'assert';
import sinon, { stub } from 'sinon';
import { Configuration } from '../../../snyk/common/configuration/configuration';
import { IVSCodeWorkspace } from '../../../snyk/common/vscode/workspace';

suite('Configuration', () => {
  let workspaceStub: IVSCodeWorkspace;

  setup(() => {
    const tokenConfigSection = 'token';

    let token = '';

    const stub = sinon.stub().returns({
      getConfiguration(_configurationIdentifier, _section) {
        if (_section === tokenConfigSection) return token;
        throw new Error('Section config not implemented. ' + _section);
      },
      updateConfiguration(_configurationIdentifier, _section, value, _configurationTarget, _overrideInLanguage) {
        if (_section === tokenConfigSection) {
          token = value;
          return Promise.resolve();
        }
        return Promise.reject('Section config not implemented. ' + _section);
      },
    } as IVSCodeWorkspace);

    workspaceStub = stub();
  });

  teardown(() => {
    sinon.restore();
  });

  test('Production base url is returned when not in development', () => {
    const configuration = new Configuration(
      {
        SNYK_VSCE_DEVELOPMENT: '',
      },
      workspaceStub,
    );
    strictEqual(configuration.baseURL, 'https://deeproxy.snyk.io');
  });

  test('Development base url is returned when in development', () => {
    const configuration = new Configuration(
      {
        SNYK_VSCE_DEVELOPMENT: '1',
      },
      workspaceStub,
    );
    strictEqual(configuration.baseURL, 'https://deeproxy.dev.snyk.io');
  });

  test('Custom base url is returned when in development and custom url specified', () => {
    const customUrl = 'https://custom.url';
    const configuration = new Configuration(
      {
        SNYK_VSCE_DEVELOPMENT: '1',
        SNYK_VSCE_DEVELOPMENT_SNYKCODE_BASE_URL: customUrl,
      },
      workspaceStub,
    );
    strictEqual(configuration.baseURL, customUrl);
  });

  test('Snyk Code token returns snyk.io token when not in development', async () => {
    const token = 'snyk-token';
    const configuration = new Configuration(process.env, workspaceStub);
    await configuration.setToken(token);

    strictEqual(configuration.snykCodeToken, token);
  });

  test('Snyk Code token returns Snyk Code token when in development', async () => {
    const token = 'test-token';
    const snykCodeToken = 'snykCode-token';
    const configuration = new Configuration(
      {
        SNYK_VSCE_DEVELOPMENT: '1',
        SNYK_VSCE_DEVELOPMENT_SNYKCODE_TOKEN: snykCodeToken,
      },
      workspaceStub,
    );
    await configuration.setToken(token);

    strictEqual(configuration.snykCodeToken, snykCodeToken);
  });
});
