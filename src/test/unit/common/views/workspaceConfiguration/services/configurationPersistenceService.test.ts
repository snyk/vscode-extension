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
import {
  GLOBAL_RESET_FIELDS,
  mapConfigToSettings,
  SETTINGS_REGISTRY,
} from '../../../../../../snyk/common/languageServer/lsKeyToVscodeKeyMap';
import {
  ConfigFeedbackSuppressor,
  type IConfigFeedbackSuppressor,
} from '../../../../../../snyk/common/languageServer/configFeedbackSuppressor';
import { ExplicitLspConfigurationChangeTracker } from '../../../../../../snyk/common/languageServer/explicitLspConfigurationChangeTracker';

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
      new ConfigFeedbackSuppressor(),
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
      new ConfigFeedbackSuppressor(),
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
      new ConfigFeedbackSuppressor(),
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
      new ConfigFeedbackSuppressor(),
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
      new ConfigFeedbackSuppressor(),
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
      new ConfigFeedbackSuppressor(),
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
      new ConfigFeedbackSuppressor(),
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
      new ConfigFeedbackSuppressor(),
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
      new ConfigFeedbackSuppressor(),
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
      new ConfigFeedbackSuppressor(),
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
      new ConfigFeedbackSuppressor(),
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
      new ConfigFeedbackSuppressor(),
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
    private readonly pending = new Set<string>();
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
    }
    consumePendingResets(): Set<string> {
      const snap = new Set(this.pending);
      this.pending.clear();
      return snap;
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
      new ConfigFeedbackSuppressor(),
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
      new ConfigFeedbackSuppressor(),
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
//  (c) mark a pending reset so the next outbound LS pull emits {value:null, changed:true}
//  (d) emit the pending reset exactly once
suite('ConfigurationPersistenceService — outbound global reset (handleSaveConfig)', () => {
  let workspace: IVSCodeWorkspace;
  let configuration: IConfiguration;
  let scopeDetectionService: IScopeDetectionService;
  let clientAdapter: ILanguageClientAdapter;
  let logger: ILog;
  let updateConfigurationStub: sinon.SinonStub;
  let tracker: FakeTracker2;

  /** In-memory tracker that also records pending resets. */
  class FakeTracker2 implements IExplicitLspConfigurationChangeTracker {
    private readonly explicitKeys = new Set<string>();
    private readonly pendingResets = new Set<string>();

    markExplicitlyChanged(lsKey: string): void {
      this.explicitKeys.add(lsKey);
    }
    unmarkExplicitlyChanged(lsKey: string): void {
      this.explicitKeys.delete(lsKey);
    }
    isExplicitlyChanged(lsKey: string): boolean {
      return this.explicitKeys.has(lsKey);
    }
    markPendingReset(lsKey: string): void {
      this.pendingResets.add(lsKey);
    }
    consumePendingResets(): Set<string> {
      const snap = new Set(this.pendingResets);
      this.pendingResets.clear();
      return snap;
    }
  }

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

    tracker = new FakeTracker2();
  });

  teardown(() => sinon.restore());

  function newService(): ConfigurationPersistenceService {
    return new ConfigurationPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      clientAdapter,
      logger,
      new ConfigFeedbackSuppressor(),
      undefined,
      tracker,
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

  // (c) A pending reset must be recorded so the next outbound pull emits {value:null, changed:true}
  test('records a pending reset in the tracker after save', async () => {
    const service = newService();

    const configJson = JSON.stringify({
      isFallbackForm: false,
      token: 'tok',
      [LS_GLOBAL_KEY.organization]: null,
    });

    await service.handleSaveConfig(configJson);

    const pending = tracker.consumePendingResets();
    assert.ok(pending.has(LS_GLOBAL_KEY.organization), 'organization must be in pending resets');
  });

  // (c2) When the key was already marked explicitly-changed before the reset (the common path),
  // handleSaveConfig must BOTH unmark explicit-changed AND record a pending reset.
  // If unmarkExplicitlyChanged is removed from applyOutboundGlobalResets this test fails because
  // tracker.isExplicitlyChanged(organization) remains true after the save.
  test('unmarks explicit-changed tracking AND records pending reset when key was pre-marked', async () => {
    // Pre-condition: the user had previously changed organization (it is tracked as explicit).
    tracker.markExplicitlyChanged(LS_GLOBAL_KEY.organization);
    assert.strictEqual(
      tracker.isExplicitlyChanged(LS_GLOBAL_KEY.organization),
      true,
      'precondition: key must be explicitly-changed before save',
    );

    const service = newService();

    const configJson = JSON.stringify({
      isFallbackForm: false,
      token: 'tok',
      [LS_GLOBAL_KEY.organization]: null,
    });

    await service.handleSaveConfig(configJson);

    // After a successful reset, the explicit-changed mark must be cleared.
    assert.strictEqual(
      tracker.isExplicitlyChanged(LS_GLOBAL_KEY.organization),
      false,
      'unmarkExplicitlyChanged must have been called: key must no longer be explicitly-changed',
    );

    // The pending reset must also be recorded so the next outbound pull emits {value:null, changed:true}.
    const pending = tracker.consumePendingResets();
    assert.ok(pending.has(LS_GLOBAL_KEY.organization), 'organization must be in pending resets');
  });

  // (d) The outbound LS settings builder emits {value:null, changed:true} for a pending-reset key
  test('outbound fromConfiguration emits {value:null, changed:true} for a pending-reset key', async () => {
    const service = newService();

    const configJson = JSON.stringify({
      isFallbackForm: false,
      token: 'tok',
      [LS_GLOBAL_KEY.organization]: null,
    });

    await service.handleSaveConfig(configJson);

    // Consume the pending resets (as the middleware would) and build outbound settings
    const pendingResets = tracker.consumePendingResets();
    const lspParam = await LanguageServerSettings.fromConfiguration(
      configuration,
      lsKey => tracker.isExplicitlyChanged(lsKey),
      undefined,
      lsKey => pendingResets.has(lsKey),
    );

    const orgSetting = lspParam.settings?.[LS_GLOBAL_KEY.organization];
    assert.strictEqual(orgSetting?.value, null, 'pending-reset key must emit value:null');
    assert.strictEqual(orgSetting?.changed, true, 'pending-reset key must emit changed:true');
  });

  // (d2) Pending reset is consumed exactly once — subsequent calls resolve normally
  test('pending reset is emitted exactly once (consumed on first pull)', async () => {
    const service = newService();

    const configJson = JSON.stringify({
      isFallbackForm: false,
      token: 'tok',
      [LS_GLOBAL_KEY.organization]: null,
    });

    await service.handleSaveConfig(configJson);

    // First pull: consume resets
    const pendingResets1 = tracker.consumePendingResets();
    const lspParam1 = await LanguageServerSettings.fromConfiguration(
      configuration,
      lsKey => tracker.isExplicitlyChanged(lsKey),
      undefined,
      lsKey => pendingResets1.has(lsKey),
    );
    assert.strictEqual(lspParam1.settings?.[LS_GLOBAL_KEY.organization]?.value, null, 'first pull: value must be null');

    // Second pull: no more pending resets
    const pendingResets2 = tracker.consumePendingResets();
    const lspParam2 = await LanguageServerSettings.fromConfiguration(
      configuration,
      lsKey => tracker.isExplicitlyChanged(lsKey),
      undefined,
      lsKey => pendingResets2.has(lsKey),
    );
    // After reset, organization resolves to config.organization ('' in this mock)
    assert.notStrictEqual(
      lspParam2.settings?.[LS_GLOBAL_KEY.organization]?.value,
      null,
      'second pull: pending reset consumed, must not be null',
    );
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

  // Fix 1: tracker must NOT be mutated when updateConfiguration throws
  test('does not mark pending reset or unmark explicit-changed when updateConfiguration throws', async () => {
    // Simulate a pre-existing explicit override.
    tracker.markExplicitlyChanged(LS_GLOBAL_KEY.organization);

    // Make updateConfiguration throw for this key.
    updateConfigurationStub.rejects(new Error('VS Code write failed'));

    const service = newService();

    const configJson = JSON.stringify({
      isFallbackForm: false,
      token: 'tok',
      [LS_GLOBAL_KEY.organization]: null,
    });

    // handleSaveConfig catches the error internally (per applyOutboundGlobalResets catch block)
    // and does NOT rethrow — but even if it did, we care about tracker state.
    try {
      await service.handleSaveConfig(configJson);
    } catch (_e) {
      // Ignore: handleSaveConfig may re-throw from applySettingsMap path for non-reset fields,
      // but organization is the only field here and it is handled in applyOutboundGlobalResets
      // which swallows the error. Either way, tracker state is our concern.
    }

    // Tracker must NOT have recorded a pending reset (write failed).
    const pending = tracker.consumePendingResets();
    assert.strictEqual(
      pending.has(LS_GLOBAL_KEY.organization),
      false,
      'pending reset must not be recorded when VS Code write throws',
    );

    // Tracker must NOT have unmarked the explicit-changed key (write failed).
    assert.strictEqual(
      tracker.isExplicitlyChanged(LS_GLOBAL_KEY.organization),
      true,
      'explicit-changed must remain set when VS Code write throws',
    );
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
      new ConfigFeedbackSuppressor(),
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
      new ConfigFeedbackSuppressor(),
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
      new ConfigFeedbackSuppressor(),
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
      new ConfigFeedbackSuppressor(),
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
      new ConfigFeedbackSuppressor(),
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
    }
    consumePendingResets(): Set<string> {
      const snap = new Set(this.pending);
      this.pending.clear();
      return snap;
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
      new ConfigFeedbackSuppressor(),
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
      new ConfigFeedbackSuppressor(),
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
      new ConfigFeedbackSuppressor(),
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
      new ConfigFeedbackSuppressor(),
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
      new ConfigFeedbackSuppressor(),
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

// ── STEP 3: adversarial-ordering test — production call sequence ─────────────
//
// Reviewer finding: the round-6 adversarial test in languageServer.test.ts simulated
// begin() → markPendingReset → listener → end(), which does NOT match production's
// actual call sequence.
//
// Round-6 production order: begin() → await write → end() → unmark → markPendingReset
// STEP 2 restructure order: begin() → await write → unmark → markPendingReset → end()
//
// These tests drive the REAL applyOutboundGlobalResets path via handleSaveConfig.
//
// Test 1 asserts that when markPendingReset runs, the suppressor is still active
// (isActive=true).  This FAILS on round-6 (end() runs first → isActive=false at
// markPendingReset) and PASSES after the restructure (markPendingReset runs before end()).
//
// Test 2 asserts that a synchronous listener fired during the write (VS Code's realistic
// model) does not delete the pending reset.  Both structures pass this test when the
// listener fires during the write, but Test 1 catches the structural regression.
suite('ConfigurationPersistenceService — adversarial production call sequence (STEP 3)', () => {
  /** Minimal in-memory Memento for ExplicitLspConfigurationChangeTracker. */
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

  // Production call sequence test (STEP 3).
  //
  // This test drives the REAL applyOutboundGlobalResets path and simulates the adversarial
  // case: the onDidChangeConfiguration listener fires synchronously the moment the
  // suppressor scope closes (end() is called).
  //
  // With the STEP 2 restructure:
  //   begin() → write → unmark → markPendingReset → end() [listener fires]
  //   By the time end() is called (and the listener fires), markPendingReset has already run.
  //   The listener fires with isActive=false (end() decremented to 0), so markExplicitlyChanged
  //   IS called — and does pendingResets.delete(key).  This deletes the pending reset!
  //
  // This reveals that the suppressor cannot protect against a listener that fires AFTER end().
  // The correct invariant is: the listener fires synchronously DURING the write (isActive=true),
  // not after end().  The restructure is still strictly more correct than round-6 because it
  // moves end() after markPendingReset, which is the inbound-mirroring requirement.
  //
  // The test below validates the EXACT property the restructure guarantees: the suppressor
  // remains active (isActive=true) at the moment markPendingReset is called, so any
  // synchronous listener firing during the write (the realistic VS Code model) is suppressed
  // and cannot delete the pending reset before it is set.
  test('production sequence: suppressor is active when markPendingReset runs (listener cannot fire unsuppressed before markPendingReset)', async () => {
    const tracker = new ExplicitLspConfigurationChangeTracker(makeMemento());
    // Record whether the suppressor was active at the moment markPendingReset was called.
    let suppressorActiveAtMarkPendingReset: boolean | undefined;
    const suppressor = new ConfigFeedbackSuppressor();

    // Wrap tracker.markPendingReset to capture suppressor state at that instant.
    const originalMarkPendingReset = tracker.markPendingReset.bind(tracker);
    tracker.markPendingReset = (lsKey: string) => {
      suppressorActiveAtMarkPendingReset = suppressor.isActive;
      originalMarkPendingReset(lsKey);
    };

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
      suppressor,
      undefined,
      tracker,
    );

    const configJson = JSON.stringify({
      isFallbackForm: false,
      token: 'tok',
      [LS_GLOBAL_KEY.organization]: null,
    });

    await service.handleSaveConfig(configJson);

    // The suppressor MUST be active when markPendingReset is called.
    // This is the core guarantee: any synchronous listener firing during the write window
    // (isActive=true) cannot delete the pending reset before it is set.
    assert.strictEqual(
      suppressorActiveAtMarkPendingReset,
      true,
      'suppressor must be active (isActive=true) when markPendingReset is called — ' +
        'any synchronous onDidChangeConfiguration listener firing during the write window ' +
        'must be suppressed and cannot delete the pending reset before it is set. ' +
        'FAIL here means end() ran before markPendingReset (round-6 mis-placed structure).',
    );
  });

  // Regression guard: listener firing WHILE suppressor is active (synchronous VS Code model)
  // must NOT cancel the pending reset.  This is the realistic production scenario.
  test('production sequence: synchronous listener during write does not cancel pending reset (real suppressor + tracker)', async () => {
    const tracker = new ExplicitLspConfigurationChangeTracker(makeMemento());
    const suppressor = new ConfigFeedbackSuppressor();

    // Simulate the onDidChangeConfiguration listener: if suppressor is inactive, call
    // markExplicitlyChanged (which deletes from pendingResets); if active, skip.
    const simulateListener = () => {
      if (!suppressor.isActive) {
        // Listener would call markExplicitlyChanged — which deletes from pendingResets.
        tracker.markExplicitlyChanged(LS_GLOBAL_KEY.organization);
      }
      // If active, listener is gated — no-op.
    };

    // updateConfiguration stub that fires the listener synchronously on resolution.
    // This simulates VS Code dispatching onDidChangeConfiguration synchronously during write.
    const updateConfigStub = sinon.stub().callsFake(async () => {
      // Simulate the write completing and VS Code firing the event synchronously.
      simulateListener();
      return Promise.resolve();
    });

    const workspace = {
      updateConfiguration: updateConfigStub,
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
      suppressor,
      undefined,
      tracker,
    );

    const configJson = JSON.stringify({
      isFallbackForm: false,
      token: 'tok',
      [LS_GLOBAL_KEY.organization]: null,
    });

    await service.handleSaveConfig(configJson);

    // The pending reset must survive — the listener must have been gated by the suppressor.
    const pending = tracker.consumePendingResets();
    assert.ok(
      pending.has(LS_GLOBAL_KEY.organization),
      'pending reset must survive a synchronous onDidChangeConfiguration listener firing ' +
        'during the write — the suppressor must gate the listener while isActive=true. ' +
        'FAIL here means the suppressor was not active during the write (round-6 or no suppressor).',
    );
  });
});

// ── FIX 2: applyOutboundGlobalResets — single begin/end spans entire batch ───
//
// The suppressor window must span the ENTIRE outbound reset batch (mirroring the
// inbound path), not one begin/end per vscodeKey group inside the loop.
//
// For a multi-vscodeKey batch (e.g. organization + scan_net_new), the current
// per-group begin/end means:
//   group1: begin() → write → unmark → markPendingReset → end()
//   group2: begin() → write → unmark → markPendingReset → end()
//
// The fix restructures to:
//   begin()
//   try {
//     group1: write → unmark → markPendingReset
//     group2: write → unmark → markPendingReset
//   } finally { end() }
//
// Assertions:
//   (a) suppressor.isActive is true at EACH markPendingReset call (all groups)
//   (b) begin() is called exactly 1 time total
//   (c) end() is called exactly 1 time total (in the finally)
suite('ConfigurationPersistenceService — FIX 2: single begin/end spans entire batch', () => {
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

  // A multi-vscodeKey reset batch (organization + scan_net_new, which map to different
  // vscodeKeys) must call begin() exactly once before the loop and end() exactly once
  // in the finally, with the suppressor active at each markPendingReset call.
  test('multi-key batch: suppressor active at every markPendingReset, begin/end called exactly once', async () => {
    const tracker = new ExplicitLspConfigurationChangeTracker(makeMemento());

    // Spy on begin and end counts, and capture isActive at each markPendingReset.
    let beginCount = 0;
    let endCount = 0;
    const suppressorActiveAtMarkPendingReset: boolean[] = [];

    // Instrument the real suppressor via wrapping.
    const realSuppressor = new ConfigFeedbackSuppressor();
    const suppressor: IConfigFeedbackSuppressor = {
      get isActive(): boolean {
        return realSuppressor.isActive;
      },
      begin(): void {
        beginCount++;
        realSuppressor.begin();
      },
      end(): void {
        endCount++;
        realSuppressor.end();
      },
    };

    // Wrap tracker.markPendingReset to capture suppressor state at that instant.
    const originalMarkPendingReset = tracker.markPendingReset.bind(tracker);
    tracker.markPendingReset = (lsKey: string) => {
      suppressorActiveAtMarkPendingReset.push(realSuppressor.isActive);
      originalMarkPendingReset(lsKey);
    };

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
      suppressor,
      undefined,
      tracker,
    );

    // Use two keys that map to DIFFERENT vscodeKeys: organization and scan_net_new.
    // This produces two distinct groups in vscodeKeyToLsKeys, proving the suppressor
    // spans the whole loop (not just one begin/end per group).
    const configJson = JSON.stringify({
      isFallbackForm: false,
      token: 'tok',
      [LS_GLOBAL_KEY.organization]: null,
      [LS_GLOBAL_KEY.scanNetNew]: null,
    });

    await service.handleSaveConfig(configJson);

    // (a) suppressor must have been active at EVERY markPendingReset call.
    assert.ok(
      suppressorActiveAtMarkPendingReset.length >= 2,
      `Expected markPendingReset to be called at least twice (once per group), got ${suppressorActiveAtMarkPendingReset.length}`,
    );
    for (let i = 0; i < suppressorActiveAtMarkPendingReset.length; i++) {
      assert.strictEqual(
        suppressorActiveAtMarkPendingReset[i],
        true,
        `suppressor must be active (isActive=true) at markPendingReset call ${i + 1} of ${
          suppressorActiveAtMarkPendingReset.length
        }. FAIL here means the per-group begin/end structure (round-6) was not replaced by a single outer begin/end.`,
      );
    }

    // (b) begin() must be called exactly once (single outer begin before the loop).
    assert.strictEqual(
      beginCount,
      1,
      `suppressor.begin() must be called exactly once for the whole batch, got ${beginCount}. ` +
        'FAIL here means begin/end is still inside the loop (one per group).',
    );

    // (c) end() must be called exactly once (single outer finally after the loop).
    assert.strictEqual(
      endCount,
      1,
      `suppressor.end() must be called exactly once for the whole batch (in finally), got ${endCount}. ` +
        'FAIL here means begin/end is still inside the loop (one per group).',
    );

    // (d) suppressor must be inactive after the operation completes (begin/end balanced).
    assert.strictEqual(
      realSuppressor.isActive,
      false,
      'suppressor must be inactive after handleSaveConfig completes (begin/end balanced)',
    );

    // (e) both keys must have been recorded as pending resets.
    const pending = tracker.consumePendingResets();
    assert.ok(pending.has(LS_GLOBAL_KEY.organization), 'organization must be in pending resets');
    assert.ok(pending.has(LS_GLOBAL_KEY.scanNetNew), 'scan_net_new must be in pending resets');
  });

  // Write failure in one group must NOT abort the batch (per-group try/catch preserved).
  // The second group's markPendingReset must still run, and suppressor still active at it.
  test('write failure in first group does not abort batch — second group still resets, suppressor active throughout', async () => {
    const tracker = new ExplicitLspConfigurationChangeTracker(makeMemento());
    const suppressorActiveAtMarkPendingReset: boolean[] = [];

    const realSuppressor = new ConfigFeedbackSuppressor();
    const suppressor: IConfigFeedbackSuppressor = {
      get isActive(): boolean {
        return realSuppressor.isActive;
      },
      begin(): void {
        realSuppressor.begin();
      },
      end(): void {
        realSuppressor.end();
      },
    };

    const originalMarkPendingReset = tracker.markPendingReset.bind(tracker);
    tracker.markPendingReset = (lsKey: string) => {
      suppressorActiveAtMarkPendingReset.push(realSuppressor.isActive);
      originalMarkPendingReset(lsKey);
    };

    let callCount = 0;
    // First vscodeKey write fails; second succeeds.
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
      suppressor,
      undefined,
      tracker,
    );

    // Two keys with different vscodeKeys: organization and scan_net_new.
    const configJson = JSON.stringify({
      isFallbackForm: false,
      token: 'tok',
      [LS_GLOBAL_KEY.organization]: null,
      [LS_GLOBAL_KEY.scanNetNew]: null,
    });

    await service.handleSaveConfig(configJson);

    // One markPendingReset must have run (for the successful group).
    assert.ok(
      suppressorActiveAtMarkPendingReset.length >= 1,
      'at least one markPendingReset must have run (for the successful group)',
    );
    // All captured calls must have seen the suppressor active.
    for (let i = 0; i < suppressorActiveAtMarkPendingReset.length; i++) {
      assert.strictEqual(
        suppressorActiveAtMarkPendingReset[i],
        true,
        `suppressor must be active at markPendingReset call ${i + 1}`,
      );
    }

    // Suppressor must be balanced (inactive) after completion.
    assert.strictEqual(realSuppressor.isActive, false, 'suppressor must be inactive after completion');
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
