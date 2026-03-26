// ABOUTME: Unit tests for ConfigurationPersistenceService
// ABOUTME: Tests organization persistence scope detection logic
import sinon from 'sinon';
import { Uri } from 'vscode';
import { ConfigurationPersistenceService } from '../../../../../../snyk/common/views/workspaceConfiguration/services/configurationPersistenceService';
import { IConfiguration } from '../../../../../../snyk/common/configuration/configuration';
import { IVSCodeWorkspace } from '../../../../../../snyk/common/vscode/workspace';
import { IScopeDetectionService } from '../../../../../../snyk/common/views/workspaceConfiguration/services/scopeDetectionService';
import { IConfigurationMappingService } from '../../../../../../snyk/common/views/workspaceConfiguration/services/configurationMappingService';
import { ILanguageClientAdapter } from '../../../../../../snyk/common/vscode/languageClient';
import { ILog } from '../../../../../../snyk/common/logger/interfaces';
import type { IExplicitLspConfigurationChangeTracker } from '../../../../../../snyk/common/languageServer/explicitLspConfigurationChangeTracker';
import { ADVANCED_ORGANIZATION, CONFIGURATION_IDENTIFIER } from '../../../../../../snyk/common/constants/settings';
import { WorkspaceFolder } from '../../../../../../snyk/common/vscode/types';
import { PFLAG } from '../../../../../../snyk/common/languageServer/serverSettingsToLspConfigurationParam';
import type { MergedLspConfigurationView } from '../../../../../../snyk/common/languageServer/lspConfigurationMerge';

function createMockUri(path: string): Uri {
  return {
    fsPath: path,
    scheme: 'file',
    authority: '',
    path: path,
    query: '',
    fragment: '',
    with: () => createMockUri(path),
    toString: () => `file://${path}`,
    toJSON: () => ({ fsPath: path }),
  } as Uri;
}

suite('ConfigurationPersistenceService - Organization Scope Detection', () => {
  let workspace: IVSCodeWorkspace;
  let configuration: IConfiguration;
  let scopeDetectionService: IScopeDetectionService;
  let configMappingService: IConfigurationMappingService;
  let clientAdapter: ILanguageClientAdapter;
  let logger: ILog;
  let explicitLspConfigurationChangeTracker: IExplicitLspConfigurationChangeTracker;
  let service: ConfigurationPersistenceService;

  let updateConfigurationStub: sinon.SinonStub;
  let getWorkspaceFoldersStub: sinon.SinonStub;
  let inspectConfigurationStub: sinon.SinonStub;

  setup(() => {
    updateConfigurationStub = sinon.stub().resolves();
    getWorkspaceFoldersStub = sinon.stub();
    inspectConfigurationStub = sinon.stub();

    workspace = {
      updateConfiguration: updateConfigurationStub,
      getWorkspaceFolders: getWorkspaceFoldersStub,
      inspectConfiguration: inspectConfigurationStub,
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

    configMappingService = {
      mapConfigToSettings: sinon.stub().returns({ [ADVANCED_ORGANIZATION]: 'test-org' }),
      mapHtmlKeyToVSCodeSetting: sinon.stub().returns(undefined),
    } as unknown as IConfigurationMappingService;

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

    explicitLspConfigurationChangeTracker = {
      markExplicitlyChanged: sinon.stub(),
      isExplicitlyChanged: sinon.stub().returns(false),
    };

    service = new ConfigurationPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      configMappingService,
      clientAdapter,
      explicitLspConfigurationChangeTracker,
      logger,
    );
  });

  teardown(() => {
    sinon.restore();
  });

  suite('Scope Detection Logic - Line 91', () => {
    test('writes to user scope in single-folder workspace', async () => {
      // Setup single-folder workspace
      const mockFolder: WorkspaceFolder = {
        uri: createMockUri('/test/folder'),
        name: 'folder',
        index: 0,
      };
      getWorkspaceFoldersStub.returns([mockFolder]);

      // Setup inspection to return no workspace value
      inspectConfigurationStub.returns({
        globalValue: undefined,
        workspaceValue: undefined,
        workspaceFolderValue: undefined,
      });

      // Mock mapConfigToSettings to return organization setting
      (configMappingService.mapConfigToSettings as sinon.SinonStub).returns({
        [ADVANCED_ORGANIZATION]: 'test-org',
      });

      const configJson = JSON.stringify({
        token: 'test-token',
        isFallbackForm: false,
      });

      await service.handleSaveConfig(configJson);

      // Verify updateConfiguration was called with user scope (true)
      sinon.assert.calledWith(
        updateConfigurationStub,
        CONFIGURATION_IDENTIFIER,
        'advanced.organization',
        'test-org',
        true, // writeToUserScope should be true
      );
    });

    test('writes to workspace scope when previously modified at workspace level in multi-folder', async () => {
      // Setup multi-folder workspace
      const mockFolder1: WorkspaceFolder = {
        uri: createMockUri('/test/folder1'),
        name: 'folder1',
        index: 0,
      };
      const mockFolder2: WorkspaceFolder = {
        uri: createMockUri('/test/folder2'),
        name: 'folder2',
        index: 1,
      };
      getWorkspaceFoldersStub.returns([mockFolder1, mockFolder2]);

      // Setup inspection to show workspace value exists
      inspectConfigurationStub.returns({
        globalValue: undefined,
        workspaceValue: 'existing-workspace-org',
        workspaceFolderValue: undefined,
      });

      // Mock mapConfigToSettings to return organization setting
      (configMappingService.mapConfigToSettings as sinon.SinonStub).returns({
        [ADVANCED_ORGANIZATION]: 'new-org',
      });

      const configJson = JSON.stringify({
        token: 'test-token',
        isFallbackForm: false,
      });

      await service.handleSaveConfig(configJson);

      // Verify updateConfiguration was called with workspace scope (false)
      sinon.assert.calledWith(
        updateConfigurationStub,
        CONFIGURATION_IDENTIFIER,
        'advanced.organization',
        'new-org',
        false, // writeToUserScope should be false
      );
    });

    test('writes to user scope when NOT previously modified in multi-folder workspace', async () => {
      // Setup multi-folder workspace
      const mockFolder1: WorkspaceFolder = {
        uri: createMockUri('/test/folder1'),
        name: 'folder1',
        index: 0,
      };
      const mockFolder2: WorkspaceFolder = {
        uri: createMockUri('/test/folder2'),
        name: 'folder2',
        index: 1,
      };
      getWorkspaceFoldersStub.returns([mockFolder1, mockFolder2]);

      // Setup inspection to show NO workspace value
      inspectConfigurationStub.returns({
        globalValue: 'global-org',
        workspaceValue: undefined,
        workspaceFolderValue: undefined,
      });

      // Mock mapConfigToSettings to return organization setting
      (configMappingService.mapConfigToSettings as sinon.SinonStub).returns({
        [ADVANCED_ORGANIZATION]: 'test-org',
      });

      const configJson = JSON.stringify({
        token: 'test-token',
        isFallbackForm: false,
      });

      await service.handleSaveConfig(configJson);

      // Verify updateConfiguration was called with user scope (true)
      sinon.assert.calledWith(
        updateConfigurationStub,
        CONFIGURATION_IDENTIFIER,
        'advanced.organization',
        'test-org',
        true, // writeToUserScope should be true
      );
    });
  });
});

suite('ConfigurationPersistenceService — persistInbound explicit overrides', () => {
  let workspace: IVSCodeWorkspace;
  let configuration: IConfiguration;
  let scopeDetectionService: IScopeDetectionService;
  let configMappingService: IConfigurationMappingService;
  let clientAdapter: ILanguageClientAdapter;
  let logger: ILog;
  let updateConfigurationStub: sinon.SinonStub;

  setup(() => {
    updateConfigurationStub = sinon.stub().resolves();
    workspace = {
      updateConfiguration: updateConfigurationStub,
      getWorkspaceFolders: sinon.stub().returns([]),
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

    configMappingService = {
      mapConfigToSettings: sinon.stub().returns({}),
      mapHtmlKeyToVSCodeSetting: sinon.stub().returns(undefined),
    } as unknown as IConfigurationMappingService;

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

  test('reconciles and skips settings when explicit api endpoint disagrees with LS', async () => {
    const reconcileStub = sinon.stub();
    const explicitTracker = {
      markExplicitlyChanged: sinon.stub(),
      isExplicitlyChanged: sinon.stub().callsFake((k: string) => k === PFLAG.apiEndpoint),
    };

    const service = new ConfigurationPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      configMappingService,
      clientAdapter,
      explicitTracker,
      logger,
      reconcileStub,
    );

    const view: MergedLspConfigurationView = {
      globalSettings: {
        [PFLAG.apiEndpoint]: { value: 'https://from-ls.example', changed: true },
      },
      folderSettingsByPath: {},
    };

    await service.persistInboundLspConfiguration(view);

    sinon.assert.notCalled(updateConfigurationStub);
    sinon.assert.calledOnce(reconcileStub);
  });
});
