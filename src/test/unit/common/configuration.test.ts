/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { deepStrictEqual, strictEqual, throws } from 'assert';
import os from 'os';
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
      lsAuthenticate: false,
    } as PreviewFeatures);
  });

  test('Preview features: some features enabled', () => {
    const previewFeatures = {
      reportFalsePositives: true,
      advisor: false,
      lsAuthenticate: false,
    } as PreviewFeatures;
    const workspace = stubWorkspaceConfiguration(FEATURES_PREVIEW_SETTING, previewFeatures);

    const configuration = new Configuration({}, workspace);

    deepStrictEqual(configuration.getPreviewFeatures(), previewFeatures);
  });

  test('Snyk LS: Throws when platform is not supported', () => {
    sinon.stub(os, 'platform').returns('sunos');
    const configuration = new Configuration({}, workspaceStub);

    throws(() => configuration.getSnykLanguageServerPath2());
  });

  test('Snyk LS: Language Server path custom path when set', () => {
    const customPath = '/path/to/language/server/binary/darwin_arm64';
    sinon.stub(workspaceStub, 'getConfiguration').returns(customPath);

    const configuration = new Configuration({}, workspaceStub);
    strictEqual(configuration.getSnykLanguageServerPath2(), customPath);
  });

  test('Snyk LS: Language Server path uses XDG_DATA_HOME when set', () => {
    sinon.stub(os, 'platform').returns('darwin');
    sinon.stub(os, 'arch').returns('arm64');
    sinon.stub(workspaceStub, 'getConfiguration').returns(null);

    const XDG_DATA_HOME = '/path/to/language/server/binary';
    const configuration = new Configuration({ XDG_DATA_HOME }, workspaceStub);
    const expectedPath = `${XDG_DATA_HOME}/darwin_arm64`;

    strictEqual(configuration.getSnykLanguageServerPath2(), expectedPath);
  });

  test('Snyk LS: Language Server path is returned when set', () => {
    const platformStub = sinon.stub(os, 'platform');
    const archStub = sinon.stub(os, 'arch');
    const homedirStub = sinon.stub(os, 'homedir');
    sinon.stub(workspaceStub, 'getConfiguration').returns(null);

    // OSX
    const osxHome = '/Users/snyk.user';
    let expectedPath = `${osxHome}/Library/Application Support`;
    const configuration = new Configuration({}, workspaceStub);

    platformStub.returns('darwin');
    archStub.returns('arm64');
    homedirStub.returns(osxHome);
    strictEqual(configuration.getSnykLanguageServerPath2(), `${expectedPath}/darwin_arm64`);

    archStub.returns('amd64');
    strictEqual(configuration.getSnykLanguageServerPath2(), `${expectedPath}/darwin_amd64`);

    // Linux
    const linuxHome = '/home/snyk.user';
    expectedPath = `${linuxHome}/.local/share`;

    platformStub.returns('linux');
    archStub.returns('ia32');
    homedirStub.returns(linuxHome);
    strictEqual(configuration.getSnykLanguageServerPath2(), `${expectedPath}/linux_386`);

    archStub.returns('x64');
    strictEqual(configuration.getSnykLanguageServerPath2(), `${expectedPath}/linux_amd64`);

    archStub.returns('arm64');
    strictEqual(configuration.getSnykLanguageServerPath2(), `${expectedPath}/linux_arm64`);

    // Windows
    const windowsHome = 'C:\\Users\\snyk.user';
    expectedPath = `${windowsHome}\\AppData\\Local\\snyk`;

    platformStub.returns('win32');
    archStub.returns('ia32');
    homedirStub.returns(windowsHome);
    strictEqual(configuration.getSnykLanguageServerPath2(), `${expectedPath}\\windows_386.exe`);

    archStub.returns('x64');
    strictEqual(configuration.getSnykLanguageServerPath2(), `${expectedPath}\\windows_amd64.exe`);
  });
});
