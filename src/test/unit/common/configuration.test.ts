/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { deepStrictEqual, strictEqual } from 'assert';
import sinon from 'sinon';
import { Configuration, PreviewFeatures } from '../../../snyk/common/configuration/configuration';
import { SNYK_TOKEN_KEY } from '../../../snyk/common/constants/general';
import { ADVANCED_CUSTOM_ENDPOINT, FEATURES_PREVIEW_SETTING } from '../../../snyk/common/constants/settings';
import SecretStorageAdapter from '../../../snyk/common/vscode/secretStorage';
import { ExtensionContext } from '../../../snyk/common/vscode/types';
import { IVSCodeWorkspace } from '../../../snyk/common/vscode/workspace';
import { extensionContextMock } from '../mocks/extensionContext.mock';
import { stubWorkspaceConfiguration } from '../mocks/workspace.mock';

suite('Configuration', () => {
  let workspaceStub: IVSCodeWorkspace;
  let extensionContext: ExtensionContext;

  setup(() => {
    const tokenConfigSection = 'token';

    let token = '';

    extensionContext = extensionContextMock;
    SecretStorageAdapter.init(extensionContext);

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

  test('Snyk Code: base url respects single tenant endpoint configuration', () => {
    const workspace = stubWorkspaceConfiguration(ADVANCED_CUSTOM_ENDPOINT, 'https://app.custom.snyk.io/api');
    const configuration = new Configuration({}, workspace);

    strictEqual(configuration.snykCodeBaseURL, 'https://deeproxy.custom.snyk.io');
  });

  test('Snyk Code: code url respects custom endpoint configuration', () => {
    const workspace = stubWorkspaceConfiguration(ADVANCED_CUSTOM_ENDPOINT, 'https://custom.endpoint.com/api');
    const configuration = new Configuration({}, workspace);

    strictEqual(configuration.snykCodeUrl, 'https://app.custom.endpoint.com/manage/snyk-code?from=vscode');
  });

  test('Snyk Code: code url respects single tenant endpoint configuration', () => {
    const workspace = stubWorkspaceConfiguration(ADVANCED_CUSTOM_ENDPOINT, 'https://app.custom.snyk.io/api');
    const configuration = new Configuration({}, workspace);

    strictEqual(configuration.snykCodeUrl, 'https://app.custom.snyk.io/manage/snyk-code?from=vscode');
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

    const secretStorageStoreStub = sinon.stub(extensionContext.secrets, 'store').resolves();
    const secretStorageGetStub = sinon.stub(extensionContext.secrets, 'get').resolves(token);

    const configuration = new Configuration(process.env, workspaceStub);
    await configuration.setToken(token);

    strictEqual(await configuration.snykCodeToken, token);
    secretStorageStoreStub.calledWith(SNYK_TOKEN_KEY, token);
    strictEqual(secretStorageGetStub.calledOnce, true);
  });

  test('Snyk Code: token should be cleared if the retrieval method throws', async () => {
    const token = 'snyk-token';

    sinon.stub(extensionContext.secrets, 'store').resolves();
    const secretStorageDeleteStub = sinon.stub(extensionContext.secrets, 'delete').resolves();
    const secretStorageGetStub = sinon.stub(extensionContext.secrets, 'get').rejects('cannot get token');

    const configuration = new Configuration(process.env, workspaceStub);
    await configuration.setToken(token);

    strictEqual(await configuration.snykCodeToken, '');
    strictEqual(secretStorageGetStub.calledOnce, true);
    strictEqual(secretStorageDeleteStub.calledOnce, true);
  });

  test('Snyk Code: token returns Snyk Code token when in development', async () => {
    const token = 'test-token';
    const snykCodeToken = 'snykCode-token';

    const secretStorageStoreStub = sinon.stub(extensionContext.secrets, 'store').resolves();
    const secretStorageGetStub = sinon.stub(extensionContext.secrets, 'get').resolves(token);

    const configuration = new Configuration(
      {
        SNYK_VSCE_DEVELOPMENT: '1',
        SNYK_VSCE_DEVELOPMENT_SNYKCODE_TOKEN: snykCodeToken,
      },
      workspaceStub,
    );
    await configuration.setToken(token);

    strictEqual(await configuration.snykCodeToken, snykCodeToken);
    secretStorageStoreStub.calledWith('snyk.token', token);
    strictEqual(secretStorageGetStub.called, false);
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

    deepStrictEqual(configuration.getPreviewFeatures(), {
      reportFalsePositives: false,
      advisor: false,
    } as PreviewFeatures);
  });

  test('Preview features: some features enabled', () => {
    const previewFeatures = {
      reportFalsePositives: true,
      advisor: false,
    } as PreviewFeatures;
    const workspace = stubWorkspaceConfiguration(FEATURES_PREVIEW_SETTING, previewFeatures);

    const configuration = new Configuration({}, workspace);

    deepStrictEqual(configuration.getPreviewFeatures(), previewFeatures);
  });
});
