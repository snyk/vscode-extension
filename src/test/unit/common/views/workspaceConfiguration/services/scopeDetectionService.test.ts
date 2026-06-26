import assert from 'assert';
import sinon from 'sinon';
import {
  EFFECTIVE_VALUE_UNKNOWN,
  ScopeDetectionService,
} from '../../../../../../snyk/common/views/workspaceConfiguration/services/scopeDetectionService';
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

  // ── Existing tests updated to pass EFFECTIVE_VALUE_UNKNOWN as the 5th arg ──
  // These preserve backwards compatibility: when the caller has no snapshot, the
  // fallback (override-aware) path applies. The 'default' scope tests below are
  // updated to match the NEW predicate (fallback never skips on schema-default).

  suite('default scope', () => {
    // CP-2.3 note: the two "skips on schema-default" tests below are REPLACED by the
    // new predicate. Under the old code they passed; under the new code the 'default'
    // fallback returns false (never skip on schema-default equality).
    // The corrected versions with EFFECTIVE_VALUE_UNKNOWN appear in UNIT-003 below.

    test('does not skip when value differs from schema default', () => {
      inspectStub.returns({ defaultValue: true });
      // effective unknown, value differs → false (genuine change, not skipped)
      assert.strictEqual(
        service.shouldSkipSettingUpdate('snyk', 'proxyStrictSSL', false, 'default', EFFECTIVE_VALUE_UNKNOWN),
        false,
      );
    });

    test('does not skip when defaultValue is undefined and value is non-undefined', () => {
      inspectStub.returns({ defaultValue: undefined });
      assert.strictEqual(
        service.shouldSkipSettingUpdate('snyk', 'someKey', 'value', 'default', EFFECTIVE_VALUE_UNKNOWN),
        false,
      );
    });
  });

  suite('user scope', () => {
    test('skips when incoming value equals existing user value', () => {
      inspectStub.returns({ globalValue: 'org-a', defaultValue: '' });
      assert.strictEqual(
        service.shouldSkipSettingUpdate('snyk', 'org', 'org-a', 'user', EFFECTIVE_VALUE_UNKNOWN),
        true,
      );
    });

    test('skips when incoming value equals default and no explicit user value', () => {
      // Under the old predicate this returned true (isDefaultValue && !hasExplicitValue).
      // Under the new fallback predicate for 'user': skip only when value equals globalValue
      // AND globalValue !== undefined. Here globalValue is undefined → returns false.
      // This test is updated to match the new predicate.
      inspectStub.returns({ globalValue: undefined, defaultValue: '' });
      assert.strictEqual(service.shouldSkipSettingUpdate('snyk', 'org', '', 'user', EFFECTIVE_VALUE_UNKNOWN), false);
    });

    test('does not skip when incoming value differs from user value', () => {
      inspectStub.returns({ globalValue: 'org-a', defaultValue: '' });
      assert.strictEqual(
        service.shouldSkipSettingUpdate('snyk', 'org', 'org-b', 'user', EFFECTIVE_VALUE_UNKNOWN),
        false,
      );
    });

    test('does not skip when value is non-default and no explicit user value exists', () => {
      inspectStub.returns({ globalValue: undefined, defaultValue: '' });
      assert.strictEqual(
        service.shouldSkipSettingUpdate('snyk', 'org', 'org-new', 'user', EFFECTIVE_VALUE_UNKNOWN),
        false,
      );
    });
  });

  suite('workspace scope', () => {
    test('skips when incoming value equals existing workspace value', () => {
      inspectStub.returns({ workspaceValue: false, defaultValue: true });
      assert.strictEqual(
        service.shouldSkipSettingUpdate('snyk', 'proxyStrictSSL', false, 'workspace', EFFECTIVE_VALUE_UNKNOWN),
        true,
      );
    });

    test('skips when incoming value equals default and no explicit workspace value', () => {
      // Under the old predicate this returned true (isDefaultValue && !hasExplicitValue).
      // Under the new fallback predicate for 'workspace': skip only when value equals
      // workspaceValue AND workspaceValue !== undefined. Here undefined → returns false.
      // Updated to match new predicate.
      inspectStub.returns({ workspaceValue: undefined, defaultValue: true });
      assert.strictEqual(
        service.shouldSkipSettingUpdate('snyk', 'proxyStrictSSL', true, 'workspace', EFFECTIVE_VALUE_UNKNOWN),
        false,
      );
    });

    test('does not skip when value differs from workspace value', () => {
      inspectStub.returns({ workspaceValue: false, defaultValue: true });
      assert.strictEqual(
        service.shouldSkipSettingUpdate('snyk', 'proxyStrictSSL', true, 'workspace', EFFECTIVE_VALUE_UNKNOWN),
        false,
      );
    });
  });

  suite('missing inspection', () => {
    test('returns false when inspection is null', () => {
      inspectStub.returns(null);
      assert.strictEqual(service.shouldSkipSettingUpdate('snyk', 'any', 'val', 'user', EFFECTIVE_VALUE_UNKNOWN), false);
    });
  });

  // ── UNIT-001..006: New tests for the effective-baseline predicate (CP-2.2) ──

  suite('effective value known — step 2 of predicate', () => {
    // UNIT-001: value equals schema default but differs from effective → must NOT skip
    // This is the core fix: IDE-2149 bug was that this returned true (skipped the write).
    test('does not skip when value equals schema default but differs from effective value', () => {
      // inspect() returns the real schema default (true), no globalValue (post-reset).
      inspectStub.returns({ defaultValue: true, globalValue: undefined });
      // effective value from LS: false (org default overrides the schema default)
      // saving true → true ≠ false → should NOT skip (genuine re-enable)
      assert.strictEqual(
        service.shouldSkipSettingUpdate('snyk', 'features.codeSecurity', true, 'default', false),
        false,
      );
    });

    // UNIT-002: value equals effective value → must skip (redundant write)
    test('skips when value equals effective value', () => {
      inspectStub.returns({ defaultValue: true, globalValue: undefined });
      // effective value from LS: true — saving true → true === true → skip (no change)
      assert.strictEqual(service.shouldSkipSettingUpdate('snyk', 'features.codeSecurity', true, 'default', true), true);
    });

    // UNIT-002b: skip is purely based on effective value equality; scope is irrelevant when effective is known
    test('skips when value equals effective value regardless of scope', () => {
      inspectStub.returns({ globalValue: 'org-a', defaultValue: '' });
      // effective = 'org-a', saving 'org-a' → skip
      assert.strictEqual(service.shouldSkipSettingUpdate('snyk', 'org', 'org-a', 'user', 'org-a'), true);
    });

    // UNIT-002c: does not skip when effective is known and value differs, even in 'user' scope
    test('does not skip when value differs from effective value in user scope', () => {
      inspectStub.returns({ globalValue: 'org-a', defaultValue: '' });
      // effective = 'org-a', saving 'org-b' → do NOT skip
      assert.strictEqual(service.shouldSkipSettingUpdate('snyk', 'org', 'org-b', 'user', 'org-a'), false);
    });
  });

  suite('effective value unknown — fallback (override-aware, never schema-default skip)', () => {
    // UNIT-003: effective UNKNOWN, scope 'default', value equals schema default, no override → must NOT skip
    // This is the second part of the fix: fallback never skips on schema-default equality.
    test('does not skip on schema-default equality when effective value is unknown', () => {
      inspectStub.returns({ defaultValue: true, globalValue: undefined });
      // effective unknown, scope 'default' (no override), value true = schema default true
      // OLD behaviour: returned true (skipped). NEW behaviour: returns false (writes).
      assert.strictEqual(
        service.shouldSkipSettingUpdate('snyk', 'features.codeSecurity', true, 'default', EFFECTIVE_VALUE_UNKNOWN),
        false,
      );
    });

    // UNIT-004: effective UNKNOWN, scope 'user', value equals existing globalValue → skip (override-aware)
    test('skips when value equals explicit user override and effective unknown', () => {
      inspectStub.returns({ globalValue: 'org-a', defaultValue: '' });
      // effective unknown → fallback: 'user' scope: skip iff value === globalValue && defined
      assert.strictEqual(
        service.shouldSkipSettingUpdate('snyk', 'org', 'org-a', 'user', EFFECTIVE_VALUE_UNKNOWN),
        true,
      );
    });

    // UNIT-004b: effective UNKNOWN, scope 'user', no globalValue → must NOT skip
    test('does not skip in user scope when no explicit override exists and effective unknown', () => {
      inspectStub.returns({ globalValue: undefined, defaultValue: 'default-org' });
      // effective unknown, globalValue undefined → fallback: 'user' scope returns false
      assert.strictEqual(
        service.shouldSkipSettingUpdate('snyk', 'org', 'default-org', 'user', EFFECTIVE_VALUE_UNKNOWN),
        false,
      );
    });
  });

  suite('workspaceFolder scope — defense-in-depth (UNIT-005, UNIT-006)', () => {
    // UNIT-005: scope 'workspaceFolder', effective UNKNOWN, value equals workspaceFolderValue → skip
    test('skips when value equals explicit workspaceFolder override', () => {
      inspectStub.returns({ workspaceFolderValue: false, defaultValue: true });
      // effective unknown → fallback: 'workspaceFolder': skip iff value === workspaceFolderValue && defined
      assert.strictEqual(
        service.shouldSkipSettingUpdate('snyk', 'proxyStrictSSL', false, 'workspaceFolder', EFFECTIVE_VALUE_UNKNOWN),
        true,
      );
    });

    // UNIT-006: scope 'workspaceFolder', effective UNKNOWN, no workspaceFolderValue, value equals schema default → must NOT skip
    test('does not skip workspaceFolder on schema-default equality', () => {
      inspectStub.returns({ workspaceFolderValue: undefined, defaultValue: true });
      // OLD behaviour: fell through to default branch → isEqual(true, true) = true (skipped).
      // NEW behaviour: 'workspaceFolder' case returns false when workspaceFolderValue is undefined.
      assert.strictEqual(
        service.shouldSkipSettingUpdate('snyk', 'proxyStrictSSL', true, 'workspaceFolder', EFFECTIVE_VALUE_UNKNOWN),
        false,
      );
    });

    // UNIT-005b: scope 'workspaceFolder', effective KNOWN, value equals effective → skip
    test('skips workspaceFolder when value equals effective value (effective-known path)', () => {
      inspectStub.returns({ workspaceFolderValue: true, defaultValue: true });
      // effective known (false), value false → false === false → must SKIP (redundant write)
      assert.strictEqual(
        service.shouldSkipSettingUpdate('snyk', 'proxyStrictSSL', false, 'workspaceFolder', false),
        true,
      );
    });
  });
});
