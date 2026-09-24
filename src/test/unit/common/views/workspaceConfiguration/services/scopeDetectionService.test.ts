import assert from 'assert';
import sinon from 'sinon';
import { ScopeDetectionService } from '../../../../../../snyk/common/views/workspaceConfiguration/services/scopeDetectionService';
import { IVSCodeWorkspace } from '../../../../../../snyk/common/vscode/workspace';

suite('ScopeDetectionService - shouldSkipSettingUpdate', () => {
  let workspace: IVSCodeWorkspace;
  let service: ScopeDetectionService;
  let inspectStub: sinon.SinonStub;

  setup(() => {
    inspectStub = sinon.stub();
    workspace = { inspectConfiguration: inspectStub } as unknown as IVSCodeWorkspace;
    service = new ScopeDetectionService(workspace);
  });

  teardown(() => sinon.restore());

  suite('default scope', () => {
    test('does not skip when value differs from schema default', () => {
      inspectStub.returns({ defaultValue: true });
      assert.strictEqual(service.shouldSkipSettingUpdate('snyk', 'proxyStrictSSL', false, 'default'), false);
    });

    test('does not skip when defaultValue is undefined and value is non-undefined', () => {
      inspectStub.returns({ defaultValue: undefined });
      assert.strictEqual(service.shouldSkipSettingUpdate('snyk', 'someKey', 'value', 'default'), false);
    });
  });

  suite('user scope', () => {
    test('skips when incoming value equals existing user value', () => {
      inspectStub.returns({ globalValue: 'org-a', defaultValue: '' });
      assert.strictEqual(service.shouldSkipSettingUpdate('snyk', 'org', 'org-a', 'user'), true);
    });

    test('does not skip when incoming value equals default and no explicit user value', () => {
      // Override-aware: skip only when value equals globalValue AND globalValue !== undefined.
      // globalValue is undefined here, so it never skips on schema-default equality alone.
      inspectStub.returns({ globalValue: undefined, defaultValue: '' });
      assert.strictEqual(service.shouldSkipSettingUpdate('snyk', 'org', '', 'user'), false);
    });

    test('does not skip when incoming value differs from user value', () => {
      inspectStub.returns({ globalValue: 'org-a', defaultValue: '' });
      assert.strictEqual(service.shouldSkipSettingUpdate('snyk', 'org', 'org-b', 'user'), false);
    });

    test('does not skip when value is non-default and no explicit user value exists', () => {
      inspectStub.returns({ globalValue: undefined, defaultValue: '' });
      assert.strictEqual(service.shouldSkipSettingUpdate('snyk', 'org', 'org-new', 'user'), false);
    });
  });

  suite('workspace scope', () => {
    test('skips when incoming value equals existing workspace value', () => {
      inspectStub.returns({ workspaceValue: false, defaultValue: true });
      assert.strictEqual(service.shouldSkipSettingUpdate('snyk', 'proxyStrictSSL', false, 'workspace'), true);
    });

    test('does not skip when incoming value equals default and no explicit workspace value', () => {
      // Override-aware: skip only when value equals workspaceValue AND workspaceValue !== undefined.
      inspectStub.returns({ workspaceValue: undefined, defaultValue: true });
      assert.strictEqual(service.shouldSkipSettingUpdate('snyk', 'proxyStrictSSL', true, 'workspace'), false);
    });

    test('does not skip when value differs from workspace value', () => {
      inspectStub.returns({ workspaceValue: false, defaultValue: true });
      assert.strictEqual(service.shouldSkipSettingUpdate('snyk', 'proxyStrictSSL', true, 'workspace'), false);
    });
  });

  suite('missing inspection', () => {
    test('returns false when inspection is null', () => {
      inspectStub.returns(null);
      assert.strictEqual(service.shouldSkipSettingUpdate('snyk', 'any', 'val', 'user'), false);
    });
  });

  suite('effective value unknown — fallback (override-aware, never schema-default skip)', () => {
    test('does not skip on schema-default equality', () => {
      inspectStub.returns({ defaultValue: true, globalValue: undefined });
      // scope 'default' (no override), value true = schema default true.
      // Never skips on schema-default equality alone.
      assert.strictEqual(service.shouldSkipSettingUpdate('snyk', 'features.codeSecurity', true, 'default'), false);
    });

    test('skips when value equals explicit user override', () => {
      inspectStub.returns({ globalValue: 'org-a', defaultValue: '' });
      assert.strictEqual(service.shouldSkipSettingUpdate('snyk', 'org', 'org-a', 'user'), true);
    });

    test('does not skip in user scope when no explicit override exists', () => {
      inspectStub.returns({ globalValue: undefined, defaultValue: 'default-org' });
      assert.strictEqual(service.shouldSkipSettingUpdate('snyk', 'org', 'default-org', 'user'), false);
    });
  });

  // IDE-2264: a clearing write (value === undefined, e.g. a "reset to project defaults") is
  // redundant iff there is no override at any scope to clear.
  suite('clearing write (value === undefined) — IDE-2264', () => {
    test('skips when neither globalValue nor workspaceValue is set (nothing to clear)', () => {
      inspectStub.returns({ globalValue: undefined, workspaceValue: undefined, defaultValue: 'default-org' });
      assert.strictEqual(service.shouldSkipSettingUpdate('snyk', 'org', undefined, 'user'), true);
    });

    test('does not skip when a globalValue exists to clear', () => {
      inspectStub.returns({ globalValue: 'existing-org', workspaceValue: undefined, defaultValue: 'default-org' });
      assert.strictEqual(service.shouldSkipSettingUpdate('snyk', 'org', undefined, 'user'), false);
    });

    test('skips when only a workspaceValue exists to clear (write is global-target only)', () => {
      inspectStub.returns({ globalValue: undefined, workspaceValue: 'workspace-org', defaultValue: 'default-org' });
      assert.strictEqual(service.shouldSkipSettingUpdate('snyk', 'org', undefined, 'user'), true);
    });
  });

  suite('workspaceFolder scope — defense-in-depth', () => {
    test('skips when value equals explicit workspaceFolder override', () => {
      inspectStub.returns({ workspaceFolderValue: false, defaultValue: true });
      assert.strictEqual(service.shouldSkipSettingUpdate('snyk', 'proxyStrictSSL', false, 'workspaceFolder'), true);
    });

    test('does not skip workspaceFolder on schema-default equality', () => {
      inspectStub.returns({ workspaceFolderValue: undefined, defaultValue: true });
      assert.strictEqual(service.shouldSkipSettingUpdate('snyk', 'proxyStrictSSL', true, 'workspaceFolder'), false);
    });
  });
});
