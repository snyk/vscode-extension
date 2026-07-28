import assert from 'assert';
import sinon from 'sinon';
import { migrateCodeEnablementForExistingInstall } from '../../../../snyk/common/languageServer/codeEnablementMigration';
import { ExtensionContext } from '../../../../snyk/common/vscode/extensionContext';
import { IVSCodeWorkspace } from '../../../../snyk/common/vscode/workspace';
import {
  MEMENTO_ANALYTICS_PLUGIN_INSTALLED_SENT,
  MEMENTO_CLI_VERSION,
  MEMENTO_CODE_ENABLEMENT_MIGRATED,
  MEMENTO_LS_PROTOCOL_VERSION,
} from '../../../../snyk/common/constants/globalState';
import { LoggerMock } from '../../mocks/logger.mock';

// CODE_SECURITY_ENABLED_SETTING = 'snyk.features.codeSecurity' → configId 'snyk', section 'features.codeSecurity'
const CODE_CONFIG_ID = 'snyk';
const CODE_SECTION = 'features.codeSecurity';

suite('migrateCodeEnablementForExistingInstall', () => {
  let getGlobalStateValue: sinon.SinonStub;
  let updateGlobalStateValue: sinon.SinonStub;
  let inspectConfiguration: sinon.SinonStub;
  let updateConfiguration: sinon.SinonStub;
  let context: Pick<ExtensionContext, 'getGlobalStateValue' | 'updateGlobalStateValue'>;
  let workspace: Pick<IVSCodeWorkspace, 'inspectConfiguration' | 'updateConfiguration'>;
  let logger: LoggerMock;

  setup(() => {
    // Default stub returns undefined for every memento (fresh, un-migrated install).
    getGlobalStateValue = sinon.stub();
    updateGlobalStateValue = sinon.stub().resolves();
    inspectConfiguration = sinon.stub();
    updateConfiguration = sinon.stub().resolves();

    context = { getGlobalStateValue, updateGlobalStateValue } as unknown as ExtensionContext;
    workspace = { inspectConfiguration, updateConfiguration } as unknown as IVSCodeWorkspace;
    logger = new LoggerMock();
  });

  teardown(() => sinon.restore());

  test('materializes codeSecurity=true for an existing install with no explicit global value', async () => {
    getGlobalStateValue.withArgs(MEMENTO_LS_PROTOCOL_VERSION).returns(20); // prior install
    inspectConfiguration
      .withArgs(CODE_CONFIG_ID, CODE_SECTION)
      .returns({ globalValue: undefined, defaultValue: false });

    await migrateCodeEnablementForExistingInstall(context, workspace, logger);

    assert.ok(
      updateConfiguration.calledOnceWithExactly(CODE_CONFIG_ID, CODE_SECTION, true, true),
      'should write codeSecurity=true to global settings',
    );
    assert.ok(
      updateGlobalStateValue.calledOnceWithExactly(MEMENTO_CODE_ENABLEMENT_MIGRATED, true),
      'should record that the migration has run',
    );
  });

  test('detects a custom-cliPath / air-gapped install via the plugin-installed memento (no download mementos)', async () => {
    // Neither the protocol version nor CLI version was ever written (no managed download), but a
    // prior activation sent the plugin-installed event → this is still an existing install.
    getGlobalStateValue.withArgs(MEMENTO_LS_PROTOCOL_VERSION).returns(undefined);
    getGlobalStateValue.withArgs(MEMENTO_CLI_VERSION).returns(undefined);
    getGlobalStateValue.withArgs(MEMENTO_ANALYTICS_PLUGIN_INSTALLED_SENT).returns(true);
    inspectConfiguration
      .withArgs(CODE_CONFIG_ID, CODE_SECTION)
      .returns({ globalValue: undefined, defaultValue: false });

    await migrateCodeEnablementForExistingInstall(context, workspace, logger);

    assert.ok(
      updateConfiguration.calledOnceWithExactly(CODE_CONFIG_ID, CODE_SECTION, true, true),
      'must recognise an air-gapped existing install and preserve Code',
    );
  });

  test('does NOT seed a fresh install (no lifecycle mementos) but still records evaluation', async () => {
    // All mementos undefined via the default stub → fresh install.
    await migrateCodeEnablementForExistingInstall(context, workspace, logger);

    assert.ok(inspectConfiguration.notCalled, 'must not inspect config for a fresh install');
    assert.ok(updateConfiguration.notCalled, 'must not write codeSecurity for a fresh install');
    assert.ok(
      updateGlobalStateValue.calledOnceWithExactly(MEMENTO_CODE_ENABLEMENT_MIGRATED, true),
      'must record evaluation so a later launch does not seed the fresh install',
    );
  });

  test('is a no-op once the migration memento is set (idempotent)', async () => {
    getGlobalStateValue.withArgs(MEMENTO_CODE_ENABLEMENT_MIGRATED).returns(true);

    await migrateCodeEnablementForExistingInstall(context, workspace, logger);

    assert.ok(inspectConfiguration.notCalled, 'must not inspect config when already migrated');
    assert.ok(updateConfiguration.notCalled, 'must not write config when already migrated');
    assert.ok(updateGlobalStateValue.notCalled, 'must not re-write the memento when already migrated');
  });

  test('leaves an explicit user value untouched (globalValue defined) but records evaluation', async () => {
    getGlobalStateValue.withArgs(MEMENTO_LS_PROTOCOL_VERSION).returns(20);
    inspectConfiguration.withArgs(CODE_CONFIG_ID, CODE_SECTION).returns({ globalValue: false, defaultValue: false });

    await migrateCodeEnablementForExistingInstall(context, workspace, logger);

    assert.ok(updateConfiguration.notCalled, 'must not overwrite an explicitly persisted value');
    assert.ok(
      updateGlobalStateValue.calledOnceWithExactly(MEMENTO_CODE_ENABLEMENT_MIGRATED, true),
      'should still record that the migration has run',
    );
  });

  test('leaves an explicit true untouched (already survives via seeding)', async () => {
    getGlobalStateValue.withArgs(MEMENTO_LS_PROTOCOL_VERSION).returns(20);
    inspectConfiguration.withArgs(CODE_CONFIG_ID, CODE_SECTION).returns({ globalValue: true, defaultValue: false });

    await migrateCodeEnablementForExistingInstall(context, workspace, logger);

    assert.ok(updateConfiguration.notCalled, 'must not rewrite an already-explicit true');
  });

  test('skips (does not materialize) when inspectConfiguration returns undefined, matching the seed', async () => {
    getGlobalStateValue.withArgs(MEMENTO_LS_PROTOCOL_VERSION).returns(20);
    inspectConfiguration.withArgs(CODE_CONFIG_ID, CODE_SECTION).returns(undefined);

    await migrateCodeEnablementForExistingInstall(context, workspace, logger);

    assert.ok(updateConfiguration.notCalled, 'anomalous undefined inspect must not trigger a write');
    assert.ok(
      updateGlobalStateValue.calledOnceWithExactly(MEMENTO_CODE_ENABLEMENT_MIGRATED, true),
      'should still record evaluation',
    );
  });

  test('never throws and does NOT record the guard when the config write fails (retries next launch)', async () => {
    getGlobalStateValue.withArgs(MEMENTO_LS_PROTOCOL_VERSION).returns(20);
    inspectConfiguration
      .withArgs(CODE_CONFIG_ID, CODE_SECTION)
      .returns({ globalValue: undefined, defaultValue: false });
    updateConfiguration.rejects(new Error('config write failed'));

    await assert.doesNotReject(
      () => migrateCodeEnablementForExistingInstall(context, workspace, logger),
      'a failed migration must never propagate and abort activation',
    );

    assert.ok(
      updateGlobalStateValue.neverCalledWith(MEMENTO_CODE_ENABLEMENT_MIGRATED, true),
      'the guard must not be recorded on failure so the migration retries next launch',
    );
  });

  // Documents the one conditional edge in the fresh-install protection: if the guard write on the
  // first launch did NOT persist but the lifecycle mementos did (a store failure isolated to the
  // guard write — implausible in practice since both use the same global-state store), a later
  // launch observes the lifecycle mementos and treats the install as existing. See the docstring.
  test('conditional edge: guard unset + lifecycle mementos present is classified as existing', async () => {
    getGlobalStateValue.withArgs(MEMENTO_CODE_ENABLEMENT_MIGRATED).returns(undefined); // guard never persisted
    getGlobalStateValue.withArgs(MEMENTO_ANALYTICS_PLUGIN_INSTALLED_SENT).returns(true); // written on a prior launch
    inspectConfiguration
      .withArgs(CODE_CONFIG_ID, CODE_SECTION)
      .returns({ globalValue: undefined, defaultValue: false });

    await migrateCodeEnablementForExistingInstall(context, workspace, logger);

    assert.ok(
      updateConfiguration.calledOnceWithExactly(CODE_CONFIG_ID, CODE_SECTION, true, true),
      'with the guard unset and a lifecycle memento present, the install is treated as existing',
    );
  });
});
