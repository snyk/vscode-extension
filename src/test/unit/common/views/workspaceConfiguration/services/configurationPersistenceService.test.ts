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
import {
  LS_GLOBAL_KEY,
  LS_KEY,
} from '../../../../../../snyk/common/languageServer/serverSettingsToLspConfigurationParam';
import type { LspConfigurationParam } from '../../../../../../snyk/common/languageServer/types';
import { IExplicitLspConfigurationChangeTracker } from '../../../../../../snyk/common/languageServer/explicitLspConfigurationChangeTracker';
import { LanguageServerSettings } from '../../../../../../snyk/common/languageServer/settings';

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
    markExplicitlyChanged(lsKey: string): void {
      this.keys.add(lsKey);
    }
    unmarkExplicitlyChanged(lsKey: string): void {
      this.keys.delete(lsKey);
    }
    isExplicitlyChanged(lsKey: string): boolean {
      return this.keys.has(lsKey);
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
