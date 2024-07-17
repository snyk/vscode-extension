/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { deepStrictEqual, strictEqual } from 'assert';
import sinon from 'sinon';
import { Configuration, PreviewFeatures } from '../../../snyk/common/configuration/configuration';
import { SNYK_TOKEN_KEY } from '../../../snyk/common/constants/general';
import {
  ADVANCED_CUSTOM_ENDPOINT,
  FEATURES_PREVIEW_SETTING,
  SCANNING_MODE,
} from '../../../snyk/common/constants/settings';
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
      deltaFindings: false,
    } as PreviewFeatures);
  });

  test('Preview features: some features enabled', () => {
    const previewFeatures = {
      advisor: false,
      deltaFindings: false,
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
  });
});
