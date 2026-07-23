// ABOUTME: Unit tests for ConfigurationPersistenceService
// ABOUTME: Tests organization persistence scope detection logic
import assert from 'assert';
import sinon from 'sinon';
import { ConfigurationPersistenceService } from '../../../../../../snyk/common/views/workspaceConfiguration/services/configurationPersistenceService';
import { FolderConfig, IConfiguration } from '../../../../../../snyk/common/configuration/configuration';
import { IVSCodeWorkspace } from '../../../../../../snyk/common/vscode/workspace';
import {
  IScopeDetectionService,
  ScopeDetectionService,
} from '../../../../../../snyk/common/views/workspaceConfiguration/services/scopeDetectionService';
import { ILanguageClientAdapter } from '../../../../../../snyk/common/vscode/languageClient';
import { ILog } from '../../../../../../snyk/common/logger/interfaces';
import {
  ADVANCED_CUSTOM_ENDPOINT,
  ADVANCED_ORGANIZATION,
  CODE_SECURITY_ENABLED_SETTING,
  CONFIGURATION_IDENTIFIER,
  DELTA_FINDINGS,
} from '../../../../../../snyk/common/constants/settings';
import { ALLISSUES, NEWISSUES } from '../../../../../../snyk/common/configuration/configuration';
import {
  LS_GLOBAL_KEY,
  LS_KEY,
} from '../../../../../../snyk/common/languageServer/serverSettingsToLspConfigurationParam';
import type { LspConfigurationParam } from '../../../../../../snyk/common/languageServer/types';
import { IExplicitLspConfigurationChangeTracker } from '../../../../../../snyk/common/languageServer/explicitLspConfigurationChangeTracker';
import { LanguageServerSettings } from '../../../../../../snyk/common/languageServer/settings';
import {
  GLOBAL_RESET_FIELDS,
  mapConfigToSettings,
  SETTINGS_REGISTRY,
} from '../../../../../../snyk/common/languageServer/lsKeyToVscodeKeyMap';
import {
  ExplicitOverridesMap,
  IExplicitOverridesMap,
} from '../../../../../../snyk/common/languageServer/explicitOverridesMap';
import { LastKnownValueCache } from '../../../../../../snyk/common/languageServer/lastKnownValueCache';

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

    // The outbound save path no longer consults shouldSkipSettingUpdate at all: both settings
    // webviews only send a field when its value genuinely changed (client-side dirty-tracking),
    // so every key present in the payload is written directly — this is what structurally rules
    // out the IDE-2149 class of bug (a save silently skipped because it looked redundant).
    test('writes org even when shouldSkipSettingUpdate returns true (outbound never consults it)', async () => {
      (scopeDetectionService.getSettingScope as sinon.SinonStub).returns('user');
      (scopeDetectionService.shouldSkipSettingUpdate as sinon.SinonStub).returns(true);

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
        true,
      );
    });
  });
});

suite('ConfigurationPersistenceService — LS key mapping', () => {
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

  test('maps cli_path LS key to VS Code setting', async () => {
    const service = new ConfigurationPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      clientAdapter,
      logger,
    );

    const configJson = JSON.stringify({
      isFallbackForm: true,
      cli_path: '/usr/local/bin/snyk',
    });

    await service.handleSaveConfig(configJson);

    sinon.assert.calledWith(
      updateConfigurationStub,
      CONFIGURATION_IDENTIFIER,
      'advanced.cliPath',
      '/usr/local/bin/snyk',
      true,
    );
  });

  test('does not throw when saving while the Language Server is not running', async () => {
    // getLanguageClient() returns undefined until the LS has started (e.g. fallback settings
    // page while the CLI is still downloading). The save must still persist settings.
    const noClientAdapter = {
      getLanguageClient: sinon.stub().returns(undefined),
    } as unknown as ILanguageClientAdapter;

    const service = new ConfigurationPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      noClientAdapter,
      logger,
    );

    const configJson = JSON.stringify({
      isFallbackForm: true,
      cli_path: '/usr/local/bin/snyk',
    });

    await service.handleSaveConfig(configJson);

    sinon.assert.calledWith(
      updateConfigurationStub,
      CONFIGURATION_IDENTIFIER,
      'advanced.cliPath',
      '/usr/local/bin/snyk',
      true,
    );
  });

  test('maps cli_release_channel LS key to VS Code setting', async () => {
    const service = new ConfigurationPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      clientAdapter,
      logger,
    );

    const configJson = JSON.stringify({
      isFallbackForm: true,
      cli_release_channel: 'preview',
    });

    await service.handleSaveConfig(configJson);

    sinon.assert.calledWith(
      updateConfigurationStub,
      CONFIGURATION_IDENTIFIER,
      'advanced.cliReleaseChannel',
      'preview',
      true,
    );
  });

  test('maps scan_net_new LS key to VS Code setting', async () => {
    const service = new ConfigurationPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      clientAdapter,
      logger,
    );

    const configJson = JSON.stringify({
      isFallbackForm: false,
      token: 'test-token',
      scan_net_new: true,
    });

    await service.handleSaveConfig(configJson);

    sinon.assert.calledWith(
      updateConfigurationStub,
      CONFIGURATION_IDENTIFIER,
      DELTA_FINDINGS.replace(`${CONFIGURATION_IDENTIFIER}.`, ''),
      NEWISSUES,
      true,
    );
  });

  test('maps api_endpoint LS key to VS Code setting', async () => {
    const service = new ConfigurationPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      clientAdapter,
      logger,
    );

    const configJson = JSON.stringify({
      isFallbackForm: false,
      token: 'test-token',
      api_endpoint: 'https://custom.snyk.io',
    });

    await service.handleSaveConfig(configJson);

    sinon.assert.calledWith(
      updateConfigurationStub,
      CONFIGURATION_IDENTIFIER,
      'advanced.customEndpoint',
      'https://custom.snyk.io',
      true,
    );
  });

  test('maps automatic_download LS key to VS Code setting in fallback form', async () => {
    const service = new ConfigurationPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      clientAdapter,
      logger,
    );

    const configJson = JSON.stringify({
      isFallbackForm: true,
      automatic_download: true,
    });

    await service.handleSaveConfig(configJson);

    sinon.assert.calledWith(
      updateConfigurationStub,
      CONFIGURATION_IDENTIFIER,
      'advanced.automaticDependencyManagement',
      true,
      true,
    );
  });

  test('maps cli_path LS key to VS Code setting in fallback form', async () => {
    const service = new ConfigurationPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      clientAdapter,
      logger,
    );

    const configJson = JSON.stringify({
      isFallbackForm: true,
      cli_path: '/some/path',
    });

    await service.handleSaveConfig(configJson);

    sinon.assert.calledWith(updateConfigurationStub, CONFIGURATION_IDENTIFIER, 'advanced.cliPath', '/some/path', true);
  });
});

suite('ConfigurationPersistenceService — persistInbound trusts LS', () => {
  let workspace: IVSCodeWorkspace;
  let configuration: IConfiguration;
  // CP-2.3: real ScopeDetectionService — replaces the old faked stub that returned false
  // unconditionally, which masked the schema-default skip defect (IDE-2149).
  let realScopeService: ScopeDetectionService;
  let clientAdapter: ILanguageClientAdapter;
  let logger: ILog;
  let updateConfigurationStub: sinon.SinonStub;

  setup(() => {
    updateConfigurationStub = sinon.stub().resolves();
    workspace = {
      updateConfiguration: updateConfigurationStub,
      getWorkspaceFolders: sinon.stub().returns([]),
      getWorkspaceFolderPaths: sinon.stub().returns([]),
      // CP-2.3: return real schema defaults per key so the real guard never
      // skips an inbound write due to schema-default equality.
      inspectConfiguration: sinon.stub().callsFake((configId: string, section: string) => {
        if (configId === CONFIGURATION_IDENTIFIER && section === 'advanced.customEndpoint') {
          return {
            defaultValue: '',
            globalValue: undefined,
            workspaceValue: undefined,
            workspaceFolderValue: undefined,
          };
        }
        if (configId === CONFIGURATION_IDENTIFIER && section === 'allIssuesVsNetNewIssues') {
          return {
            defaultValue: ALLISSUES,
            globalValue: undefined,
            workspaceValue: undefined,
            workspaceFolderValue: undefined,
          };
        }
        return {
          defaultValue: undefined,
          globalValue: undefined,
          workspaceValue: undefined,
          workspaceFolderValue: undefined,
        };
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

    // CP-2.3: wire real ScopeDetectionService so the guard exercises the real predicate.
    // Under the old faked stub (shouldSkipSettingUpdate: stub().returns(false)) these tests
    // would pass even if the guard were broken. The real service uses the ADR-1 predicate.
    realScopeService = new ScopeDetectionService(workspace);

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
      realScopeService,
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

  // Mirrors the reset-path failure test ('does not mark pending reset or unmark
  // explicit-changed when updateConfiguration throws') for the regular settings-sync path:
  // a write-time pending marker must not leak past a failed write, or it silently suppresses
  // the explicit-change marking of the next genuine user edit of that key [IDE-2264].
  test('clears the pending inbound-write marker when updateConfiguration throws during a settings-sync write', async () => {
    updateConfigurationStub.rejects(new Error('VS Code write failed'));
    const markPendingInboundWriteStub = sinon.stub();
    const consumePendingInboundWriteStub = sinon.stub();
    const tracker = {
      markPendingInboundWrite: markPendingInboundWriteStub,
      consumePendingInboundWrite: consumePendingInboundWriteStub,
    } as unknown as IExplicitLspConfigurationChangeTracker;

    const service = new ConfigurationPersistenceService(
      workspace,
      configuration,
      realScopeService,
      clientAdapter,
      logger,
      undefined,
      tracker,
    );

    const param: LspConfigurationParam = {
      settings: {
        [LS_KEY.apiEndpoint]: { value: 'https://from-ls.example', changed: true },
      },
    };

    await service.persistInboundLspConfiguration(param);

    sinon.assert.calledWith(markPendingInboundWriteStub, ADVANCED_CUSTOM_ENDPOINT);
    sinon.assert.calledWith(consumePendingInboundWriteStub, ADVANCED_CUSTOM_ENDPOINT);
  });

  // Regression/proof coverage for a "should fix" raised on PR #782 (a value-unchanged write
  // leaks a marker because no onDidChangeConfiguration event follows a VS Code no-op write).
  // [IDE-2264 ticket 03]: the inbound redundancy check now compares purely against the
  // last-known-value cache — warm from activation-time seeding in production (see
  // extension.ts's `new LastKnownValueCache(workspace, ...)`) — rather than falling back to
  // an override-aware inspectConfiguration peek. A cache hit that matches the incoming value
  // must skip the write entirely, so writeTaggedAsInboundOrigin never marks pending in the
  // first place.
  test('an inbound value equal to what the last-known-value cache holds for that key is skipped (no write, no marker)', async () => {
    const warmCacheWorkspace = {
      updateConfiguration: updateConfigurationStub,
      // Seeds the cache with the pre-existing value, same as activation-time seeding.
      getConfiguration: sinon.stub().callsFake((configId: string, section: string) => {
        if (configId === CONFIGURATION_IDENTIFIER && section === 'advanced.organization') return 'existing-org';
        return undefined;
      }),
      getWorkspaceFolders: sinon.stub().returns([]),
      getWorkspaceFolderPaths: sinon.stub().returns([]),
      inspectConfiguration: sinon.stub().callsFake((configId: string, section: string) => {
        if (configId === CONFIGURATION_IDENTIFIER && section === 'advanced.organization') {
          return {
            defaultValue: '',
            globalValue: 'existing-org',
            workspaceValue: undefined,
            workspaceFolderValue: undefined,
          };
        }
        return {
          defaultValue: undefined,
          globalValue: undefined,
          workspaceValue: undefined,
          workspaceFolderValue: undefined,
        };
      }),
    } as unknown as IVSCodeWorkspace;
    const warmCacheScopeService = new ScopeDetectionService(warmCacheWorkspace);

    const markPendingInboundWriteStub = sinon.stub();
    const tracker = {
      markPendingInboundWrite: markPendingInboundWriteStub,
    } as unknown as IExplicitLspConfigurationChangeTracker;

    const lastKnownValueCache = new LastKnownValueCache(warmCacheWorkspace, [ADVANCED_ORGANIZATION]);

    const service = new ConfigurationPersistenceService(
      warmCacheWorkspace,
      configuration,
      warmCacheScopeService,
      clientAdapter,
      logger,
      undefined,
      tracker,
      undefined,
      lastKnownValueCache,
    );

    const param: LspConfigurationParam = {
      settings: {
        // Same value the cache already holds — a genuine VS Code no-op if written.
        [LS_GLOBAL_KEY.organization]: { value: 'existing-org', changed: true },
      },
    };

    await service.persistInboundLspConfiguration(param);

    sinon.assert.notCalled(updateConfigurationStub);
    sinon.assert.notCalled(markPendingInboundWriteStub);
  });

  // [IDE-2264 ticket 03]: a cache miss (nothing written yet this session for this key) must
  // never cause a skip, even when the incoming value happens to equal the schema default —
  // this is the regression the old "effective value" snapshot existed to prevent (a
  // resolved-value-equals-default write silently turning into a permanent override on sync).
  test('the very first inbound push for a key not yet in the cache is never skipped, even if its value equals the schema default', async () => {
    const noOverrideWorkspace = {
      updateConfiguration: updateConfigurationStub,
      getConfiguration: sinon.stub().returns(undefined),
      getWorkspaceFolders: sinon.stub().returns([]),
      getWorkspaceFolderPaths: sinon.stub().returns([]),
      inspectConfiguration: sinon.stub().callsFake((configId: string, section: string) => {
        if (configId === CONFIGURATION_IDENTIFIER && section === 'advanced.organization') {
          // The incoming value equals the schema default; no override exists at any scope.
          return {
            defaultValue: 'existing-org',
            globalValue: undefined,
            workspaceValue: undefined,
            workspaceFolderValue: undefined,
          };
        }
        return {
          defaultValue: undefined,
          globalValue: undefined,
          workspaceValue: undefined,
          workspaceFolderValue: undefined,
        };
      }),
    } as unknown as IVSCodeWorkspace;
    const noOverrideScopeService = new ScopeDetectionService(noOverrideWorkspace);

    // Seeded with no tracked keys: the cache has no entry for organization.
    const emptyCache = new LastKnownValueCache(noOverrideWorkspace, []);

    const service = new ConfigurationPersistenceService(
      noOverrideWorkspace,
      configuration,
      noOverrideScopeService,
      clientAdapter,
      logger,
      undefined,
      undefined,
      undefined,
      emptyCache,
    );

    const param: LspConfigurationParam = {
      settings: {
        [LS_GLOBAL_KEY.organization]: { value: 'existing-org', changed: true },
      },
    };

    await service.persistInboundLspConfiguration(param);

    sinon.assert.calledWith(
      updateConfigurationStub,
      CONFIGURATION_IDENTIFIER,
      'advanced.organization',
      'existing-org',
      true,
    );
  });

  test('persistInbound writes delta setting from global settings', async () => {
    const service = new ConfigurationPersistenceService(
      workspace,
      configuration,
      realScopeService,
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
    const svc = new ConfigurationPersistenceService(workspace, configuration, realScopeService, clientAdapter, logger);
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
    const svc = new ConfigurationPersistenceService(workspace, configuration, realScopeService, clientAdapter, logger);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const setFolderConfigsStub = configuration.setFolderConfigs as unknown as sinon.SinonStub;

    const param: LspConfigurationParam = {
      settings: {},
    };

    await svc.persistInboundLspConfiguration(param);

    sinon.assert.notCalled(setFolderConfigsStub);
  });
});

suite('ConfigurationPersistenceService — folder override reset (flat null)', () => {
  const FOLDER_PATH = '/work/project-a';
  let workspace: IVSCodeWorkspace;
  let configuration: IConfiguration;
  let scopeDetectionService: IScopeDetectionService;
  let clientAdapter: ILanguageClientAdapter;
  let logger: ILog;
  let folderConfig: FolderConfig;
  let sendNotificationStub: sinon.SinonStub;

  setup(() => {
    // A real FolderConfig so saveFolderConfigs() matches by path and mutates it via setSetting().
    folderConfig = new FolderConfig(FOLDER_PATH, {
      [LS_KEY.snykCodeEnabled]: { value: true, changed: true },
      [LS_KEY.preferredOrg]: { value: 'my-org', changed: true },
    });

    workspace = {
      updateConfiguration: sinon.stub().resolves(),
      getWorkspaceFolders: sinon.stub().returns([]),
      inspectConfiguration: sinon.stub().returns({}),
    } as unknown as IVSCodeWorkspace;

    configuration = {
      getToken: sinon.stub().resolves('test-token'),
      setToken: sinon.stub().resolves(),
      getFolderConfigs: sinon.stub().returns([folderConfig]),
      setFolderConfigs: sinon.stub().resolves(),
    } as unknown as IConfiguration;

    scopeDetectionService = {
      getSettingScope: sinon.stub().returns('user'),
      populateScopeIndicators: sinon.stub().returns(''),
      shouldSkipSettingUpdate: sinon.stub().returns(false),
    } as unknown as IScopeDetectionService;

    sendNotificationStub = sinon.stub().resolves();
    clientAdapter = {
      getLanguageClient: sinon.stub().returns({ sendNotification: sendNotificationStub }),
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

  test('null-reset folder fields are persisted as {value:null, changed:true}', async () => {
    const service = new ConfigurationPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      clientAdapter,
      logger,
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const setFolderConfigsStub = configuration.setFolderConfigs as unknown as sinon.SinonStub;

    // The HTML dialog emits flat snake_case null for each reset folder field.
    const configJson = JSON.stringify({
      isFallbackForm: false,
      token: 'test-token',
      folderConfigs: [
        {
          folderPath: FOLDER_PATH,
          [LS_KEY.snykCodeEnabled]: null,
          [LS_KEY.preferredOrg]: null,
        },
      ],
    });

    await service.handleSaveConfig(configJson);

    sinon.assert.called(setFolderConfigsStub);
    assert.strictEqual(
      setFolderConfigsStub.lastCall.args[1],
      false,
      'suppresses the redundant config-change notification from setFolderConfigs',
    );
    // handleSaveConfig still notifies the LS exactly once after all settings are written.
    sinon.assert.calledOnce(sendNotificationStub);
    const saved = setFolderConfigsStub.lastCall.args[0] as FolderConfig[];
    const savedFolder = saved.find(fc => fc.folderPath === FOLDER_PATH);
    assert.ok(savedFolder, 'folder config persisted');
    const settings = savedFolder.toLspFolderConfiguration().settings ?? {};
    assert.deepStrictEqual(settings[LS_KEY.snykCodeEnabled], { value: null, changed: true });
    assert.deepStrictEqual(settings[LS_KEY.preferredOrg], { value: null, changed: true });
  });

  test('omitted folder fields keep prior value; null fields are reset', async () => {
    const service = new ConfigurationPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      clientAdapter,
      logger,
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const setFolderConfigsStub = configuration.setFolderConfigs as unknown as sinon.SinonStub;

    // Only snykCodeEnabled is reset; preferredOrg is omitted entirely.
    const configJson = JSON.stringify({
      isFallbackForm: false,
      token: 'test-token',
      folderConfigs: [{ folderPath: FOLDER_PATH, [LS_KEY.snykCodeEnabled]: null }],
    });

    await service.handleSaveConfig(configJson);

    sinon.assert.called(setFolderConfigsStub);
    assert.strictEqual(
      setFolderConfigsStub.lastCall.args[1],
      false,
      'suppresses the redundant config-change notification from setFolderConfigs',
    );
    // handleSaveConfig still notifies the LS exactly once after all settings are written.
    sinon.assert.calledOnce(sendNotificationStub);
    const saved = setFolderConfigsStub.lastCall.args[0] as FolderConfig[];
    const savedFolder = saved.find(fc => fc.folderPath === FOLDER_PATH);
    assert.ok(savedFolder, 'folder config persisted');
    const settings = savedFolder.toLspFolderConfiguration().settings ?? {};
    assert.deepStrictEqual(settings[LS_KEY.snykCodeEnabled], { value: null, changed: true });
    // Omitted field retains its seeded prior value unchanged.
    assert.deepStrictEqual(settings[LS_KEY.preferredOrg], { value: 'my-org', changed: true });
  });
});

suite('ConfigurationPersistenceService — global ("Project Defaults") reset', () => {
  let workspace: IVSCodeWorkspace;
  let configuration: IConfiguration;
  let scopeDetectionService: IScopeDetectionService;
  let clientAdapter: ILanguageClientAdapter;
  let logger: ILog;
  let updateConfigurationStub: sinon.SinonStub;
  let tracker: FakeTracker;

  /** Minimal in-memory tracker that fulfils the interface. */
  class FakeTracker implements IExplicitLspConfigurationChangeTracker {
    private readonly keys = new Set<string>();
    private readonly pending = new Set<string>();
    private readonly committed = new Set<string>();
    private readonly lastKnown = new Map<string, unknown>();
    private readonly pendingInboundWrites = new Set<string>();
    markExplicitlyChanged(lsKey: string): void {
      this.keys.add(lsKey);
    }
    unmarkExplicitlyChanged(lsKey: string): void {
      this.keys.delete(lsKey);
    }
    isExplicitlyChanged(lsKey: string): boolean {
      return this.keys.has(lsKey);
    }
    markPendingReset(lsKey: string): void {
      this.pending.add(lsKey);
      this.committed.delete(lsKey);
    }
    consumePendingResets(): Set<string> {
      const snap = new Set(this.pending);
      this.pending.clear();
      return snap;
    }
    markCommittedSinceReset(lsKey: string): void {
      this.committed.add(lsKey);
    }
    committedSinceReset(lsKey: string): boolean {
      return this.committed.has(lsKey);
    }
    hasLastKnownValue(lsKey: string): boolean {
      return this.lastKnown.has(lsKey);
    }
    getLastKnownValue(lsKey: string): unknown {
      return this.lastKnown.get(lsKey);
    }
    setLastKnownValue(lsKey: string, value: unknown): void {
      this.lastKnown.set(lsKey, value);
    }
    markPendingInboundWrite(vscodeKey: string): void {
      this.pendingInboundWrites.add(vscodeKey);
    }
    consumePendingInboundWrite(vscodeKey: string): boolean {
      return this.pendingInboundWrites.delete(vscodeKey);
    }
  }

  setup(() => {
    updateConfigurationStub = sinon.stub().resolves();
    workspace = {
      updateConfiguration: updateConfigurationStub,
      getConfiguration: sinon.stub().returns(undefined),
      getWorkspaceFolders: sinon.stub().returns([]),
      getWorkspaceFolderPaths: sinon.stub().returns([]),
      inspectConfiguration: sinon.stub().returns({
        globalValue: undefined,
        defaultValue: undefined,
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
      getOssQuickFixCodeActionsEnabled: sinon.stub().returns(true),
      getAdditionalCliParameters: sinon.stub().returns(''),
      getAdditionalCliEnvironment: sinon.stub().returns(undefined),
      getSecureAtInceptionExecutionFrequency: sinon.stub().returns('Manual'),
      getAutoConfigureMcpServer: sinon.stub().returns(false),
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
      getLanguageClient: sinon.stub().returns({ sendNotification: sinon.stub().resolves() }),
    } as unknown as ILanguageClientAdapter;

    logger = {
      info: sinon.stub(),
      debug: sinon.stub(),
      error: sinon.stub(),
      warn: sinon.stub(),
    } as unknown as ILog;

    tracker = new FakeTracker();
  });

  teardown(() => {
    sinon.restore();
  });

  function newService(): ConfigurationPersistenceService {
    return new ConfigurationPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      clientAdapter,
      logger,
      undefined,
      tracker,
    );
  }

  // 3(a): inbound { value: null, changed: true } clears the global value AND unmarks the tracker.
  test('clears the global VS Code value and unmarks the tracker on reset', async () => {
    // Simulate a pre-existing explicit override that must be dropped.
    tracker.markExplicitlyChanged(LS_GLOBAL_KEY.organization);

    const service = newService();

    const param: LspConfigurationParam = {
      settings: {
        [LS_GLOBAL_KEY.organization]: { value: null, changed: true },
      },
    };

    await service.persistInboundLspConfiguration(param);

    // (a1) update(section, undefined, Global=true) — removes the override rather than writing null.
    sinon.assert.calledWith(
      updateConfigurationStub,
      CONFIGURATION_IDENTIFIER,
      'advanced.organization',
      undefined,
      true,
    );

    // (a2) tracker no longer marks the key as explicitly changed.
    assert.strictEqual(
      tracker.isExplicitlyChanged(LS_GLOBAL_KEY.organization),
      false,
      'reset must unmark explicit-changed tracking',
    );
  });

  // The reset value (null) must never be persisted as an actual setting value.
  test('does not write null as a value for the reset key', async () => {
    const service = newService();

    const param: LspConfigurationParam = {
      settings: {
        [LS_GLOBAL_KEY.organization]: { value: null, changed: true },
      },
    };

    await service.persistInboundLspConfiguration(param);

    const wroteNull = updateConfigurationStub
      .getCalls()
      .some(c => c.args[1] === 'advanced.organization' && c.args[2] === null);
    assert.strictEqual(wroteNull, false, 'reset must not persist null as a setting value');
  });

  // Non-reset entries alongside a reset are still persisted normally.
  test('persists non-reset entries while resetting reset entries', async () => {
    const service = newService();

    const param: LspConfigurationParam = {
      settings: {
        [LS_GLOBAL_KEY.organization]: { value: null, changed: true },
        [LS_GLOBAL_KEY.apiEndpoint]: { value: 'https://from-ls.example', changed: true },
      },
    };

    await service.persistInboundLspConfiguration(param);

    // reset → undefined
    sinon.assert.calledWith(
      updateConfigurationStub,
      CONFIGURATION_IDENTIFIER,
      'advanced.organization',
      undefined,
      true,
    );
    // non-reset → value written
    sinon.assert.calledWith(
      updateConfigurationStub,
      CONFIGURATION_IDENTIFIER,
      'advanced.customEndpoint',
      'https://from-ls.example',
      true,
    );
  });

  // 3(b): RE-PUSH GUARD — after a reset clears tracking, building the outbound config
  // (LanguageServerSettings.fromConfiguration, the same path the middleware pull uses)
  // produces NO { changed: true } for that key. This is the regression that otherwise
  // requires a manual IDE restart.
  test('re-push guard: outbound config has changed:false for the key after reset', async () => {
    // Pre-existing override → would push changed:true before the reset.
    tracker.markExplicitlyChanged(LS_GLOBAL_KEY.organization);

    // Sanity: before reset, the outbound build would mark it changed:true.
    const before = await LanguageServerSettings.fromConfiguration(configuration, lsKey =>
      tracker.isExplicitlyChanged(lsKey),
    );
    assert.strictEqual(
      before.settings?.[LS_GLOBAL_KEY.organization]?.changed,
      true,
      'precondition: key is changed:true before reset',
    );

    const service = newService();
    await service.persistInboundLspConfiguration({
      settings: { [LS_GLOBAL_KEY.organization]: { value: null, changed: true } },
    });

    // After the reset clears tracking, the outbound build must NOT re-push the stale override.
    const after = await LanguageServerSettings.fromConfiguration(configuration, lsKey =>
      tracker.isExplicitlyChanged(lsKey),
    );
    assert.strictEqual(
      after.settings?.[LS_GLOBAL_KEY.organization]?.changed,
      false,
      're-push guard: key must be changed:false after reset',
    );
  });

  // Resets must be handled even when no tracker is wired (defensive — no throw).
  test('does not throw when tracker is absent', async () => {
    const service = new ConfigurationPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      clientAdapter,
      logger,
    );

    await service.persistInboundLspConfiguration({
      settings: { [LS_GLOBAL_KEY.organization]: { value: null, changed: true } },
    });

    sinon.assert.calledWith(
      updateConfigurationStub,
      CONFIGURATION_IDENTIFIER,
      'advanced.organization',
      undefined,
      true,
    );
  });
});

// ── OUTBOUND global reset tests ─────────────────────────────────────────────
// These cover the OUTBOUND leg: when the dialog saves a top-level null for a
// global-resettable key, handleSaveConfig must:
//  (a) clear the VS Code global override (updateConfiguration → undefined)
//  (b) NOT write the raw null as a value
//  (c) record a reset entry in the explicit-overrides map
//  (d) update the last-known-value cache to undefined
suite('ConfigurationPersistenceService — outbound global reset (handleSaveConfig)', () => {
  function makeMemento(): import('vscode').Memento {
    const store = new Map<string, unknown>();
    return {
      get<T>(key: string, defaultValue?: T): T {
        return (store.has(key) ? store.get(key) : defaultValue) as T;
      },
      update(key: string, value: unknown): Thenable<void> {
        store.set(key, value);
        return Promise.resolve();
      },
      keys(): readonly string[] {
        return [...store.keys()];
      },
    };
  }

  let workspace: IVSCodeWorkspace;
  let configuration: IConfiguration;
  let scopeDetectionService: IScopeDetectionService;
  let clientAdapter: ILanguageClientAdapter;
  let logger: ILog;
  let updateConfigurationStub: sinon.SinonStub;
  let explicitOverridesMap: ExplicitOverridesMap;
  let lastKnownValueCache: LastKnownValueCache;

  setup(() => {
    updateConfigurationStub = sinon.stub().resolves();

    workspace = {
      updateConfiguration: updateConfigurationStub,
      getConfiguration: sinon.stub().returns(undefined),
      getWorkspaceFolders: sinon.stub().returns([]),
      getWorkspaceFolderPaths: sinon.stub().returns([]),
      inspectConfiguration: sinon.stub().returns({ globalValue: undefined, defaultValue: undefined }),
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
      getOssQuickFixCodeActionsEnabled: sinon.stub().returns(true),
      getAdditionalCliParameters: sinon.stub().returns(''),
      getAdditionalCliEnvironment: sinon.stub().returns(undefined),
      getSecureAtInceptionExecutionFrequency: sinon.stub().returns('Manual'),
      getAutoConfigureMcpServer: sinon.stub().returns(false),
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
      getLanguageClient: sinon.stub().returns({ sendNotification: sinon.stub().resolves() }),
    } as unknown as ILanguageClientAdapter;

    logger = {
      info: sinon.stub(),
      debug: sinon.stub(),
      error: sinon.stub(),
      warn: sinon.stub(),
    } as unknown as ILog;

    explicitOverridesMap = new ExplicitOverridesMap(makeMemento());
    lastKnownValueCache = new LastKnownValueCache(workspace, [ADVANCED_ORGANIZATION]);
  });

  teardown(() => sinon.restore());

  function newService(): ConfigurationPersistenceService {
    return new ConfigurationPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      clientAdapter,
      logger,
      undefined,
      undefined,
      explicitOverridesMap,
      lastKnownValueCache,
    );
  }

  // (a) VS Code global override must be cleared (updateConfiguration called with undefined)
  test('clears the global VS Code override for a null-valued global-resettable field', async () => {
    const service = newService();

    const configJson = JSON.stringify({
      isFallbackForm: false,
      token: 'tok',
      [LS_GLOBAL_KEY.organization]: null,
    });

    await service.handleSaveConfig(configJson);

    sinon.assert.calledWith(
      updateConfigurationStub,
      CONFIGURATION_IDENTIFIER,
      'advanced.organization',
      undefined,
      true,
    );
  });

  // (b) The raw null must NOT be written as a value
  test('does not write null as a setting value for a reset field', async () => {
    const service = newService();

    const configJson = JSON.stringify({
      isFallbackForm: false,
      token: 'tok',
      [LS_GLOBAL_KEY.organization]: null,
    });

    await service.handleSaveConfig(configJson);

    const wroteNull = updateConfigurationStub
      .getCalls()
      .some(c => c.args[1] === 'advanced.organization' && c.args[2] === null);
    assert.strictEqual(wroteNull, false, 'null must not be written as a setting value');
  });

  // (c) A reset entry must be recorded in the explicit-overrides map
  test('records a reset entry in the explicit-overrides map after save', async () => {
    const service = newService();

    const configJson = JSON.stringify({
      isFallbackForm: false,
      token: 'tok',
      [LS_GLOBAL_KEY.organization]: null,
    });

    await service.handleSaveConfig(configJson);

    assert.deepStrictEqual(explicitOverridesMap.getEntry(LS_GLOBAL_KEY.organization), { kind: 'reset' });
  });

  // (c2) When the key already held a concrete explicit value before the reset (the common path),
  // the reset entry must overwrite it — not leave the stale concrete value in place.
  test('overwrites a prior explicit value with a reset entry when key was pre-set', async () => {
    explicitOverridesMap.setExplicitValue(LS_GLOBAL_KEY.organization, 'previously-set-org');
    assert.deepStrictEqual(
      explicitOverridesMap.getEntry(LS_GLOBAL_KEY.organization),
      { kind: 'value', value: 'previously-set-org' },
      'precondition: key must hold a concrete explicit value before save',
    );

    const service = newService();

    const configJson = JSON.stringify({
      isFallbackForm: false,
      token: 'tok',
      [LS_GLOBAL_KEY.organization]: null,
    });

    await service.handleSaveConfig(configJson);

    assert.deepStrictEqual(
      explicitOverridesMap.getEntry(LS_GLOBAL_KEY.organization),
      { kind: 'reset' },
      'the reset must overwrite the prior concrete-value entry',
    );
  });

  // (d) The last-known-value cache must reflect the cleared override
  test('updates the last-known-value cache to undefined after a successful reset', async () => {
    const service = newService();

    const configJson = JSON.stringify({
      isFallbackForm: false,
      token: 'tok',
      [LS_GLOBAL_KEY.organization]: null,
    });

    await service.handleSaveConfig(configJson);

    assert.strictEqual(lastKnownValueCache.get(ADVANCED_ORGANIZATION), undefined);
  });

  // Non-reset fields alongside a reset are persisted normally
  test('persists non-reset sibling fields normally', async () => {
    const service = newService();

    const configJson = JSON.stringify({
      isFallbackForm: false,
      token: 'tok',
      [LS_GLOBAL_KEY.organization]: null,
      [LS_GLOBAL_KEY.scanNetNew]: true,
    });

    await service.handleSaveConfig(configJson);

    // scan_net_new must be written normally
    sinon.assert.calledWith(
      updateConfigurationStub,
      CONFIGURATION_IDENTIFIER,
      DELTA_FINDINGS.replace(`${CONFIGURATION_IDENTIFIER}.`, ''),
      NEWISSUES,
      true,
    );

    // organization must be cleared (undefined), not written as null
    sinon.assert.calledWith(
      updateConfigurationStub,
      CONFIGURATION_IDENTIFIER,
      'advanced.organization',
      undefined,
      true,
    );
  });

  // A write that throws must not update either new structure
  test('does not record a reset entry or update the cache when updateConfiguration throws', async () => {
    explicitOverridesMap.setExplicitValue(LS_GLOBAL_KEY.organization, 'previously-set-org');
    lastKnownValueCache.set(ADVANCED_ORGANIZATION, 'pre-existing-cached-value');
    updateConfigurationStub.rejects(new Error('VS Code write failed'));

    const service = newService();

    const configJson = JSON.stringify({
      isFallbackForm: false,
      token: 'tok',
      [LS_GLOBAL_KEY.organization]: null,
    });

    await service.handleSaveConfig(configJson);

    assert.deepStrictEqual(
      explicitOverridesMap.getEntry(LS_GLOBAL_KEY.organization),
      { kind: 'value', value: 'previously-set-org' },
      'a failed write must not overwrite the prior entry with a reset',
    );
    assert.strictEqual(
      lastKnownValueCache.get(ADVANCED_ORGANIZATION),
      'pre-existing-cached-value',
      'a failed write must not update the last-known-value cache',
    );
  });
});

// ── LanguageServerSettings.fromConfiguration — pending-reset predicate contract ──
// The outbound save handler no longer feeds the old tracker's pending-resets set (see the
// suite above), but `fromConfiguration`'s `isPendingReset` predicate parameter is still the
// pull-side contract other code relies on to emit `{ value: null, changed: true }`. These
// tests exercise that predicate directly (a plain Set, not sourced from a save or a tracker)
// so the contract keeps regression coverage independent of how callers populate it.
suite('LanguageServerSettings.fromConfiguration — pending-reset predicate contract', () => {
  const configuration = {
    getToken: sinon.stub().resolves('tok'),
    getFolderConfigs: sinon.stub().returns([]),
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
    getOssQuickFixCodeActionsEnabled: sinon.stub().returns(true),
    getAdditionalCliParameters: sinon.stub().returns(''),
    getAdditionalCliEnvironment: sinon.stub().returns(undefined),
    getSecureAtInceptionExecutionFrequency: sinon.stub().returns('Manual'),
    getAutoConfigureMcpServer: sinon.stub().returns(false),
    severityFilter: {},
    issueViewOptions: {},
    riskScoreThreshold: 0,
    getTrustedFolders: sinon.stub().returns([]),
    getCliPath: sinon.stub().resolves(''),
    isAutomaticDependencyManagementEnabled: sinon.stub().returns(true),
    getCliBaseDownloadUrl: sinon.stub().returns(''),
  } as unknown as IConfiguration;

  test('a key present in the pending-reset predicate emits {value:null, changed:true}', async () => {
    const pendingResets = new Set<string>([LS_GLOBAL_KEY.organization]);

    const lspParam = await LanguageServerSettings.fromConfiguration(
      configuration,
      () => false,
      undefined,
      lsKey => pendingResets.has(lsKey),
    );

    const orgSetting = lspParam.settings?.[LS_GLOBAL_KEY.organization];
    assert.strictEqual(orgSetting?.value, null, 'pending-reset key must emit value:null');
    assert.strictEqual(orgSetting?.changed, true, 'pending-reset key must emit changed:true');
  });

  test('a key absent from the pending-reset predicate resolves normally (not null)', async () => {
    const lspParam = await LanguageServerSettings.fromConfiguration(
      configuration,
      () => false,
      undefined,
      () => false,
    );

    assert.notStrictEqual(
      lspParam.settings?.[LS_GLOBAL_KEY.organization]?.value,
      null,
      'a key with no pending reset must not emit value:null',
    );
  });
});

// ── D1 regression guard, redesigned: fan-out siblings each get an independent entry ──
//
// The old D1 fix existed because the tracker's `committedSinceReset` windowed signal was
// keyed per shared vscodeKey, so resetting one of four severity_filter_* siblings needed a
// resolver-seeded "last known value" to disambiguate the other three on the next fan-out
// event. The explicit-overrides map is keyed per LS key directly, so that ambiguity — and
// the resolver-seeding workaround for it — no longer exists: resetting one sibling can never
// affect another sibling's entry, with no seeding step required.
suite('ConfigurationPersistenceService — D1: fan-out siblings reset independently (no seeding needed)', () => {
  let updateConfigurationStub: sinon.SinonStub;
  let workspace: IVSCodeWorkspace;
  let configuration: IConfiguration;
  let scopeDetectionService: IScopeDetectionService;
  let clientAdapter: ILanguageClientAdapter;
  let logger: ILog;
  let explicitOverridesMap: ExplicitOverridesMap;

  setup(() => {
    updateConfigurationStub = sinon.stub().resolves();
    workspace = {
      updateConfiguration: updateConfigurationStub,
      getConfiguration: sinon.stub().returns(undefined),
      getWorkspaceFolders: sinon.stub().returns([]),
      getWorkspaceFolderPaths: sinon.stub().returns([]),
      inspectConfiguration: sinon.stub().returns({ globalValue: undefined, defaultValue: undefined }),
    } as unknown as IVSCodeWorkspace;

    configuration = {
      getToken: sinon.stub().resolves('tok'),
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
      getLanguageClient: sinon.stub().returns({ sendNotification: sinon.stub().resolves() }),
    } as unknown as ILanguageClientAdapter;

    logger = {
      info: sinon.stub(),
      debug: sinon.stub(),
      error: sinon.stub(),
      warn: sinon.stub(),
    } as unknown as ILog;

    const store = new Map<string, unknown>();
    const memento: import('vscode').Memento = {
      get<T>(key: string, defaultValue?: T): T {
        return (store.has(key) ? store.get(key) : defaultValue) as T;
      },
      update(key: string, value: unknown): Thenable<void> {
        store.set(key, value);
        return Promise.resolve();
      },
      keys(): readonly string[] {
        return [...store.keys()];
      },
    };
    explicitOverridesMap = new ExplicitOverridesMap(memento);
  });

  teardown(() => sinon.restore());

  function newService(): ConfigurationPersistenceService {
    return new ConfigurationPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      clientAdapter,
      logger,
      undefined,
      undefined,
      explicitOverridesMap,
    );
  }

  test('resetting only one of four severity_filter_* siblings records a reset for that key alone', async () => {
    // Pre-existing concrete values for the OTHER three siblings — resetting one must not touch them.
    explicitOverridesMap.setExplicitValue(LS_GLOBAL_KEY.severityFilterHigh, true);
    explicitOverridesMap.setExplicitValue(LS_GLOBAL_KEY.severityFilterMedium, false);
    explicitOverridesMap.setExplicitValue(LS_GLOBAL_KEY.severityFilterLow, true);

    const service = newService();

    const configJson = JSON.stringify({
      isFallbackForm: false,
      token: 'tok',
      [LS_GLOBAL_KEY.severityFilterCritical]: null,
    });

    await service.handleSaveConfig(configJson);

    assert.deepStrictEqual(explicitOverridesMap.getEntry(LS_GLOBAL_KEY.severityFilterCritical), { kind: 'reset' });
    assert.deepStrictEqual(explicitOverridesMap.getEntry(LS_GLOBAL_KEY.severityFilterHigh), {
      kind: 'value',
      value: true,
    });
    assert.deepStrictEqual(explicitOverridesMap.getEntry(LS_GLOBAL_KEY.severityFilterMedium), {
      kind: 'value',
      value: false,
    });
    assert.deepStrictEqual(explicitOverridesMap.getEntry(LS_GLOBAL_KEY.severityFilterLow), {
      kind: 'value',
      value: true,
    });
  });

  test('resetting all four severity_filter_* siblings records an independent reset entry for each', async () => {
    const service = newService();

    const configJson = JSON.stringify({
      isFallbackForm: false,
      token: 'tok',
      [LS_GLOBAL_KEY.severityFilterCritical]: null,
      [LS_GLOBAL_KEY.severityFilterHigh]: null,
      [LS_GLOBAL_KEY.severityFilterMedium]: null,
      [LS_GLOBAL_KEY.severityFilterLow]: null,
    });

    await service.handleSaveConfig(configJson);

    for (const lsKey of [
      LS_GLOBAL_KEY.severityFilterCritical,
      LS_GLOBAL_KEY.severityFilterHigh,
      LS_GLOBAL_KEY.severityFilterMedium,
      LS_GLOBAL_KEY.severityFilterLow,
    ]) {
      assert.deepStrictEqual(explicitOverridesMap.getEntry(lsKey), { kind: 'reset' }, `${lsKey} must be reset`);
    }
  });
});

// Note: the outbound-save-marks-explicit scenario that used to live here (simulating
// registerExplicitKeyMarkingListener via the old 2-arg markExplicitLsKeysFromConfigurationChangeEvent)
// is superseded by the suite below — as of ticket 02, an outbound webview save records the
// explicit-overrides entry directly at save time, not via a simulated onDidChangeConfiguration
// echo, and as of ticket 04 the direct-edit listener no longer takes a tracker at all.

// ── Outbound concrete-value save: explicit-overrides map + last-known-value cache ──
// Covers the non-reset leg of applyOutboundSettingsMap: every key present in the save
// payload writes the VS Code setting, records the raw payload value in the
// explicit-overrides map, and updates the last-known-value cache — with no comparison
// against any previously-observed value gating whether the write happens.
suite('ConfigurationPersistenceService — outbound concrete-value save records new structures', () => {
  let workspace: IVSCodeWorkspace;
  let configuration: IConfiguration;
  let scopeDetectionService: IScopeDetectionService;
  let clientAdapter: ILanguageClientAdapter;
  let logger: ILog;
  let updateConfigurationStub: sinon.SinonStub;
  let explicitOverridesMap: ExplicitOverridesMap;
  let lastKnownValueCache: LastKnownValueCache;

  setup(() => {
    updateConfigurationStub = sinon.stub().resolves();
    workspace = {
      updateConfiguration: updateConfigurationStub,
      getConfiguration: sinon.stub().returns(undefined),
      getWorkspaceFolders: sinon.stub().returns([]),
      getWorkspaceFolderPaths: sinon.stub().returns([]),
      inspectConfiguration: sinon.stub().returns({ globalValue: undefined, defaultValue: undefined }),
    } as unknown as IVSCodeWorkspace;

    configuration = {
      getToken: sinon.stub().resolves('tok'),
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
      getLanguageClient: sinon.stub().returns({ sendNotification: sinon.stub().resolves() }),
    } as unknown as ILanguageClientAdapter;

    logger = {
      info: sinon.stub(),
      debug: sinon.stub(),
      error: sinon.stub(),
      warn: sinon.stub(),
    } as unknown as ILog;

    const store = new Map<string, unknown>();
    const memento: import('vscode').Memento = {
      get<T>(key: string, defaultValue?: T): T {
        return (store.has(key) ? store.get(key) : defaultValue) as T;
      },
      update(key: string, value: unknown): Thenable<void> {
        store.set(key, value);
        return Promise.resolve();
      },
      keys(): readonly string[] {
        return [...store.keys()];
      },
    };
    explicitOverridesMap = new ExplicitOverridesMap(memento);
    lastKnownValueCache = new LastKnownValueCache(workspace, [ADVANCED_ORGANIZATION]);
  });

  teardown(() => sinon.restore());

  function newService(): ConfigurationPersistenceService {
    return new ConfigurationPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      clientAdapter,
      logger,
      undefined,
      undefined,
      explicitOverridesMap,
      lastKnownValueCache,
    );
  }

  test('a changed field writes the setting, records it in the explicit-overrides map, and updates the cache', async () => {
    const service = newService();

    const configJson = JSON.stringify({
      isFallbackForm: false,
      token: 'tok',
      [LS_GLOBAL_KEY.organization]: 'new-org',
    });

    await service.handleSaveConfig(configJson);

    sinon.assert.calledWith(
      updateConfigurationStub,
      CONFIGURATION_IDENTIFIER,
      'advanced.organization',
      'new-org',
      true,
    );
    assert.deepStrictEqual(explicitOverridesMap.getEntry(LS_GLOBAL_KEY.organization), {
      kind: 'value',
      value: 'new-org',
    });
    assert.strictEqual(lastKnownValueCache.get(ADVANCED_ORGANIZATION), 'new-org');
  });

  test('a field absent from the payload is never written and never recorded', async () => {
    const service = newService();

    // organization is intentionally omitted — the user never touched it this session.
    const configJson = JSON.stringify({ isFallbackForm: false, token: 'tok' });

    await service.handleSaveConfig(configJson);

    sinon.assert.neverCalledWith(updateConfigurationStub, CONFIGURATION_IDENTIFIER, 'advanced.organization');
    assert.strictEqual(explicitOverridesMap.getEntry(LS_GLOBAL_KEY.organization), undefined);
  });

  test('a write that throws does not record an explicit-overrides entry or update the cache', async () => {
    updateConfigurationStub.rejects(new Error('VS Code write failed'));
    lastKnownValueCache.set(ADVANCED_ORGANIZATION, 'pre-existing-cached-value');

    const service = newService();

    const configJson = JSON.stringify({
      isFallbackForm: false,
      token: 'tok',
      [LS_GLOBAL_KEY.organization]: 'new-org',
    });

    await service.handleSaveConfig(configJson);

    assert.strictEqual(explicitOverridesMap.getEntry(LS_GLOBAL_KEY.organization), undefined);
    assert.strictEqual(lastKnownValueCache.get(ADVANCED_ORGANIZATION), 'pre-existing-cached-value');
  });

  test('only the present sibling of a shared-vscodeKey fan-out group is recorded', async () => {
    const service = newService();

    // Only severity_filter_high was touched this session — its three siblings are absent.
    const configJson = JSON.stringify({
      isFallbackForm: false,
      token: 'tok',
      [LS_GLOBAL_KEY.severityFilterHigh]: false,
    });

    await service.handleSaveConfig(configJson);

    assert.deepStrictEqual(explicitOverridesMap.getEntry(LS_GLOBAL_KEY.severityFilterHigh), {
      kind: 'value',
      value: false,
    });
    assert.strictEqual(explicitOverridesMap.getEntry(LS_GLOBAL_KEY.severityFilterCritical), undefined);
    assert.strictEqual(explicitOverridesMap.getEntry(LS_GLOBAL_KEY.severityFilterMedium), undefined);
    assert.strictEqual(explicitOverridesMap.getEntry(LS_GLOBAL_KEY.severityFilterLow), undefined);
  });

  test('a recording exception for one fan-out sibling does not skip recording the others', async () => {
    const setExplicitValueCalls: string[] = [];
    const throwingMap: IExplicitOverridesMap = {
      setExplicitValue: (lsKey: string, value: unknown) => {
        setExplicitValueCalls.push(lsKey);
        if (lsKey === LS_GLOBAL_KEY.severityFilterCritical) {
          throw new Error('simulated recording failure');
        }
        explicitOverridesMap.setExplicitValue(lsKey, value);
      },
      setReset: (lsKey: string) => explicitOverridesMap.setReset(lsKey),
      getEntry: (lsKey: string) => explicitOverridesMap.getEntry(lsKey),
      confirmResetDelivered: (lsKey: string) => explicitOverridesMap.confirmResetDelivered(lsKey),
    };

    const service = new ConfigurationPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      clientAdapter,
      logger,
      undefined,
      undefined,
      throwingMap,
      lastKnownValueCache,
    );

    const configJson = JSON.stringify({
      isFallbackForm: false,
      token: 'tok',
      [LS_GLOBAL_KEY.severityFilterCritical]: true,
      [LS_GLOBAL_KEY.severityFilterHigh]: false,
      [LS_GLOBAL_KEY.severityFilterMedium]: true,
      [LS_GLOBAL_KEY.severityFilterLow]: false,
    });

    await service.handleSaveConfig(configJson);

    assert.strictEqual(setExplicitValueCalls.length, 4, 'all four siblings must have been attempted');
    assert.deepStrictEqual(explicitOverridesMap.getEntry(LS_GLOBAL_KEY.severityFilterHigh), {
      kind: 'value',
      value: false,
    });
    assert.deepStrictEqual(explicitOverridesMap.getEntry(LS_GLOBAL_KEY.severityFilterMedium), {
      kind: 'value',
      value: true,
    });
    assert.deepStrictEqual(explicitOverridesMap.getEntry(LS_GLOBAL_KEY.severityFilterLow), {
      kind: 'value',
      value: false,
    });
  });
});

// ── FIX 1: applyGlobalResets (INBOUND) must be scoped to GLOBAL_RESET_FIELDS ─
// A key NOT in GLOBAL_RESET_FIELDS that arrives as { value: null, changed: true }
// must NOT trigger updateConfiguration(..., undefined, ...) and must NOT be
// unmarkExplicitlyChanged'd by the inbound reset path.
suite('ConfigurationPersistenceService — inbound reset scope (FIX 1)', () => {
  let workspace: IVSCodeWorkspace;
  let configuration: IConfiguration;
  let scopeDetectionService: IScopeDetectionService;
  let clientAdapter: ILanguageClientAdapter;
  let logger: ILog;
  let updateConfigurationStub: sinon.SinonStub;

  class StubTracker implements IExplicitLspConfigurationChangeTracker {
    unmarkCalled: string[] = [];
    markExplicitlyChanged(_lsKey: string): void {
      /* no-op */
    }
    unmarkExplicitlyChanged(lsKey: string): void {
      this.unmarkCalled.push(lsKey);
    }
    isExplicitlyChanged(_lsKey: string): boolean {
      return false;
    }
    markPendingReset(_lsKey: string): void {
      /* no-op */
    }
    consumePendingResets(): Set<string> {
      return new Set();
    }
    markCommittedSinceReset(_lsKey: string): void {
      /* no-op */
    }
    committedSinceReset(_lsKey: string): boolean {
      return false;
    }
    hasLastKnownValue(_lsKey: string): boolean {
      return false;
    }
    getLastKnownValue(_lsKey: string): unknown {
      return undefined;
    }
    setLastKnownValue(_lsKey: string, _value: unknown): void {
      /* no-op */
    }
    markPendingInboundWrite(_vscodeKey: string): void {
      /* no-op */
    }
    consumePendingInboundWrite(_vscodeKey: string): boolean {
      return false;
    }
  }

  setup(() => {
    updateConfigurationStub = sinon.stub().resolves();
    workspace = {
      updateConfiguration: updateConfigurationStub,
      getConfiguration: sinon.stub().returns(undefined),
      getWorkspaceFolders: sinon.stub().returns([]),
      getWorkspaceFolderPaths: sinon.stub().returns([]),
      inspectConfiguration: sinon.stub().returns({ globalValue: undefined }),
    } as unknown as IVSCodeWorkspace;

    configuration = {
      getToken: sinon.stub().resolves('tok'),
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
      getLanguageClient: sinon.stub().returns({ sendNotification: sinon.stub().resolves() }),
    } as unknown as ILanguageClientAdapter;

    logger = {
      info: sinon.stub(),
      debug: sinon.stub(),
      error: sinon.stub(),
      warn: sinon.stub(),
    } as unknown as ILog;
  });

  teardown(() => sinon.restore());

  // api_endpoint is NOT in GLOBAL_RESET_FIELDS; an inbound {value:null, changed:true}
  // for it must NOT call updateConfiguration with undefined (which would silently wipe
  // the user's custom endpoint setting).
  test('inbound {value:null,changed:true} for a non-resettable key (api_endpoint) does NOT clear VS Code setting', async () => {
    const tracker = new StubTracker();
    const service = new ConfigurationPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      clientAdapter,
      logger,
      undefined,
      tracker,
    );

    const param: LspConfigurationParam = {
      settings: {
        [LS_KEY.apiEndpoint]: { value: null, changed: true },
      },
    };

    await service.persistInboundLspConfiguration(param);

    // updateConfiguration must NOT have been called with (_, _, undefined, true)
    // for api_endpoint (snyk.advanced.customEndpoint).
    const clearedEndpoint = updateConfigurationStub
      .getCalls()
      .some(c => c.args[1] === 'advanced.customEndpoint' && c.args[2] === undefined);
    assert.strictEqual(
      clearedEndpoint,
      false,
      'api_endpoint is not in GLOBAL_RESET_FIELDS; inbound null must NOT clear the VS Code setting',
    );
  });

  // api_endpoint with {value:null, changed:true} must NOT unmark the tracker either.
  test('inbound {value:null,changed:true} for a non-resettable key does NOT call unmarkExplicitlyChanged', async () => {
    const tracker = new StubTracker();
    const service = new ConfigurationPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      clientAdapter,
      logger,
      undefined,
      tracker,
    );

    const param: LspConfigurationParam = {
      settings: {
        [LS_KEY.apiEndpoint]: { value: null, changed: true },
      },
    };

    await service.persistInboundLspConfiguration(param);

    assert.ok(
      !tracker.unmarkCalled.includes(LS_KEY.apiEndpoint),
      'api_endpoint is not in GLOBAL_RESET_FIELDS; unmarkExplicitlyChanged must NOT be called for it',
    );
  });

  // A key that IS in GLOBAL_RESET_FIELDS (organization) must still be handled correctly
  // even when a non-resettable key is present in the same batch.
  test('inbound {value:null,changed:true} for a resettable key (organization) still clears VS Code setting', async () => {
    const tracker = new StubTracker();
    const service = new ConfigurationPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      clientAdapter,
      logger,
      undefined,
      tracker,
    );

    const param: LspConfigurationParam = {
      settings: {
        [LS_KEY.apiEndpoint]: { value: null, changed: true },
        [LS_GLOBAL_KEY.organization]: { value: null, changed: true },
      },
    };

    await service.persistInboundLspConfiguration(param);

    sinon.assert.calledWith(
      updateConfigurationStub,
      CONFIGURATION_IDENTIFIER,
      'advanced.organization',
      undefined,
      true,
    );
  });
});

// ── FIX 2: deduplication of shared-vscodeKey clears ────────────────────────
// severity_filter_critical/high/medium/low all map to snyk.severity.
// A full reset of all four severity keys must call updateConfiguration for
// snyk.severity exactly ONCE (not four times).
suite('ConfigurationPersistenceService — shared-vscodeKey dedupe in reset (FIX 2)', () => {
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
      getConfiguration: sinon.stub().returns(undefined),
      getWorkspaceFolders: sinon.stub().returns([]),
      getWorkspaceFolderPaths: sinon.stub().returns([]),
      inspectConfiguration: sinon.stub().returns({ globalValue: undefined }),
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
      getOssQuickFixCodeActionsEnabled: sinon.stub().returns(true),
      getAdditionalCliParameters: sinon.stub().returns(''),
      getSecureAtInceptionExecutionFrequency: sinon.stub().returns('Manual'),
      getAutoConfigureMcpServer: sinon.stub().returns(false),
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
      getLanguageClient: sinon.stub().returns({ sendNotification: sinon.stub().resolves() }),
    } as unknown as ILanguageClientAdapter;

    logger = {
      info: sinon.stub(),
      debug: sinon.stub(),
      error: sinon.stub(),
      warn: sinon.stub(),
    } as unknown as ILog;
  });

  teardown(() => sinon.restore());

  // Outbound path (handleSaveConfig): all four severity_filter_* nulled → exactly 1 write
  // for snyk.severity, not 4.
  test('outbound reset of all four severity_filter_* keys calls updateConfiguration for snyk.severity exactly once', async () => {
    const service = new ConfigurationPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      clientAdapter,
      logger,
    );

    const configJson = JSON.stringify({
      isFallbackForm: false,
      token: 'tok',
      [LS_GLOBAL_KEY.severityFilterCritical]: null,
      [LS_GLOBAL_KEY.severityFilterHigh]: null,
      [LS_GLOBAL_KEY.severityFilterMedium]: null,
      [LS_GLOBAL_KEY.severityFilterLow]: null,
    });

    await service.handleSaveConfig(configJson);

    const severityCalls = updateConfigurationStub
      .getCalls()
      .filter(c => c.args[1] === 'severity' && c.args[2] === undefined);

    assert.strictEqual(
      severityCalls.length,
      1,
      `Expected exactly 1 updateConfiguration call for 'severity' (undefined), got ${severityCalls.length}`,
    );
  });

  // Inbound path (persistInboundLspConfiguration): all four severity_filter_* as
  // {value:null, changed:true} → exactly 1 write for snyk.severity, not 4.
  test('inbound reset of all four severity_filter_* keys calls updateConfiguration for snyk.severity exactly once', async () => {
    const service = new ConfigurationPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      clientAdapter,
      logger,
    );

    const param: LspConfigurationParam = {
      settings: {
        [LS_GLOBAL_KEY.severityFilterCritical]: { value: null, changed: true },
        [LS_GLOBAL_KEY.severityFilterHigh]: { value: null, changed: true },
        [LS_GLOBAL_KEY.severityFilterMedium]: { value: null, changed: true },
        [LS_GLOBAL_KEY.severityFilterLow]: { value: null, changed: true },
      },
    };

    await service.persistInboundLspConfiguration(param);

    const severityCalls = updateConfigurationStub
      .getCalls()
      .filter(c => c.args[1] === 'severity' && c.args[2] === undefined);

    assert.strictEqual(
      severityCalls.length,
      1,
      `Expected exactly 1 updateConfiguration call for 'severity' (undefined), got ${severityCalls.length}`,
    );
  });
});

// ── FIX 3: invariant — every GLOBAL_RESET_FIELDS member must have a vscodeKey ─
suite('GLOBAL_RESET_FIELDS invariant (FIX 3)', () => {
  test('every member of GLOBAL_RESET_FIELDS has a truthy vscodeKey in SETTINGS_REGISTRY', () => {
    for (const lsKey of GLOBAL_RESET_FIELDS) {
      const entry = SETTINGS_REGISTRY[lsKey];
      assert.ok(entry, `GLOBAL_RESET_FIELDS member '${lsKey}' has no entry in SETTINGS_REGISTRY`);
      assert.ok(
        entry.vscodeKey,
        `GLOBAL_RESET_FIELDS member '${lsKey}' has no vscodeKey in SETTINGS_REGISTRY — only fields with a vscodeKey are resettable`,
      );
    }
  });
});

// ── FIX 1: inbound applyGlobalResets must NOT mutate tracker on write failure ─
// When updateConfiguration throws for a shared vscodeKey (e.g. snyk.severity),
// the lsKeys for that group must remain marked as explicitly changed.
suite('ConfigurationPersistenceService — inbound applyGlobalResets tracker atomicity (FIX 1)', () => {
  class FakeTrackerFix1 implements IExplicitLspConfigurationChangeTracker {
    private readonly keys = new Set<string>();
    private readonly pending = new Set<string>();
    private readonly committed = new Set<string>();
    private readonly lastKnown = new Map<string, unknown>();
    private readonly pendingInboundWrites = new Set<string>();
    markExplicitlyChanged(lsKey: string): void {
      this.keys.add(lsKey);
    }
    unmarkExplicitlyChanged(lsKey: string): void {
      this.keys.delete(lsKey);
    }
    isExplicitlyChanged(lsKey: string): boolean {
      return this.keys.has(lsKey);
    }
    markPendingReset(lsKey: string): void {
      this.pending.add(lsKey);
      this.committed.delete(lsKey);
    }
    consumePendingResets(): Set<string> {
      const snap = new Set(this.pending);
      this.pending.clear();
      return snap;
    }
    markCommittedSinceReset(lsKey: string): void {
      this.committed.add(lsKey);
    }
    committedSinceReset(lsKey: string): boolean {
      return this.committed.has(lsKey);
    }
    hasLastKnownValue(lsKey: string): boolean {
      return this.lastKnown.has(lsKey);
    }
    getLastKnownValue(lsKey: string): unknown {
      return this.lastKnown.get(lsKey);
    }
    setLastKnownValue(lsKey: string, value: unknown): void {
      this.lastKnown.set(lsKey, value);
    }
    markPendingInboundWrite(vscodeKey: string): void {
      this.pendingInboundWrites.add(vscodeKey);
    }
    consumePendingInboundWrite(vscodeKey: string): boolean {
      return this.pendingInboundWrites.delete(vscodeKey);
    }
  }

  let workspace: IVSCodeWorkspace;
  let configuration: IConfiguration;
  let scopeDetectionService: IScopeDetectionService;
  let clientAdapter: ILanguageClientAdapter;
  let logger: ILog;
  let updateConfigurationStub: sinon.SinonStub;
  let tracker: FakeTrackerFix1;

  setup(() => {
    updateConfigurationStub = sinon.stub();
    workspace = {
      updateConfiguration: updateConfigurationStub,
      getConfiguration: sinon.stub().returns(undefined),
      getWorkspaceFolders: sinon.stub().returns([]),
      getWorkspaceFolderPaths: sinon.stub().returns([]),
      inspectConfiguration: sinon.stub().returns({ globalValue: undefined }),
    } as unknown as IVSCodeWorkspace;

    configuration = {
      getToken: sinon.stub().resolves('tok'),
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
      getLanguageClient: sinon.stub().returns({ sendNotification: sinon.stub().resolves() }),
    } as unknown as ILanguageClientAdapter;

    logger = {
      info: sinon.stub(),
      debug: sinon.stub(),
      error: sinon.stub(),
      warn: sinon.stub(),
    } as unknown as ILog;

    tracker = new FakeTrackerFix1();
  });

  teardown(() => sinon.restore());

  // The critical case: all four severity_filter_* arrive as {value:null, changed:true},
  // they all share vscodeKey 'snyk.severity'. If updateConfiguration rejects for that
  // vscodeKey, the tracker must NOT be mutated for any of the lsKeys in that group.
  test('tracker is NOT mutated when updateConfiguration rejects for the severity vscodeKey', async () => {
    // Pre-mark all four severity keys as explicitly changed.
    tracker.markExplicitlyChanged(LS_GLOBAL_KEY.severityFilterCritical);
    tracker.markExplicitlyChanged(LS_GLOBAL_KEY.severityFilterHigh);
    tracker.markExplicitlyChanged(LS_GLOBAL_KEY.severityFilterMedium);
    tracker.markExplicitlyChanged(LS_GLOBAL_KEY.severityFilterLow);

    // Make updateConfiguration reject for ANY call (severity vscodeKey will be hit).
    updateConfigurationStub.rejects(new Error('VS Code write failed'));

    const service = new ConfigurationPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      clientAdapter,
      logger,
      undefined,
      tracker,
    );

    const param: LspConfigurationParam = {
      settings: {
        [LS_GLOBAL_KEY.severityFilterCritical]: { value: null, changed: true },
        [LS_GLOBAL_KEY.severityFilterHigh]: { value: null, changed: true },
        [LS_GLOBAL_KEY.severityFilterMedium]: { value: null, changed: true },
        [LS_GLOBAL_KEY.severityFilterLow]: { value: null, changed: true },
      },
    };

    // applyGlobalResets catches write errors internally; the method may or may not rethrow.
    try {
      await service.persistInboundLspConfiguration(param);
    } catch (_e) {
      // Any rethrow is acceptable; we care about tracker state.
    }

    // All four severity lsKeys must still be marked as explicitly changed — the write failed.
    assert.strictEqual(
      tracker.isExplicitlyChanged(LS_GLOBAL_KEY.severityFilterCritical),
      true,
      'severity_filter_critical must remain explicitly changed when write fails',
    );
    assert.strictEqual(
      tracker.isExplicitlyChanged(LS_GLOBAL_KEY.severityFilterHigh),
      true,
      'severity_filter_high must remain explicitly changed when write fails',
    );
    assert.strictEqual(
      tracker.isExplicitlyChanged(LS_GLOBAL_KEY.severityFilterMedium),
      true,
      'severity_filter_medium must remain explicitly changed when write fails',
    );
    assert.strictEqual(
      tracker.isExplicitlyChanged(LS_GLOBAL_KEY.severityFilterLow),
      true,
      'severity_filter_low must remain explicitly changed when write fails',
    );
  });

  // Happy-path: a successful inbound reset unmarks the keys and clears the
  // shared vscodeKey exactly once.
  test('successful inbound reset unmarks all lsKeys and clears shared vscodeKey exactly once', async () => {
    tracker.markExplicitlyChanged(LS_GLOBAL_KEY.severityFilterCritical);
    tracker.markExplicitlyChanged(LS_GLOBAL_KEY.severityFilterHigh);
    tracker.markExplicitlyChanged(LS_GLOBAL_KEY.severityFilterMedium);
    tracker.markExplicitlyChanged(LS_GLOBAL_KEY.severityFilterLow);

    updateConfigurationStub.resolves();

    const service = new ConfigurationPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      clientAdapter,
      logger,
      undefined,
      tracker,
    );

    const param: LspConfigurationParam = {
      settings: {
        [LS_GLOBAL_KEY.severityFilterCritical]: { value: null, changed: true },
        [LS_GLOBAL_KEY.severityFilterHigh]: { value: null, changed: true },
        [LS_GLOBAL_KEY.severityFilterMedium]: { value: null, changed: true },
        [LS_GLOBAL_KEY.severityFilterLow]: { value: null, changed: true },
      },
    };

    await service.persistInboundLspConfiguration(param);

    // All four lsKeys must be unmarked after a successful write.
    assert.strictEqual(
      tracker.isExplicitlyChanged(LS_GLOBAL_KEY.severityFilterCritical),
      false,
      'severity_filter_critical must be unmarked after successful reset',
    );
    assert.strictEqual(
      tracker.isExplicitlyChanged(LS_GLOBAL_KEY.severityFilterHigh),
      false,
      'severity_filter_high must be unmarked after successful reset',
    );
    assert.strictEqual(
      tracker.isExplicitlyChanged(LS_GLOBAL_KEY.severityFilterMedium),
      false,
      'severity_filter_medium must be unmarked after successful reset',
    );
    assert.strictEqual(
      tracker.isExplicitlyChanged(LS_GLOBAL_KEY.severityFilterLow),
      false,
      'severity_filter_low must be unmarked after successful reset',
    );

    // The shared vscodeKey (snyk.severity) must be cleared exactly once.
    const severityClearCalls = updateConfigurationStub
      .getCalls()
      .filter(c => c.args[1] === 'severity' && c.args[2] === undefined);
    assert.strictEqual(
      severityClearCalls.length,
      1,
      `Expected exactly 1 updateConfiguration call for 'severity' (undefined), got ${severityClearCalls.length}`,
    );
  });
});

// ── FIX 2: withoutGlobalResets must be scoped to GLOBAL_RESET_FIELDS ─────────
// A non-resettable LS key arriving as {value:null, changed:true} must NOT be
// silently dropped from the write path; it must be passed through.
suite('ConfigurationPersistenceService — withoutGlobalResets GLOBAL_RESET_FIELDS scope (FIX 2)', () => {
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
      getConfiguration: sinon.stub().returns(undefined),
      getWorkspaceFolders: sinon.stub().returns([]),
      getWorkspaceFolderPaths: sinon.stub().returns([]),
      inspectConfiguration: sinon.stub().returns({ globalValue: undefined }),
    } as unknown as IVSCodeWorkspace;

    configuration = {
      getToken: sinon.stub().resolves('tok'),
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
      getLanguageClient: sinon.stub().returns({ sendNotification: sinon.stub().resolves() }),
    } as unknown as ILanguageClientAdapter;

    logger = {
      info: sinon.stub(),
      debug: sinon.stub(),
      error: sinon.stub(),
      warn: sinon.stub(),
    } as unknown as ILog;
  });

  teardown(() => sinon.restore());

  // api_endpoint (LS_KEY.apiEndpoint) is NOT in GLOBAL_RESET_FIELDS. When it arrives as
  // {value:null, changed:true}, withoutGlobalResets must keep it in the result map so that
  // the write path processes it (rather than silently dropping it as if it were a reset).
  //
  // mapLspSettingsToVscodeSettings skips null values (value===null means nothing to write),
  // so the observable assertion is that updateConfiguration is NOT called with the endpoint
  // value AND the inbound null is not silently swallowed before reaching mapLspSettingsToVscodeSettings.
  // We verify via a spy on workspace.getConfiguration — if the key was retained, the flow
  // continues past withoutGlobalResets. The simplest observable: assert updateConfiguration
  // is never called with (_, 'advanced.customEndpoint', undefined, true) — i.e. the inbound
  // null was NOT treated as a reset (which would clear the VS Code setting).
  test('non-GLOBAL_RESET_FIELDS key with {value:null,changed:true} is NOT dropped by withoutGlobalResets (not treated as reset)', async () => {
    const service = new ConfigurationPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      clientAdapter,
      logger,
    );

    // api_endpoint is NOT in GLOBAL_RESET_FIELDS.
    // Send it as {value:null, changed:true} — must NOT be treated as a global reset.
    const param: LspConfigurationParam = {
      settings: {
        [LS_KEY.apiEndpoint]: { value: null, changed: true },
      },
    };

    await service.persistInboundLspConfiguration(param);

    // The key must NOT have been cleared as a global reset (updateConfiguration with undefined).
    const clearedAsReset = updateConfigurationStub
      .getCalls()
      .some(c => c.args[1] === 'advanced.customEndpoint' && c.args[2] === undefined);
    assert.strictEqual(
      clearedAsReset,
      false,
      'api_endpoint is not in GLOBAL_RESET_FIELDS; withoutGlobalResets must not drop or treat it as a reset',
    );
  });

  // FIX: mapLspSettingsToVscodeSettings must skip null values (same as undefined).
  // A non-GLOBAL_RESET_FIELDS key arriving as {value:null, changed:true} must NOT cause
  // updateConfiguration to be called with null as the value — that would silently clear
  // or garble the user's VS Code setting.
  test('non-GLOBAL_RESET_FIELDS key with {value:null,changed:true} does NOT write null to VS Code settings', async () => {
    const service = new ConfigurationPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      clientAdapter,
      logger,
    );

    // api_endpoint is NOT in GLOBAL_RESET_FIELDS.
    // Send it as {value:null, changed:true} — mapLspSettingsToVscodeSettings must skip it.
    const param: LspConfigurationParam = {
      settings: {
        [LS_KEY.apiEndpoint]: { value: null, changed: true },
      },
    };

    await service.persistInboundLspConfiguration(param);

    // updateConfiguration must NOT be called with null as the value for the endpoint setting.
    const wroteNull = updateConfigurationStub
      .getCalls()
      .some(c => c.args[1] === 'advanced.customEndpoint' && c.args[2] === null);
    assert.strictEqual(
      wroteNull,
      false,
      'mapLspSettingsToVscodeSettings must skip null values; null must not be written to VS Code settings',
    );
  });

  // Positive case: a non-GLOBAL_RESET_FIELDS key with a real (non-null) value arriving
  // alongside another non-GLOBAL_RESET_FIELDS null key — both reach the write path.
  // The null key is retained by withoutGlobalResets (not a reset-field drop); null values
  // are simply not written by mapLspSettingsToVscodeSettings (they are undefined-valued in
  // the registry lookup). The non-null key IS written.
  test('non-GLOBAL_RESET_FIELDS key with a real value is written normally when a null sibling is present', async () => {
    const service = new ConfigurationPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      clientAdapter,
      logger,
    );

    const param: LspConfigurationParam = {
      settings: {
        // Not in GLOBAL_RESET_FIELDS — null, but must not be treated as a reset.
        [LS_KEY.apiEndpoint]: { value: null, changed: true },
        // Not in GLOBAL_RESET_FIELDS — real value, must be written.
        [LS_KEY.organization]: { value: 'my-org', changed: true },
      },
    };

    await service.persistInboundLspConfiguration(param);

    // organization (LS_KEY.organization) has vscodeKey ADVANCED_ORGANIZATION;
    // it is NOT in GLOBAL_RESET_FIELDS so it must be written via the normal path.
    sinon.assert.calledWith(updateConfigurationStub, CONFIGURATION_IDENTIFIER, 'advanced.organization', 'my-org', true);
  });
});

// ── applyOutboundGlobalResets: multi-vscodeKey batch behavior ────────────────
//
// A multi-vscodeKey reset batch (organization + scan_net_new) must queue a pending
// reset for every group, and a write failure in one group must not abort the others
// (per-group try/catch). Originally written to also assert an outboundResetSuppressor
// begin/end-per-batch invariant; that suppressor was removed as dead code once the
// listener switched to a write-time tag (markPendingInboundWrite/consumePendingInboundWrite,
// IDE-2264) — the suppressor-specific assertions went with it, these two behaviors did not.
suite('ConfigurationPersistenceService — applyOutboundGlobalResets multi-key batch', () => {
  function makeMemento(): import('vscode').Memento {
    const store = new Map<string, unknown>();
    return {
      get<T>(key: string, defaultValue?: T): T {
        return (store.has(key) ? store.get(key) : defaultValue) as T;
      },
      update(key: string, value: unknown): Thenable<void> {
        store.set(key, value);
        return Promise.resolve();
      },
      keys(): readonly string[] {
        return [...store.keys()];
      },
    };
  }

  let configuration: IConfiguration;
  let scopeDetectionService: IScopeDetectionService;
  let clientAdapter: ILanguageClientAdapter;
  let logger: ILog;

  setup(() => {
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
      getOssQuickFixCodeActionsEnabled: sinon.stub().returns(true),
      getAdditionalCliParameters: sinon.stub().returns(''),
      getSecureAtInceptionExecutionFrequency: sinon.stub().returns('Manual'),
      getAutoConfigureMcpServer: sinon.stub().returns(false),
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
      getLanguageClient: sinon.stub().returns({ sendNotification: sinon.stub().resolves() }),
    } as unknown as ILanguageClientAdapter;

    logger = {
      info: sinon.stub(),
      debug: sinon.stub(),
      error: sinon.stub(),
      warn: sinon.stub(),
    } as unknown as ILog;
  });

  teardown(() => sinon.restore());

  test('multi-key batch: both groups record a reset entry', async () => {
    const explicitOverridesMap = new ExplicitOverridesMap(makeMemento());

    const updateConfigurationStub = sinon.stub().resolves();
    const workspace = {
      updateConfiguration: updateConfigurationStub,
      getConfiguration: sinon.stub().returns(undefined),
      getWorkspaceFolders: sinon.stub().returns([]),
      getWorkspaceFolderPaths: sinon.stub().returns([]),
      inspectConfiguration: sinon.stub().returns({ globalValue: undefined, defaultValue: undefined }),
    } as unknown as IVSCodeWorkspace;

    const service = new ConfigurationPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      clientAdapter,
      logger,
      undefined,
      undefined,
      explicitOverridesMap,
    );

    // Use two keys that map to DIFFERENT vscodeKeys: organization and scan_net_new.
    // This produces two distinct groups in vscodeKeyToLsKeys.
    const configJson = JSON.stringify({
      isFallbackForm: false,
      token: 'tok',
      [LS_GLOBAL_KEY.organization]: null,
      [LS_GLOBAL_KEY.scanNetNew]: null,
    });

    await service.handleSaveConfig(configJson);

    assert.deepStrictEqual(explicitOverridesMap.getEntry(LS_GLOBAL_KEY.organization), { kind: 'reset' });
    assert.deepStrictEqual(explicitOverridesMap.getEntry(LS_GLOBAL_KEY.scanNetNew), { kind: 'reset' });
  });

  // Write failure in one group must NOT abort the batch (per-group try/catch preserved).
  test('write failure in first group does not abort batch — second group still resets', async () => {
    const explicitOverridesMap = new ExplicitOverridesMap(makeMemento());

    let callCount = 0;
    // First vscodeKey write fails; second succeeds. Iteration order follows
    // GLOBAL_RESET_FIELDS, where scan_net_new precedes organization — so scan_net_new's
    // group is processed (and fails) first.
    const updateConfigurationStub = sinon.stub().callsFake(() => {
      callCount++;
      if (callCount === 1) throw new Error('first write failed');
      return Promise.resolve();
    });

    const workspace = {
      updateConfiguration: updateConfigurationStub,
      getConfiguration: sinon.stub().returns(undefined),
      getWorkspaceFolders: sinon.stub().returns([]),
      getWorkspaceFolderPaths: sinon.stub().returns([]),
      inspectConfiguration: sinon.stub().returns({ globalValue: undefined, defaultValue: undefined }),
    } as unknown as IVSCodeWorkspace;

    const service = new ConfigurationPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      clientAdapter,
      logger,
      undefined,
      undefined,
      explicitOverridesMap,
    );

    // Two keys with different vscodeKeys: organization and scan_net_new.
    const configJson = JSON.stringify({
      isFallbackForm: false,
      token: 'tok',
      [LS_GLOBAL_KEY.organization]: null,
      [LS_GLOBAL_KEY.scanNetNew]: null,
    });

    await service.handleSaveConfig(configJson);

    // The second (successful) group's reset must still be recorded despite the first failing.
    assert.deepStrictEqual(
      explicitOverridesMap.getEntry(LS_GLOBAL_KEY.organization),
      { kind: 'reset' },
      'organization must still be recorded as reset after the first group (scan_net_new) failed',
    );
    assert.strictEqual(
      explicitOverridesMap.getEntry(LS_GLOBAL_KEY.scanNetNew),
      undefined,
      'scan_net_new must NOT be recorded — its write failed',
    );
  });
});

// ── CP-2.1/2.2/2.3: Regression guard for IDE-2149 ───────────────────────────
//
// These tests encode the customer-visible outcome for the Project Defaults reset bug
// (IDE-2149): after a reset clears the VS Code global override, the resolved scope was
// 'default', and a guard that compared the saved value against the package.json schema
// default (true for snyk_code_enabled) silently skipped a matching re-enable save. The LS
// never received the re-enabled value.
//
// The outbound save path no longer has ANY such gate: `saveConfigToVSCodeSettings` never
// consults the last-known-value cache or `shouldSkipSettingUpdate` at all (see
// `applyOutboundSettingsMap`), so this bug class is now structurally impossible for a
// webview save, regardless of what the schema default or any previously-observed inbound
// value happens to be — every key present in the save payload is written directly, full
// stop. The last-known-value cache is still updated by the (separately migrated) INBOUND
// leg (`persistInboundLspConfiguration`), so these tests keep using the real
// `ScopeDetectionService` and drive inbound pushes to prove the outbound save is
// unaffected by whatever state inbound left behind.

// ── Shared helpers for the CP-2.1 suite ──────────────────────────────────────

/** VS Code key for Snyk Code enablement: snyk.features.codeSecurity */
const CODE_SECURITY_VSCODE_KEY = CODE_SECURITY_ENABLED_SETTING;
/** configurationId = 'snyk', section = 'features.codeSecurity' */
const CODE_SECURITY_SECTION = CODE_SECURITY_VSCODE_KEY.replace('snyk.', '');

/**
 * Build a workspace stub whose inspectConfiguration returns:
 *   { defaultValue: true, globalValue: undefined }
 * for the Snyk Code key — real schema default, no user override (post-reset state).
 * updateConfiguration is the provided stub so tests can assert it.
 */
function makeWorkspaceWithSchemaDefault(updateConfigStub: sinon.SinonStub): IVSCodeWorkspace {
  return {
    updateConfiguration: updateConfigStub,
    getConfiguration: sinon.stub().returns(undefined),
    getWorkspaceFolders: sinon.stub().returns([]),
    getWorkspaceFolderPaths: sinon.stub().returns([]),
    inspectConfiguration: sinon.stub().callsFake((configId: string, section: string) => {
      if (configId === 'snyk' && section === CODE_SECURITY_SECTION) {
        // Real schema default (from package.json): true.
        // No user/workspace/workspaceFolder override (post-reset state).
        return {
          defaultValue: true,
          globalValue: undefined,
          workspaceValue: undefined,
          workspaceFolderValue: undefined,
        };
      }
      // All other keys: no override, defaultValue undefined (irrelevant).
      return {
        defaultValue: undefined,
        globalValue: undefined,
        workspaceValue: undefined,
        workspaceFolderValue: undefined,
      };
    }),
  } as unknown as IVSCodeWorkspace;
}

/** Minimal configuration stub satisfying handleSaveConfig's non-fallback path. */
function makeConfigStub(): IConfiguration {
  return {
    getToken: sinon.stub().resolves('tok'),
    setToken: sinon.stub().resolves(),
    getFolderConfigs: sinon.stub().returns([]),
    setFolderConfigs: sinon.stub().resolves(),
    getFeaturesConfiguration: sinon.stub().returns({
      ossEnabled: true,
      codeSecurityEnabled: false, // matches the inbound effective value from LS
      iacEnabled: true,
      secretsEnabled: true,
    }),
    scanningMode: 'auto',
    organization: '',
    snykApiEndpoint: 'https://api.snyk.io',
    getInsecure: sinon.stub().returns(false),
    getAuthenticationMethod: sinon.stub().returns('oauth'),
    getDeltaFindingsEnabled: sinon.stub().returns(false),
    getOssQuickFixCodeActionsEnabled: sinon.stub().returns(true),
    getAdditionalCliParameters: sinon.stub().returns(''),
    getSecureAtInceptionExecutionFrequency: sinon.stub().returns('Manual'),
    getAutoConfigureMcpServer: sinon.stub().returns(false),
    severityFilter: {},
    issueViewOptions: {},
    riskScoreThreshold: 0,
    getTrustedFolders: sinon.stub().returns([]),
    getCliPath: sinon.stub().resolves(''),
    isAutomaticDependencyManagementEnabled: sinon.stub().returns(true),
    getCliBaseDownloadUrl: sinon.stub().returns(''),
  } as unknown as IConfiguration;
}

/** Minimal logger stub. */
function makeLogger(): ILog {
  return {
    info: sinon.stub(),
    debug: sinon.stub(),
    error: sinon.stub(),
    warn: sinon.stub(),
  } as unknown as ILog;
}

/** Minimal clientAdapter stub (LS not needed for save-path tests). */
function makeClientAdapter(): ILanguageClientAdapter {
  return {
    getLanguageClient: sinon.stub().returns({ sendNotification: sinon.stub().resolves() }),
  } as unknown as ILanguageClientAdapter;
}

/**
 * The inbound LspConfigurationParam that carries the LS-resolved effective value:
 *   snyk_code_enabled → { value: false, changed: true }
 *
 * This represents: the org/GAF/LDX-Sync resolved effective value for Snyk Code is false.
 * persistInboundLspConfiguration records this in the last-known-value cache under
 * 'snyk.features.codeSecurity'.
 */
const INBOUND_PARAM_CODE_FALSE: LspConfigurationParam = {
  settings: {
    [LS_GLOBAL_KEY.snykCodeEnabled]: { value: false, changed: true },
  },
};

// ── ACC-001: Acceptance test — the customer-visible outcome ───────────────────
//
// Given: LS-resolved effective value for Snyk Code is false (captured by the INBOUND leg);
//        a Project Defaults reset has cleared the VS Code global override (no globalValue);
//        inspect() returns the real schema default: { defaultValue: true, globalValue: undefined }.
// When:  The user re-enables Snyk Code (true) through the real save path (handleSaveConfig).
// Then:  updateConfiguration IS called with the Snyk Code VS Code key, value true, global scope.
//        (The outbound save never gates on the inbound-captured effective value at all.)
suite('ConfigurationPersistenceService — IDE-2149 regression guard (effective-baseline skip)', () => {
  let updateConfigStub: sinon.SinonStub;
  let workspace: IVSCodeWorkspace;
  let configuration: IConfiguration;
  let realScopeDetectionService: ScopeDetectionService;
  let clientAdapter: ILanguageClientAdapter;
  let logger: ILog;

  setup(() => {
    updateConfigStub = sinon.stub().resolves();
    workspace = makeWorkspaceWithSchemaDefault(updateConfigStub);
    configuration = makeConfigStub();
    realScopeDetectionService = new ScopeDetectionService(workspace);
    clientAdapter = makeClientAdapter();
    logger = makeLogger();
  });

  teardown(() => sinon.restore());

  function newService(): ConfigurationPersistenceService {
    return new ConfigurationPersistenceService(
      workspace,
      configuration,
      realScopeDetectionService,
      clientAdapter,
      logger,
    );
  }

  // ACC-001
  test('TestSaveAfterReset_ReEnableEqualsSchemaDefault_PersistsAndMarksChanged', async () => {
    const service = newService();

    // Step 1: LS delivers effective value false via $/snyk.configuration.
    // This records false in the last-known-value cache (the inbound leg's own
    // redundancy check, irrelevant to the outbound save below).
    await service.persistInboundLspConfiguration(INBOUND_PARAM_CODE_FALSE);

    // Reset the stub so we only observe calls from the save path below.
    updateConfigStub.reset();

    // Step 2: User re-enables Snyk Code (true) after a Project Defaults reset.
    // isFallbackForm:false triggers the non-fallback save path.
    const configJson = JSON.stringify({
      isFallbackForm: false,
      token: 'tok',
      [LS_GLOBAL_KEY.snykCodeEnabled]: true,
    });

    await service.handleSaveConfig(configJson);

    // The VS Code write MUST have been called with the correct key (snyk, features.codeSecurity),
    // value true, at global scope (writeToUserScope=true). Removing this assertion → test passes
    // trivially if the stub was not called (ghost-test guard).
    sinon.assert.calledWith(
      updateConfigStub,
      CONFIGURATION_IDENTIFIER, // configurationId = 'snyk'
      CODE_SECURITY_SECTION, // section = 'features.codeSecurity'
      true, // value = true (user's re-enable)
      true, // writeToUserScope = true (global scope)
    );
  });

  // INT-001: value equals schema default but differs from the inbound-captured effective value → writes
  test('TestApplySettingsMap_RealGuard_SchemaDefaultButDiffersFromEffective_Writes', async () => {
    const service = newService();

    // Deliver effective value false (LS resolved: org policy disables Snyk Code).
    await service.persistInboundLspConfiguration(INBOUND_PARAM_CODE_FALSE);
    updateConfigStub.reset();

    // Save true — equals schema default (true), differs from the inbound effective value (false).
    // The outbound save writes it either way; it never consults the inbound snapshot.
    const configJson = JSON.stringify({
      isFallbackForm: false,
      token: 'tok',
      [LS_GLOBAL_KEY.snykCodeEnabled]: true,
    });
    await service.handleSaveConfig(configJson);

    const codeSecurityWrites = updateConfigStub
      .getCalls()
      .filter(c => c.args[0] === CONFIGURATION_IDENTIFIER && c.args[1] === CODE_SECURITY_SECTION && c.args[2] === true);

    assert.ok(
      codeSecurityWrites.length > 0,
      'INT-001: updateConfiguration must be called for features.codeSecurity with value true ' +
        'when value equals schema default but differs from the inbound-captured effective value.',
    );
  });

  // INT-002 (inverted from the pre-redesign guard): value equals the inbound-captured effective
  // value → the outbound save still writes it. Both webviews only send a field when its value
  // genuinely changed client-side, so a match against a server-side snapshot must never suppress
  // the write — that comparison is exactly what this redesign removes from the outbound leg.
  test('TestApplySettingsMap_RealGuard_EqualsEffective_StillWrites', async () => {
    // Effective value from LS: true (org policy enables Snyk Code — already enabled).
    const inboundTrue: LspConfigurationParam = {
      settings: {
        [LS_GLOBAL_KEY.snykCodeEnabled]: { value: true, changed: false },
      },
    };

    const service = newService();

    // Deliver effective value true.
    await service.persistInboundLspConfiguration(inboundTrue);
    updateConfigStub.reset();

    // Save true — equals the inbound effective value true. The outbound save never compares
    // against it, so the write still happens.
    const configJson = JSON.stringify({
      isFallbackForm: false,
      token: 'tok',
      [LS_GLOBAL_KEY.snykCodeEnabled]: true,
    });
    await service.handleSaveConfig(configJson);

    const codeSecurityWrites = updateConfigStub
      .getCalls()
      .filter(c => c.args[0] === CONFIGURATION_IDENTIFIER && c.args[1] === CODE_SECURITY_SECTION && c.args[2] === true);

    assert.ok(
      codeSecurityWrites.length > 0,
      'INT-002: updateConfiguration must be called even when saving a value that equals the ' +
        'inbound-captured effective value — the outbound save has no gate to suppress it.',
    );
  });

  // INT-003: no inbound snapshot yet; value equals schema default; no override → still writes
  test('TestApplySettingsMap_RealGuard_NoSnapshot_DoesNotSkipOnSchemaDefault', async () => {
    // No persistInboundLspConfiguration call — irrelevant to the outbound save either way.
    const service = newService();

    const configJson = JSON.stringify({
      isFallbackForm: false,
      token: 'tok',
      [LS_GLOBAL_KEY.snykCodeEnabled]: true,
    });
    await service.handleSaveConfig(configJson);

    const codeSecurityWrites = updateConfigStub
      .getCalls()
      .filter(c => c.args[0] === CONFIGURATION_IDENTIFIER && c.args[1] === CODE_SECURITY_SECTION && c.args[2] === true);

    assert.ok(
      codeSecurityWrites.length > 0,
      'INT-003: updateConfiguration must be called regardless of whether an inbound snapshot exists ' +
        'or the value happens to equal the schema default.',
    );
  });

  // INT-004: an inbound snapshot captured earlier has no bearing on a later outbound save
  test('TestPersistInbound_CapturesEffectiveSnapshotForLaterSaves', async () => {
    const service = newService();

    // Step 1: LS sends effective false — captured for the (separately migrated) inbound leg only.
    await service.persistInboundLspConfiguration(INBOUND_PARAM_CODE_FALSE);
    updateConfigStub.reset();

    // Step 2: Save true — the outbound save writes it unconditionally.
    const configJson = JSON.stringify({
      isFallbackForm: false,
      token: 'tok',
      [LS_GLOBAL_KEY.snykCodeEnabled]: true,
    });
    await service.handleSaveConfig(configJson);

    const codeSecurityWrites = updateConfigStub
      .getCalls()
      .filter(c => c.args[0] === CONFIGURATION_IDENTIFIER && c.args[1] === CODE_SECURITY_SECTION && c.args[2] === true);

    assert.ok(
      codeSecurityWrites.length > 0,
      'INT-004: a prior inbound snapshot must not affect a later outbound save — it is never consulted.',
    );
  });
});

// ── Defect 1: the inbound redundancy check must compare against the FULLY-MERGED value ──
//
// Multiple LS keys map to one vscodeKey: all four severity_filter_* keys → snyk.severity,
// and issue_view_open_issues / issue_view_ignored_issues → snyk.issueViewOptions. Each
// inbound push writes the value merged with the current VS Code state (applySettingsMap's
// own object-merge step) and stores that same merged value in the last-known-value cache.
// If a future change ever stored a partial object instead (e.g. last-writer-wins across the
// fan-out group), a second identical push would compare the merged incoming value against a
// stale partial cache entry and spuriously rewrite on every sync.
//
// These tests probe that the cache holds the fully-merged shape via a second inbound push.

suite('ConfigurationPersistenceService — snapshot merges shared-vscodeKey partials (Defect 1)', () => {
  let updateConfigStub: sinon.SinonStub;
  let workspace: IVSCodeWorkspace;
  let realScopeService: ScopeDetectionService;
  let lastKnownValueCache: LastKnownValueCache;

  setup(() => {
    updateConfigStub = sinon.stub().resolves();
    workspace = {
      updateConfiguration: updateConfigStub,
      // getConfiguration returns the merged severity object (as VS Code would after a prior write).
      getConfiguration: sinon.stub().callsFake((configId: string, section: string) => {
        if (configId === CONFIGURATION_IDENTIFIER && section === 'severity') {
          return { critical: true, high: true, medium: true, low: true };
        }
        if (configId === CONFIGURATION_IDENTIFIER && section === 'issueViewOptions') {
          return { openIssues: true, ignoredIssues: true };
        }
        return undefined;
      }),
      getWorkspaceFolders: sinon.stub().returns([]),
      getWorkspaceFolderPaths: sinon.stub().returns([]),
      // User has an explicit global override for severity (so scope = 'user' → guard checks globalValue).
      inspectConfiguration: sinon.stub().callsFake((configId: string, section: string) => {
        if (configId === CONFIGURATION_IDENTIFIER && section === 'severity') {
          return {
            defaultValue: { critical: true, high: true, medium: true, low: true },
            globalValue: { critical: true, high: true, medium: true, low: true },
            workspaceValue: undefined,
            workspaceFolderValue: undefined,
          };
        }
        if (configId === CONFIGURATION_IDENTIFIER && section === 'issueViewOptions') {
          return {
            defaultValue: { openIssues: true, ignoredIssues: true },
            globalValue: { openIssues: true, ignoredIssues: true },
            workspaceValue: undefined,
            workspaceFolderValue: undefined,
          };
        }
        return {
          defaultValue: undefined,
          globalValue: undefined,
          workspaceValue: undefined,
          workspaceFolderValue: undefined,
        };
      }),
    } as unknown as IVSCodeWorkspace;

    realScopeService = new ScopeDetectionService(workspace);
    // Empty seed: each test's first inbound push populates it, mirroring a fresh session.
    lastKnownValueCache = new LastKnownValueCache(workspace, []);
  });

  teardown(() => sinon.restore());

  function newService(): ConfigurationPersistenceService {
    return new ConfigurationPersistenceService(
      workspace,
      {
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
        getOssQuickFixCodeActionsEnabled: sinon.stub().returns(true),
        getAdditionalCliParameters: sinon.stub().returns(''),
        getSecureAtInceptionExecutionFrequency: sinon.stub().returns('Manual'),
        getAutoConfigureMcpServer: sinon.stub().returns(false),
        severityFilter: { critical: true, high: true, medium: true, low: true },
        issueViewOptions: { openIssues: true, ignoredIssues: true },
        riskScoreThreshold: 0,
        getTrustedFolders: sinon.stub().returns([]),
        getCliPath: sinon.stub().resolves(''),
        isAutomaticDependencyManagementEnabled: sinon.stub().returns(true),
        getCliBaseDownloadUrl: sinon.stub().returns(''),
      } as unknown as IConfiguration,
      realScopeService,
      {
        getLanguageClient: sinon.stub().returns({ sendNotification: sinon.stub().resolves() }),
      } as unknown as ILanguageClientAdapter,
      { info: sinon.stub(), debug: sinon.stub(), error: sinon.stub(), warn: sinon.stub() } as unknown as ILog,
      undefined,
      undefined,
      undefined,
      lastKnownValueCache,
    );
  }

  // Defect 1a: after a full severity batch inbound, an identical second inbound push must be
  // SKIPPED. RED reason (before fix): snapshot holds only the last-written partial {low:true};
  //   _.isEqual({critical,high,medium,low}, {low:true}) = false → guard always writes → spurious update.
  test('Defect1a: a second identical inbound severity batch is skipped (no spurious write)', async () => {
    const service = newService();

    // First inbound push: LS sends all four severity keys (effective = all enabled).
    const inboundAllSeverity: LspConfigurationParam = {
      settings: {
        [LS_GLOBAL_KEY.severityFilterCritical]: { value: true, changed: false },
        [LS_GLOBAL_KEY.severityFilterHigh]: { value: true, changed: false },
        [LS_GLOBAL_KEY.severityFilterMedium]: { value: true, changed: false },
        [LS_GLOBAL_KEY.severityFilterLow]: { value: true, changed: false },
      },
    };
    await service.persistInboundLspConfiguration(inboundAllSeverity);
    updateConfigStub.reset();

    // Second, identical inbound push → must be skipped against the merged snapshot (no-op).
    await service.persistInboundLspConfiguration(inboundAllSeverity);

    const severityWrites = updateConfigStub
      .getCalls()
      .filter(c => c.args[0] === CONFIGURATION_IDENTIFIER && c.args[1] === 'severity');

    assert.strictEqual(
      severityWrites.length,
      0,
      `Defect1a regression: a second identical inbound push must be skipped against the last-known-value ` +
        `cache. Got ${severityWrites.length} write(s). A write here means the cache held a partial object ` +
        `instead of the fully-merged value (last-writer-wins reintroduced), so the merged incoming value no ` +
        `longer equals the cached value and the guard never skips.`,
    );
  });

  // Defect 1b: same for issueViewOptions (two LS keys → one vscodeKey).
  test('Defect1b: a second identical inbound issueViewOptions batch is skipped', async () => {
    const service = newService();

    const inboundIssueView: LspConfigurationParam = {
      settings: {
        [LS_GLOBAL_KEY.issueViewOpenIssues]: { value: true, changed: false },
        [LS_GLOBAL_KEY.issueViewIgnoredIssues]: { value: true, changed: false },
      },
    };
    await service.persistInboundLspConfiguration(inboundIssueView);
    updateConfigStub.reset();

    // Second, identical inbound push → must be skipped.
    await service.persistInboundLspConfiguration(inboundIssueView);

    const issueViewWrites = updateConfigStub
      .getCalls()
      .filter(c => c.args[0] === CONFIGURATION_IDENTIFIER && c.args[1] === 'issueViewOptions');

    assert.strictEqual(
      issueViewWrites.length,
      0,
      `Defect1b regression: a second identical inbound push must be skipped against the last-known-value ` +
        `cache. Got ${issueViewWrites.length} write(s). A write here means the cache held a partial ` +
        `{ignoredIssues:true} instead of the fully-merged issueView value, so ` +
        `isEqual({openIssues,ignoredIssues}, {ignoredIssues}) is false and the guard never skips.`,
    );
  });
});

// ── Defect 2: the last-known-value cache must be invalidated on global reset ──
//
// After a global reset echo ({value:null, changed:true}), applyGlobalResets clears the
// VS Code override, but the last-known-value cache still holds the stale pre-reset value
// unless applyVscodeKeyResets also updates it. The outbound save path never consults this
// cache at all (client-side dirty-tracking already guarantees every payload key is a
// genuine change), so this test proves the outbound save is unaffected either way — it's
// the inbound leg's own cache-invalidation that this test guards.
//
// Fix: applyVscodeKeyResets must set the last-known-value cache to undefined for the
// vscodeKey on a successful reset write.

suite('ConfigurationPersistenceService — snapshot invalidated on reset (Defect 2)', () => {
  let updateConfigStub: sinon.SinonStub;
  let workspace: IVSCodeWorkspace;
  let realScopeService: ScopeDetectionService;

  setup(() => {
    updateConfigStub = sinon.stub().resolves();
    // Real VS Code reflects a write back through inspectConfiguration's globalValue: a
    // reset (value === undefined) clears it, any other write sets it. applyVscodeKeyResets
    // now gates its reset write on "does an override exist to clear" [IDE-2264], so this
    // fixture must be stateful (not a static "always undefined" stub) for the reset in step 2
    // to actually happen and invalidate the stale effective snapshot.
    const globalOverrides = new Map<string, unknown>();
    workspace = {
      // Records calls for the test's own assertions via updateConfigStub, but the store
      // mutation lives in this wrapper so it survives the test's updateConfigStub.reset()
      // calls (reset() also clears configured behaviour, not just call history).
      updateConfiguration: (configId: string, section: string, value: unknown) => {
        updateConfigStub(configId, section, value);
        const key = `${configId}.${section}`;
        if (value === undefined) {
          globalOverrides.delete(key);
        } else {
          globalOverrides.set(key, value);
        }
        return Promise.resolve();
      },
      getConfiguration: sinon.stub().returns(undefined),
      getWorkspaceFolders: sinon.stub().returns([]),
      getWorkspaceFolderPaths: sinon.stub().returns([]),
      inspectConfiguration: sinon.stub().callsFake((configId: string, section: string) => {
        const key = `${configId}.${section}`;
        if (configId === CONFIGURATION_IDENTIFIER && section === 'allIssuesVsNetNewIssues') {
          return {
            defaultValue: ALLISSUES,
            globalValue: globalOverrides.get(key),
            workspaceValue: undefined,
            workspaceFolderValue: undefined,
          };
        }
        return {
          defaultValue: undefined,
          globalValue: globalOverrides.get(key),
          workspaceValue: undefined,
          workspaceFolderValue: undefined,
        };
      }),
    } as unknown as IVSCodeWorkspace;

    realScopeService = new ScopeDetectionService(workspace);
  });

  teardown(() => sinon.restore());

  function newService(): ConfigurationPersistenceService {
    return new ConfigurationPersistenceService(
      workspace,
      {
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
        getOssQuickFixCodeActionsEnabled: sinon.stub().returns(true),
        getAdditionalCliParameters: sinon.stub().returns(''),
        getSecureAtInceptionExecutionFrequency: sinon.stub().returns('Manual'),
        getAutoConfigureMcpServer: sinon.stub().returns(false),
        severityFilter: {},
        issueViewOptions: {},
        riskScoreThreshold: 0,
        getTrustedFolders: sinon.stub().returns([]),
        getCliPath: sinon.stub().resolves(''),
        isAutomaticDependencyManagementEnabled: sinon.stub().returns(true),
        getCliBaseDownloadUrl: sinon.stub().returns(''),
      } as unknown as IConfiguration,
      realScopeService,
      {
        getLanguageClient: sinon.stub().returns({ sendNotification: sinon.stub().resolves() }),
      } as unknown as ILanguageClientAdapter,
      { info: sinon.stub(), debug: sinon.stub(), error: sinon.stub(), warn: sinon.stub() } as unknown as ILog,
    );
  }

  // Defect 2: stale effective snapshot must be cleared on reset so save is not dropped.
  //
  // Scenario: LS sends scanNetNew=ALLISSUES (effective = 'All issues'), then resets it
  // (value:null, changed:true). User saves ALLISSUES. Must NOT be skipped (the reset
  // cleared the override; the user is explicitly setting the value again).
  test('Defect2: post-reset save of value matching stale effective is NOT skipped', async () => {
    const service = newService();

    // Step 1: LS delivers effective value ALLISSUES.
    await service.persistInboundLspConfiguration({
      settings: {
        [LS_GLOBAL_KEY.scanNetNew]: { value: false, changed: true }, // false → ALLISSUES in VS Code
      },
    });
    updateConfigStub.reset();

    // Step 2: LS sends reset for scanNetNew ({value:null, changed:true}).
    // This clears the VS Code override. The stale effective should also be purged.
    await service.persistInboundLspConfiguration({
      settings: {
        [LS_GLOBAL_KEY.scanNetNew]: { value: null, changed: true },
      },
    });
    updateConfigStub.reset();

    // Step 3: User explicitly saves ALLISSUES.
    // The post-reset state has no globalValue (override cleared). Scope = 'default'.
    // Because stale effective was purged → falls back to UNKNOWN → not skipped → writes.
    // A skip here would mean the stale effective (ALLISSUES) was left in the snapshot.
    const configJson = JSON.stringify({
      isFallbackForm: false,
      token: 'tok',
      [LS_GLOBAL_KEY.scanNetNew]: false, // false → ALLISSUES
    });
    await service.handleSaveConfig(configJson);

    const deltaWrites = updateConfigStub
      .getCalls()
      .filter(c => c.args[0] === CONFIGURATION_IDENTIFIER && c.args[1] === 'allIssuesVsNetNewIssues');

    assert.ok(
      deltaWrites.length > 0,
      `Defect2: updateConfiguration for allIssuesVsNetNewIssues must be called after a reset ` +
        `when user saves the same value as the pre-reset effective. ` +
        `Got ${deltaWrites.length} write(s). ` +
        `The outbound save path never consults the last-known-value cache, so a skip here would mean ` +
        `a regression elsewhere in applyOutboundSettingsMap re-introduced a redundancy gate.`,
    );
  });
});

// ── STEP 3: mapConfigToSettings — broadened null guard ──────────────────────
//
// GLOBAL_RESET_FIELDS-only guard (pre-fix): null values for non-resettable keys
// passed through to toVscodeValue, producing wrong VS Code writes.  Example:
//   proxy_insecure: null  →  toVscodeValue(!null) = true  →  writes http.proxyStrictSSL=true
//
// The fix broadens the guard: skip ALL null values regardless of GLOBAL_RESET_FIELDS
// membership, matching the inbound mapLspSettingsToVscodeSettings null-skip.
//
// The webview does not currently send null for non-reset fields, so this is latent.
// No existing test or flow relies on a null non-reset field being written through
// toVscodeValue — confirmed by inspection of all SETTINGS_REGISTRY resolvers and
// the test suite.
suite('mapConfigToSettings — broadened null guard (STEP 3)', () => {
  // proxy_insecure is NOT in GLOBAL_RESET_FIELDS.  Its toVscodeValue is `v => !v`.
  // Before the fix: null → !null = true → http.proxyStrictSSL=true (wrong).
  // After the fix:  null is skipped entirely — no key written.
  test('null value for a non-resettable key with toVscodeValue (proxy_insecure) is NOT written', () => {
    const result = mapConfigToSettings({ proxy_insecure: null, isFallbackForm: false });
    assert.strictEqual(
      'http.proxyStrictSSL' in result,
      false,
      'proxy_insecure: null must not produce http.proxyStrictSSL=true via toVscodeValue(!null)',
    );
  });

  // Positive control: a real (non-null) value for proxy_insecure must still be written
  // through toVscodeValue correctly (true → !true = false → strictSSL=false means insecure).
  test('non-null value for proxy_insecure is still written through toVscodeValue', () => {
    const result = mapConfigToSettings({ proxy_insecure: true, isFallbackForm: false });
    assert.strictEqual(
      result['http.proxyStrictSSL'],
      false,
      'proxy_insecure: true must write http.proxyStrictSSL=false via toVscodeValue',
    );
  });

  // Null value for a reset field (organization) is still excluded via the reset path,
  // not written — same behaviour as before (reset path handles it).
  test('null value for a GLOBAL_RESET_FIELDS key (organization) is not written by mapConfigToSettings', () => {
    const result = mapConfigToSettings({ organization: null, isFallbackForm: false });
    assert.strictEqual(
      'snyk.advanced.organization' in result,
      false,
      'organization: null (a reset field) must not appear in mapConfigToSettings output',
    );
  });
});

// ── Fix 2: undefined value must be treated as reset for GLOBAL_RESET_FIELDS keys ─
//
// The LS may encode a reset as { changed: true } with the `value` field OMITTED,
// producing { value: undefined, changed: true } when the field is missing.  The old
// isGlobalReset guard used `value === null` (strict), which missed this case.
//
// The fix broadens the guard to `value == null` (loose — matches null OR undefined)
// while preserving the GLOBAL_RESET_FIELDS allowlist gate.
//
// Non-resettable keys with { value: undefined, changed: true } must NOT trigger
// a reset (the GLOBAL_RESET_FIELDS guard is unchanged).
suite('ConfigurationPersistenceService — Fix 2: undefined value treated as reset for GLOBAL_RESET_FIELDS', () => {
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
      getConfiguration: sinon.stub().returns(undefined),
      getWorkspaceFolders: sinon.stub().returns([]),
      getWorkspaceFolderPaths: sinon.stub().returns([]),
      inspectConfiguration: sinon.stub().returns({ globalValue: undefined, defaultValue: undefined }),
    } as unknown as IVSCodeWorkspace;

    configuration = {
      getToken: sinon.stub().resolves('tok'),
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
      getLanguageClient: sinon.stub().returns({ sendNotification: sinon.stub().resolves() }),
    } as unknown as ILanguageClientAdapter;

    logger = {
      info: sinon.stub(),
      debug: sinon.stub(),
      error: sinon.stub(),
      warn: sinon.stub(),
    } as unknown as ILog;
  });

  teardown(() => sinon.restore());

  // LS sends { changed: true } with value field absent → JS produces { value: undefined }.
  // For a GLOBAL_RESET_FIELDS key this must trigger the reset path (clear VS Code override).
  test('inbound {value:undefined, changed:true} for a GLOBAL_RESET_FIELDS key (organization) triggers reset', async () => {
    const service = new ConfigurationPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      clientAdapter,
      logger,
    );

    const param: LspConfigurationParam = {
      settings: {
        // Simulate a missing value field: { changed: true } with no value key.
        [LS_GLOBAL_KEY.organization]: { value: undefined as unknown as null, changed: true },
      },
    };

    await service.persistInboundLspConfiguration(param);

    // The reset path must have been triggered: updateConfiguration called with undefined value.
    sinon.assert.calledWith(
      updateConfigurationStub,
      CONFIGURATION_IDENTIFIER,
      'advanced.organization',
      undefined,
      true,
    );
  });

  // A non-resettable key with { value: undefined, changed: true } must NOT trigger a reset.
  // The GLOBAL_RESET_FIELDS allowlist gate must remain intact regardless of the null broadening.
  test('inbound {value:undefined, changed:true} for a non-GLOBAL_RESET_FIELDS key (api_endpoint) does NOT trigger reset', async () => {
    const service = new ConfigurationPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      clientAdapter,
      logger,
    );

    const param: LspConfigurationParam = {
      settings: {
        [LS_KEY.apiEndpoint]: { value: undefined as unknown as null, changed: true },
      },
    };

    await service.persistInboundLspConfiguration(param);

    // Must NOT have cleared api_endpoint — not a resettable key.
    const clearedEndpoint = updateConfigurationStub
      .getCalls()
      .some(c => c.args[1] === 'advanced.customEndpoint' && c.args[2] === undefined);
    assert.strictEqual(
      clearedEndpoint,
      false,
      'api_endpoint is not in GLOBAL_RESET_FIELDS; {value:undefined, changed:true} must not clear it',
    );
  });
});

// ── Fix: a per-key recording exception must not skip remaining fan-out siblings ─
//
// applyOutboundGlobalResets iterates lsKeys for a shared vscodeKey and records a reset in
// the explicit-overrides map for each one. If recording throws for lsKey[0], that must not
// prevent lsKey[1..N] from being recorded — each is wrapped in its own per-key try/catch.
suite('ConfigurationPersistenceService — per-key recording exception resilience', () => {
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
      getConfiguration: sinon.stub().returns(undefined),
      getWorkspaceFolders: sinon.stub().returns([]),
      getWorkspaceFolderPaths: sinon.stub().returns([]),
      inspectConfiguration: sinon.stub().returns({ globalValue: undefined, defaultValue: undefined }),
    } as unknown as IVSCodeWorkspace;

    configuration = {
      getToken: sinon.stub().resolves('tok'),
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
      getLanguageClient: sinon.stub().returns({ sendNotification: sinon.stub().resolves() }),
    } as unknown as ILanguageClientAdapter;

    logger = {
      info: sinon.stub(),
      debug: sinon.stub(),
      error: sinon.stub(),
      warn: sinon.stub(),
    } as unknown as ILog;
  });

  teardown(() => sinon.restore());

  // All four severity_filter_* keys share the same vscodeKey (a fan-out group).
  // If recording a reset throws for severity_filter_critical (the first key processed),
  // the remaining three siblings must still be recorded.
  test('a recording exception for the first fan-out sibling does not skip the remaining siblings', async () => {
    const setResetCalls: string[] = [];
    const explicitOverridesMap: IExplicitOverridesMap = {
      setExplicitValue: sinon.spy(),
      setReset: (lsKey: string) => {
        setResetCalls.push(lsKey);
        if (lsKey === LS_GLOBAL_KEY.severityFilterCritical) {
          throw new Error('simulated recording failure');
        }
      },
      getEntry: sinon.stub().returns(undefined),
      confirmResetDelivered: sinon.spy(),
    };

    const service = new ConfigurationPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      clientAdapter,
      logger,
      undefined, // contextService — not needed for this test
      undefined,
      explicitOverridesMap,
    );

    // Send all four severity keys as null → outbound reset for the fan-out group.
    const config = JSON.stringify({
      isFallbackForm: false,
      [LS_GLOBAL_KEY.severityFilterCritical]: null,
      [LS_GLOBAL_KEY.severityFilterHigh]: null,
      [LS_GLOBAL_KEY.severityFilterMedium]: null,
      [LS_GLOBAL_KEY.severityFilterLow]: null,
    });

    await service.handleSaveConfig(config);

    // All four siblings must have been attempted — the throw for severity_filter_critical
    // must not prevent the other three from being recorded.
    assert.strictEqual(
      setResetCalls.length,
      4,
      `Expected setReset to be attempted 4 times (once per severity sibling) but got ${setResetCalls.length}. ` +
        'A recording exception for severity_filter_critical must not skip the remaining siblings.',
    );
    for (const lsKey of [
      LS_GLOBAL_KEY.severityFilterHigh,
      LS_GLOBAL_KEY.severityFilterMedium,
      LS_GLOBAL_KEY.severityFilterLow,
    ]) {
      assert.ok(setResetCalls.includes(lsKey), `${lsKey} must have been recorded despite the sibling's throw`);
    }
  });
});
