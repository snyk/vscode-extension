/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { deepStrictEqual, strictEqual } from 'assert';
import sinon from 'sinon';
import { Configuration, PreviewFeatures } from '../../../snyk/common/configuration/configuration';
import { ADVANCED_CUSTOM_ENDPOINT, FEATURES_PREVIEW_SETTING } from '../../../snyk/common/constants/settings';
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

  test('Snyk Code: production base url is returned when not in development', () => {
    const workspace = stubWorkspaceConfiguration(ADVANCED_CUSTOM_ENDPOINT, undefined);
    const configuration = new Configuration(
      {
        SNYK_VSCE_DEVELOPMENT: '',
      },
      workspace,
    );

    strictEqual(configuration.snykCodeBaseURL, 'https://deeproxy.snyk.io');
  });

  test('Snyk Code: development base url is returned when in development', () => {
    const configuration = new Configuration(
      {
        SNYK_VSCE_DEVELOPMENT: '1',
      },
      workspaceStub,
    );
    strictEqual(configuration.snykCodeBaseURL, 'https://deeproxy.dev.snyk.io');
  });

  test('Snyk Code: base url respects custom endpoint configuration', () => {
    const workspace = stubWorkspaceConfiguration(ADVANCED_CUSTOM_ENDPOINT, 'http://custom.endpoint.com');
    const configuration = new Configuration({}, workspace);

    strictEqual(configuration.snykCodeBaseURL, 'http://deeproxy.custom.endpoint.com');
  });

  test('Snyk Code: Custom base url is returned when in development and custom url specified', () => {
    const customUrl = 'https://custom.url';
    const configuration = new Configuration(
      {
        SNYK_VSCE_DEVELOPMENT: '1',
        SNYK_VSCE_DEVELOPMENT_SNYKCODE_BASE_URL: customUrl,
      },
      workspaceStub,
    );
    strictEqual(configuration.snykCodeBaseURL, customUrl);
  });

  test('Snyk Code: token returns snyk.io token when not in development', async () => {
    const token = 'snyk-token';
    const configuration = new Configuration(process.env, workspaceStub);
    await configuration.setToken(token);

    strictEqual(configuration.snykCodeToken, token);
  });

  test('Snyk Code: token returns Snyk Code token when in development', async () => {
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

  test('Snyk OSS: API endpoint returns default endpoint when no custom set', () => {
    const workspace = stubWorkspaceConfiguration(ADVANCED_CUSTOM_ENDPOINT, undefined);

    const configuration = new Configuration({}, workspace);

    strictEqual(configuration.snykOssApiEndpoint, 'https://snyk.io/api/v1');
  });

  test('Snyk OSS: API endpoint returns custom endpoint when set', () => {
    const customEndpoint = 'http://custom.endpoint.com/api';
    const workspace = stubWorkspaceConfiguration(ADVANCED_CUSTOM_ENDPOINT, customEndpoint);

    const configuration = new Configuration({}, workspace);

    strictEqual(configuration.snykOssApiEndpoint, customEndpoint);
  });

  test('Preview features: not enabled', () => {
    const previewFeatures = undefined;
    const workspace = stubWorkspaceConfiguration(FEATURES_PREVIEW_SETTING, previewFeatures);

    const configuration = new Configuration({}, workspace);

    deepStrictEqual(configuration.previewFeatures, {
      reportFalsePositives: false,
    } as PreviewFeatures);
  });

  test('Preview features: some features enabled', () => {
    const previewFeatures = {
      reportFalsePositives: true,
    } as PreviewFeatures;
    const workspace = stubWorkspaceConfiguration(FEATURES_PREVIEW_SETTING, previewFeatures);

    const configuration = new Configuration({}, workspace);

    deepStrictEqual(configuration.previewFeatures, previewFeatures);
  });

  function stubWorkspaceConfiguration<T>(configSetting: string, returnValue: T | undefined): IVSCodeWorkspace {
    return {
      getConfiguration: (identifier: string, key: string) => {
        if (`${identifier}.${key}` === configSetting) return returnValue;
        return undefined;
      },
    } as IVSCodeWorkspace;
  }
});
