/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { deepStrictEqual, strictEqual } from 'assert';
import sinon from 'sinon';
import { Configuration, PreviewFeatures } from '../../../snyk/common/configuration/configuration';
import {
  ADVANCED_CLI_PATH,
  ADVANCED_CLI_RELEASE_CHANNEL,
  ADVANCED_CUSTOM_ENDPOINT,
  ADVANCED_CUSTOM_LS_PATH,
  FEATURES_PREVIEW_SETTING,
  SCANNING_MODE,
} from '../../../snyk/common/constants/settings';
import SecretStorageAdapter from '../../../snyk/common/vscode/secretStorage';
import { IVSCodeWorkspace } from '../../../snyk/common/vscode/workspace';
import { extensionContextMock } from '../mocks/extensionContext.mock';
import { stubWorkspaceConfiguration } from '../mocks/workspace.mock';
import { extensionContext } from '../../../snyk/common/vscode/extensionContext';
import { Platform } from '../../../snyk/common/platform';
import path from 'path';

suite('Configuration', () => {
  let workspaceStub: IVSCodeWorkspace;

  setup(() => {
    const tokenConfigSection = 'token';

    let token = '';
    SecretStorageAdapter.init(extensionContextMock);
    extensionContext.setContext(extensionContextMock);
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

  test('Snyk Code URL: respects custom endpoint configuration', () => {
    const workspace = stubWorkspaceConfiguration(ADVANCED_CUSTOM_ENDPOINT, 'https://api.custom.endpoint.com');
    const configuration = new Configuration({}, workspace);

    strictEqual(configuration.snykCodeUrl, 'https://app.custom.endpoint.com/manage/snyk-code?from=vscode');
  });

  test('Snyk Code URL: respects single tenant endpoint configuration', () => {
    const workspace = stubWorkspaceConfiguration(ADVANCED_CUSTOM_ENDPOINT, 'https://api.custom.snyk.io');
    const configuration = new Configuration({}, workspace);

    strictEqual(configuration.snykCodeUrl, 'https://app.custom.snyk.io/manage/snyk-code?from=vscode');
  });

  test('Snyk Code URL: respects FedRAMP endpoint configuration', () => {
    const workspace = stubWorkspaceConfiguration(ADVANCED_CUSTOM_ENDPOINT, 'https://api.custom.snykgov.io');
    const configuration = new Configuration({}, workspace);

    strictEqual(configuration.snykCodeUrl, 'https://app.custom.snykgov.io/manage/snyk-code?from=vscode');
  });

  test('API endpoint: returns default endpoint when no custom set', () => {
    const workspace = stubWorkspaceConfiguration(ADVANCED_CUSTOM_ENDPOINT, undefined);

    const configuration = new Configuration({}, workspace);

    strictEqual(configuration.snykApiEndpoint, 'https://api.snyk.io');
  });

  test('API endpoint: returns custom endpoint when set', () => {
    const customEndpoint = 'http://custom.endpoint.com';
    const workspace = stubWorkspaceConfiguration(ADVANCED_CUSTOM_ENDPOINT, customEndpoint);

    const configuration = new Configuration({}, workspace);

    strictEqual(configuration.snykApiEndpoint, customEndpoint);
  });

  test('Preview features: not enabled', () => {
    const previewFeatures = undefined;
    const workspace = stubWorkspaceConfiguration(FEATURES_PREVIEW_SETTING, previewFeatures);

    const configuration = new Configuration({}, workspace);

    deepStrictEqual(configuration.getPreviewFeatures(), {
      advisor: false,
      ossQuickfixes: false,
    } as PreviewFeatures);
  });

  test('Preview features: some features enabled', () => {
    const previewFeatures = {
      advisor: false,
      ossQuickfixes: false,
    } as PreviewFeatures;
    const workspace = stubWorkspaceConfiguration(FEATURES_PREVIEW_SETTING, previewFeatures);

    const configuration = new Configuration({}, workspace);

    deepStrictEqual(configuration.getPreviewFeatures(), previewFeatures);
  });

  ['auto', 'manual'].forEach(mode => {
    test(`Scanning mode: returns correct value (${mode})`, () => {
      const workspace = stubWorkspaceConfiguration(SCANNING_MODE, mode);

      const configuration = new Configuration({}, workspace);

      strictEqual(configuration.scanningMode, mode);
    });
  });

  suite('.isFedramp()', () => {
    test('returns true for FEDRAMP URLs', () => {
      const fedrampUrl = 'https://api.fedramp.snykgov.io';
      const workspace = stubWorkspaceConfiguration(ADVANCED_CUSTOM_ENDPOINT, fedrampUrl);

      const configuration = new Configuration({}, workspace);

      strictEqual(configuration.isFedramp, true);
    });

    test('returns false for non-FEDRAMP URLs', () => {
      const nonFedrampUrl = 'https://api.snyk.io';
      const workspace = stubWorkspaceConfiguration(ADVANCED_CUSTOM_ENDPOINT, nonFedrampUrl);

      const configuration = new Configuration({}, workspace);

      strictEqual(configuration.isFedramp, false);
    });

    test('CLI Path: Returns default path if empty', async () => {
      const workspace = stubWorkspaceConfiguration(ADVANCED_CLI_PATH, '');

      const configuration = new Configuration({}, workspace);
      sinon.stub(Platform, 'getCurrent').returns('linux');
      sinon.stub(Platform, 'getArch').returns('x64');

      const cliPath = await configuration.getCliPath();

      const expectedCliPath = path.join(Platform.getHomeDir(), '.local/share/snyk/vscode-cli', 'snyk-linux');
      strictEqual(cliPath, expectedCliPath);
    });

    test('CLI Path: Returns Snyk LS path', async () => {
      const workspace = stubWorkspaceConfiguration(ADVANCED_CUSTOM_LS_PATH, '/path/to/ls');

      const configuration = new Configuration({}, workspace);

      const cliPath = await configuration.getCliPath();
      strictEqual(cliPath, '/path/to/ls');
    });

    test('CLI Path: Returns CLI Path if set', async () => {
      const workspace = stubWorkspaceConfiguration(ADVANCED_CLI_PATH, '/path/to/cli');

      const configuration = new Configuration({}, workspace);

      const cliPath = await configuration.getCliPath();
      strictEqual(cliPath, '/path/to/cli');
    });

    test('CLI Release Channel: Return preview if extension is preview and release channel is default', async () => {
      const workspace = stubWorkspaceConfiguration(ADVANCED_CLI_RELEASE_CHANNEL, 'stable');

      const configuration = new Configuration({}, workspace);
      configuration.setExtensionId('snyk-vulnerability-scanner-preview');
      const cliReleaseChannel = await configuration.getCliReleaseChannel();
      strictEqual(cliReleaseChannel, 'preview');
    });

    test('CLI Release Channel: Return current release channel without change if extension is not preview', async () => {
      const workspace = stubWorkspaceConfiguration(ADVANCED_CLI_RELEASE_CHANNEL, 'stable');

      const configuration = new Configuration({}, workspace);
      configuration.setExtensionId('snyk-vulnerability-scanner');
      const cliReleaseChannel = await configuration.getCliReleaseChannel();
      strictEqual(cliReleaseChannel, 'stable');
    });

    test('CLI Release Channel: Return current version if release channel not stable and extension is preview', async () => {
      const workspace = stubWorkspaceConfiguration(ADVANCED_CLI_RELEASE_CHANNEL, 'v1.1294.0');

      const configuration = new Configuration({}, workspace);
      configuration.setExtensionId('snyk-vulnerability-scanner-preview');
      const cliReleaseChannel = await configuration.getCliReleaseChannel();
      strictEqual(cliReleaseChannel, 'v1.1294.0');
    });
  });
});
