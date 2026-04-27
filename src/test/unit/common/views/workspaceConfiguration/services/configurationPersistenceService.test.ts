// ABOUTME: Unit tests for ConfigurationPersistenceService
// ABOUTME: Tests organization persistence scope detection logic
import assert from 'assert';
import sinon from 'sinon';
import { ConfigurationPersistenceService } from '../../../../../../snyk/common/views/workspaceConfiguration/services/configurationPersistenceService';
import { IConfiguration } from '../../../../../../snyk/common/configuration/configuration';
import { IVSCodeWorkspace } from '../../../../../../snyk/common/vscode/workspace';
import { IScopeDetectionService } from '../../../../../../snyk/common/views/workspaceConfiguration/services/scopeDetectionService';
import { ILanguageClientAdapter } from '../../../../../../snyk/common/vscode/languageClient';
import { ILog } from '../../../../../../snyk/common/logger/interfaces';
import { CONFIGURATION_IDENTIFIER, DELTA_FINDINGS } from '../../../../../../snyk/common/constants/settings';
import { NEWISSUES } from '../../../../../../snyk/common/configuration/configuration';
import { LS_KEY } from '../../../../../../snyk/common/languageServer/serverSettingsToLspConfigurationParam';
import type { LspConfigurationParam } from '../../../../../../snyk/common/languageServer/types';

suite('ConfigurationPersistenceService - Organization Scope Detection', () => {
  let workspace: IVSCodeWorkspace;
  let configuration: IConfiguration;
  let scopeDetectionService: IScopeDetectionService;
  let clientAdapter: ILanguageClientAdapter;
  let logger: ILog;
  let service: ConfigurationPersistenceService;

  let updateConfigurationStub: sinon.SinonStub;

  setup(() => {
    updateConfigurationStub = sinon.stub().resolves();

    workspace = {
      updateConfiguration: updateConfigurationStub,
      getWorkspaceFolders: sinon.stub().returns([]),
      inspectConfiguration: sinon.stub().returns({}),
    } as unknown as IVSCodeWorkspace;

    configuration = {
      getToken: sinon.stub().resolves('test-token'),
      setToken: sinon.stub().resolves(),
      getFolderConfigs: sinon.stub().returns([]),
      setFolderConfigs: sinon.stub().resolves(),
      getFeaturesConfiguration: sinon.stub().returns({
        ossEnabled: true,
        codeSecurityEnabled: true,
        iacEnabled: true,
        secretsEnabled: true,
      }),
      scanningMode: 'auto',
      organization: '',
      snykApiEndpoint: 'https://api.snyk.io',
      getInsecure: sinon.stub().returns(false),
      getAuthenticationMethod: sinon.stub().returns('oauth'),
      getDeltaFindingsEnabled: sinon.stub().returns(false),
      severityFilter: {},
      issueViewOptions: {},
      riskScoreThreshold: 0,
      getTrustedFolders: sinon.stub().returns([]),
      getCliPath: sinon.stub().resolves(''),
      isAutomaticDependencyManagementEnabled: sinon.stub().returns(true),
      getCliBaseDownloadUrl: sinon.stub().returns(''),
    } as unknown as IConfiguration;

    scopeDetectionService = {
      getSettingScope: sinon.stub().returns('user'),
      populateScopeIndicators: sinon.stub().returns(''),
      shouldSkipSettingUpdate: sinon.stub().returns(false),
    } as unknown as IScopeDetectionService;

    clientAdapter = {
      getLanguageClient: sinon.stub().returns({
        sendNotification: sinon.stub().resolves(),
      }),
    } as unknown as ILanguageClientAdapter;

    logger = {
      info: sinon.stub(),
      debug: sinon.stub(),
      error: sinon.stub(),
      warn: sinon.stub(),
    } as unknown as ILog;

    service = new ConfigurationPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      clientAdapter,
      logger,
    );
  });

  teardown(() => {
    sinon.restore();
  });

  suite('Organization uses scopeDetectionService', () => {
    test('writes org to user scope via scopeDetectionService', async () => {
      (scopeDetectionService.getSettingScope as sinon.SinonStub).returns('user');

      const configJson = JSON.stringify({
        token: 'test-token',
        organization: 'test-org',
        isFallbackForm: false,
      });

      await service.handleSaveConfig(configJson);

      sinon.assert.calledWith(
        updateConfigurationStub,
        CONFIGURATION_IDENTIFIER,
        'advanced.organization',
        'test-org',
        true, // user scope → writeToUserScope = true
      );
    });

    test('writes org to workspace scope via scopeDetectionService', async () => {
      (scopeDetectionService.getSettingScope as sinon.SinonStub).returns('workspace');

      const configJson = JSON.stringify({
        token: 'test-token',
        organization: 'new-org',
        isFallbackForm: false,
      });

      await service.handleSaveConfig(configJson);

      sinon.assert.calledWith(
        updateConfigurationStub,
        CONFIGURATION_IDENTIFIER,
        'advanced.organization',
        'new-org',
        false, // workspace scope → writeToUserScope = false
      );
    });

    test('skips org update when shouldSkipSettingUpdate returns true', async () => {
      (scopeDetectionService.getSettingScope as sinon.SinonStub).returns('user');
      (scopeDetectionService.shouldSkipSettingUpdate as sinon.SinonStub).returns(true);

      const configJson = JSON.stringify({
        token: 'test-token',
        organization: 'test-org',
        isFallbackForm: false,
      });

      await service.handleSaveConfig(configJson);

      sinon.assert.notCalled(updateConfigurationStub);
    });
  });
});

suite('ConfigurationPersistenceService — camelCase / snake_case key compat', () => {
  let workspace: IVSCodeWorkspace;
  let configuration: IConfiguration;
  let scopeDetectionService: IScopeDetectionService;
  let clientAdapter: ILanguageClientAdapter;
  let logger: ILog;
  let updateConfigurationStub: sinon.SinonStub;

  setup(() => {
    updateConfigurationStub = sinon.stub().resolves();
    workspace = {
      updateConfiguration: updateConfigurationStub,
      getWorkspaceFolders: sinon.stub().returns([]),
      inspectConfiguration: sinon.stub().returns({}),
    } as unknown as IVSCodeWorkspace;

    configuration = {
      getToken: sinon.stub().resolves('test-token'),
      setToken: sinon.stub().resolves(),
      getFolderConfigs: sinon.stub().returns([]),
      setFolderConfigs: sinon.stub().resolves(),
    } as unknown as IConfiguration;

    scopeDetectionService = {
      getSettingScope: sinon.stub().returns('user'),
      populateScopeIndicators: sinon.stub().returns(''),
      shouldSkipSettingUpdate: sinon.stub().returns(false),
    } as unknown as IScopeDetectionService;

    clientAdapter = {
      getLanguageClient: sinon.stub().returns({
        sendNotification: sinon.stub().resolves(),
      }),
    } as unknown as ILanguageClientAdapter;

    logger = {
      info: sinon.stub(),
      debug: sinon.stub(),
      error: sinon.stub(),
      warn: sinon.stub(),
    } as unknown as ILog;
  });

  teardown(() => {
    sinon.restore();
  });

  test('maps camelCase cliPath from old CLI to VS Code setting', async () => {
    const service = new ConfigurationPersistenceService(workspace, configuration, scopeDetectionService, clientAdapter, logger);

    const configJson = JSON.stringify({
      isFallbackForm: true,
      cliPath: '/usr/local/bin/snyk',
    });

    await service.handleSaveConfig(configJson);

    sinon.assert.calledWith(updateConfigurationStub, CONFIGURATION_IDENTIFIER, 'advanced.cliPath', '/usr/local/bin/snyk', true);
  });

  test('maps snake_case cli_path from new CLI to VS Code setting', async () => {
    const service = new ConfigurationPersistenceService(workspace, configuration, scopeDetectionService, clientAdapter, logger);

    const configJson = JSON.stringify({
      isFallbackForm: true,
      cli_path: '/usr/local/bin/snyk',
    });

    await service.handleSaveConfig(configJson);

    sinon.assert.calledWith(updateConfigurationStub, CONFIGURATION_IDENTIFIER, 'advanced.cliPath', '/usr/local/bin/snyk', true);
  });

  test('maps camelCase cliReleaseChannel from old CLI to VS Code setting', async () => {
    const service = new ConfigurationPersistenceService(workspace, configuration, scopeDetectionService, clientAdapter, logger);

    const configJson = JSON.stringify({
      isFallbackForm: true,
      cliReleaseChannel: 'preview',
    });

    await service.handleSaveConfig(configJson);

    sinon.assert.calledWith(updateConfigurationStub, CONFIGURATION_IDENTIFIER, 'advanced.cliReleaseChannel', 'preview', true);
  });

  test('maps snake_case cli_release_channel from new CLI to VS Code setting', async () => {
    const service = new ConfigurationPersistenceService(workspace, configuration, scopeDetectionService, clientAdapter, logger);

    const configJson = JSON.stringify({
      isFallbackForm: true,
      cli_release_channel: 'preview',
    });

    await service.handleSaveConfig(configJson);

    sinon.assert.calledWith(updateConfigurationStub, CONFIGURATION_IDENTIFIER, 'advanced.cliReleaseChannel', 'preview', true);
  });

  test('maps legacy form key enableDeltaFindings from old CLI to VS Code setting', async () => {
    const service = new ConfigurationPersistenceService(workspace, configuration, scopeDetectionService, clientAdapter, logger);

    const configJson = JSON.stringify({
      isFallbackForm: false,
      token: 'test-token',
      enableDeltaFindings: true,
    });

    await service.handleSaveConfig(configJson);

    sinon.assert.calledWith(updateConfigurationStub, CONFIGURATION_IDENTIFIER, DELTA_FINDINGS.replace(`${CONFIGURATION_IDENTIFIER}.`, ''), NEWISSUES, true);
  });

  test('maps legacy form key endpoint from old CLI to VS Code setting', async () => {
    const service = new ConfigurationPersistenceService(workspace, configuration, scopeDetectionService, clientAdapter, logger);

    const configJson = JSON.stringify({
      isFallbackForm: false,
      token: 'test-token',
      endpoint: 'https://custom.snyk.io',
    });

    await service.handleSaveConfig(configJson);

    sinon.assert.calledWith(updateConfigurationStub, CONFIGURATION_IDENTIFIER, 'advanced.customEndpoint', 'https://custom.snyk.io', true);
  });

  test('maps legacy form key manageBinariesAutomatically from old CLI to VS Code setting', async () => {
    const service = new ConfigurationPersistenceService(workspace, configuration, scopeDetectionService, clientAdapter, logger);

    const configJson = JSON.stringify({
      isFallbackForm: true,
      manageBinariesAutomatically: true,
    });

    await service.handleSaveConfig(configJson);

    sinon.assert.calledWith(updateConfigurationStub, CONFIGURATION_IDENTIFIER, 'advanced.automaticDependencyManagement', true, true);
  });

  test('prefers snake_case key when both are present', async () => {
    const service = new ConfigurationPersistenceService(workspace, configuration, scopeDetectionService, clientAdapter, logger);

    const configJson = JSON.stringify({
      isFallbackForm: true,
      cli_path: '/snake/path',
      cliPath: '/camel/path',
    });

    await service.handleSaveConfig(configJson);

    sinon.assert.calledWith(updateConfigurationStub, CONFIGURATION_IDENTIFIER, 'advanced.cliPath', '/snake/path', true);
  });
});

suite('ConfigurationPersistenceService — persistInbound trusts LS', () => {
  let workspace: IVSCodeWorkspace;
  let configuration: IConfiguration;
  let scopeDetectionService: IScopeDetectionService;
  let clientAdapter: ILanguageClientAdapter;
  let logger: ILog;
  let updateConfigurationStub: sinon.SinonStub;

  setup(() => {
    updateConfigurationStub = sinon.stub().resolves();
    workspace = {
      updateConfiguration: updateConfigurationStub,
      getWorkspaceFolders: sinon.stub().returns([]),
      getWorkspaceFolderPaths: sinon.stub().returns([]),
      inspectConfiguration: sinon.stub().returns({
        globalValue: undefined,
        workspaceValue: undefined,
        workspaceFolderValue: undefined,
      }),
    } as unknown as IVSCodeWorkspace;

    configuration = {
      getToken: sinon.stub().resolves('tok'),
      setToken: sinon.stub().resolves(),
      getFolderConfigs: sinon.stub().returns([]),
      setFolderConfigs: sinon.stub().resolves(),
      getFeaturesConfiguration: sinon.stub().returns({
        ossEnabled: true,
        codeSecurityEnabled: true,
        iacEnabled: true,
        secretsEnabled: true,
      }),
      scanningMode: 'auto',
      organization: '',
      snykApiEndpoint: 'https://api.snyk.io',
      getInsecure: sinon.stub().returns(false),
      getAuthenticationMethod: sinon.stub().returns('oauth'),
      getDeltaFindingsEnabled: sinon.stub().returns(false),
      severityFilter: {},
      issueViewOptions: {},
      riskScoreThreshold: 0,
      getTrustedFolders: sinon.stub().returns([]),
      getCliPath: sinon.stub().resolves(''),
      isAutomaticDependencyManagementEnabled: sinon.stub().returns(true),
      getCliBaseDownloadUrl: sinon.stub().returns(''),
    } as unknown as IConfiguration;

    scopeDetectionService = {
      getSettingScope: sinon.stub().returns('user'),
      populateScopeIndicators: sinon.stub().returns(''),
      shouldSkipSettingUpdate: sinon.stub().returns(false),
    } as unknown as IScopeDetectionService;

    clientAdapter = {
      getLanguageClient: sinon.stub().returns({
        sendNotification: sinon.stub().resolves(),
      }),
    } as unknown as ILanguageClientAdapter;

    logger = {
      info: sinon.stub(),
      debug: sinon.stub(),
      error: sinon.stub(),
      warn: sinon.stub(),
    } as unknown as ILog;
  });

  teardown(() => {
    sinon.restore();
  });

  test('persists LS endpoint directly without filtering', async () => {
    const service = new ConfigurationPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      clientAdapter,
      logger,
    );

    const param: LspConfigurationParam = {
      settings: {
        [LS_KEY.apiEndpoint]: { value: 'https://from-ls.example', changed: true },
      },
    };

    await service.persistInboundLspConfiguration(param);

    sinon.assert.called(updateConfigurationStub);
  });

  test('persistInbound writes delta setting from global settings', async () => {
    const service = new ConfigurationPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      clientAdapter,
      logger,
    );

    const param: LspConfigurationParam = {
      settings: {
        [LS_KEY.scanNetNew]: { value: true, changed: true },
      },
    };

    await service.persistInboundLspConfiguration(param);

    sinon.assert.calledWith(
      updateConfigurationStub,
      CONFIGURATION_IDENTIFIER,
      DELTA_FINDINGS.replace(`${CONFIGURATION_IDENTIFIER}.`, ''),
      NEWISSUES,
      true,
    );
  });

  test('persistInbound clears folder configs when LS sends empty array', async () => {
    const svc = new ConfigurationPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      clientAdapter,
      logger,
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const setFolderConfigsStub = configuration.setFolderConfigs as unknown as sinon.SinonStub;

    const param: LspConfigurationParam = {
      settings: {},
      folderConfigs: [],
    };

    await svc.persistInboundLspConfiguration(param);

    sinon.assert.calledOnce(setFolderConfigsStub);
    assert.deepStrictEqual(setFolderConfigsStub.firstCall.args[0], []);
  });

  test('persistInbound does not call setFolderConfigs when folderConfigs is absent', async () => {
    const svc = new ConfigurationPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      clientAdapter,
      logger,
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const setFolderConfigsStub = configuration.setFolderConfigs as unknown as sinon.SinonStub;

    const param: LspConfigurationParam = {
      settings: {},
    };

    await svc.persistInboundLspConfiguration(param);

    sinon.assert.notCalled(setFolderConfigsStub);
  });
});
