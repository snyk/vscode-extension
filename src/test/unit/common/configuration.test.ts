import { deepStrictEqual, strictEqual } from 'assert';
import sinon from 'sinon';
import { ALLISSUES, Configuration, NEWISSUES, PreviewFeatures } from '../../../snyk/common/configuration/configuration';
import { IVSCodeWorkspace } from '../../../snyk/common/vscode/workspace';
import {
  ADVANCED_CLI_PATH,
  ADVANCED_CLI_RELEASE_CHANNEL,
  ADVANCED_CUSTOM_ENDPOINT,
  ADVANCED_CUSTOM_LS_PATH,
  ADVANCED_ORGANIZATION,
  FEATURES_PREVIEW_SETTING,
  SCANNING_MODE,
  CONFIGURATION_IDENTIFIER,
} from '../../../snyk/common/constants/settings';
import SecretStorageAdapter from '../../../snyk/common/vscode/secretStorage';
import { extensionContextMock } from '../mocks/extensionContext.mock';
import { createWorkspaceMockWithInspection, stubWorkspaceConfiguration } from '../mocks/workspace.mock';
import { extensionContext } from '../../../snyk/common/vscode/extensionContext';
import { Platform } from '../../../snyk/common/platform';
import path from 'path';

suite('Configuration', () => {
  setup(() => {
    SecretStorageAdapter.init(extensionContextMock);
    extensionContext.setContext(extensionContextMock);
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

    deepStrictEqual(configuration.getPreviewFeatures(), {});
  });

  test('Preview features: some features enabled', () => {
    const previewFeatures = {} as PreviewFeatures;
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

  suite('Delta Findings Configuration', () => {
    [
      {
        description: 'getDeltaFindingsEnabled() should return true when workspace returns "Net new issues"',
        configValue: NEWISSUES,
        expectedValue: true,
      },
      {
        description: 'getDeltaFindingsEnabled() should return false when workspace returns "All issues"',
        configValue: ALLISSUES,
        expectedValue: false,
      },
      {
        description: 'getDeltaFindingsEnabled() should return false when workspace returns undefined (config not set)',
        configValue: undefined,
        expectedValue: false,
      },
    ].forEach(({ description, configValue, expectedValue }) => {
      test(description, () => {
        const workspace = stubWorkspaceConfiguration(
          `${CONFIGURATION_IDENTIFIER}.allIssuesVsNetNewIssues`,
          configValue,
        );
        const config = new Configuration({}, workspace);

        strictEqual(config.getDeltaFindingsEnabled(), expectedValue);
      });
    });

    [
      {
        description: 'setDeltaFindingsEnabled(true) should call updateConfiguration with "Net new issues"',
        deltaEnabled: true,
        expectedValue: NEWISSUES,
      },
      {
        description: 'setDeltaFindingsEnabled(false) should call updateConfiguration with "All issues"',
        deltaEnabled: false,
        expectedValue: ALLISSUES,
      },
    ].forEach(({ description, deltaEnabled, expectedValue }) => {
      test(description, async () => {
        const updateSpy = sinon.spy();
        const workspace = {
          updateConfiguration: updateSpy,
        } as unknown as IVSCodeWorkspace;
        const config = new Configuration({}, workspace);

        await config.setDeltaFindingsEnabled(deltaEnabled);

        sinon.assert.calledOnceWithExactly(
          updateSpy,
          CONFIGURATION_IDENTIFIER,
          'allIssuesVsNetNewIssues',
          expectedValue,
          true,
        );
      });
    });
  });

  suite('Organization Configuration - Critical Paths', () => {
    suite('Single-Folder Workspace', () => {
      test('organization getter returns ONLY global value in single-folder workspace', () => {
        const workspace = createWorkspaceMockWithInspection<string>(
          ADVANCED_ORGANIZATION,
          {
            globalValue: 'global-org',
            workspaceValue: 'workspace-org',
          },
          1, // single folder
        );

        const configuration = new Configuration({}, workspace);

        strictEqual(configuration.organization, 'global-org');
      });

      test('organization getter ignores workspace value even if set in single-folder workspace', () => {
        const workspace = createWorkspaceMockWithInspection<string>(
          ADVANCED_ORGANIZATION,
          {
            globalValue: undefined,
            workspaceValue: 'workspace-org',
          },
          1, // single folder
        );

        const configuration = new Configuration({}, workspace);

        strictEqual(configuration.organization, '');
      });
    });

    suite('Multi-Folder Workspace', () => {
      test('organization getter prioritizes workspace value over global in multi-folder workspace', () => {
        const workspace = createWorkspaceMockWithInspection<string>(
          ADVANCED_ORGANIZATION,
          {
            globalValue: 'global-org',
            workspaceValue: 'workspace-org',
          },
          2, // multi folder
        );

        const configuration = new Configuration({}, workspace);

        strictEqual(configuration.organization, 'workspace-org');
      });

      test('organization getter falls back to global when no workspace value in multi-folder', () => {
        const workspace = createWorkspaceMockWithInspection<string>(
          ADVANCED_ORGANIZATION,
          {
            globalValue: 'global-org',
            workspaceValue: undefined,
          },
          2, // multi folder
        );

        const configuration = new Configuration({}, workspace);

        strictEqual(configuration.organization, 'global-org');
      });
    });
  });
});
