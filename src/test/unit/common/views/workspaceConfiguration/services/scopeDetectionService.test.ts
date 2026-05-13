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
    test('skips when value equals schema default (never set by user)', () => {
      inspectStub.returns({ defaultValue: true });
      assert.strictEqual(service.shouldSkipSettingUpdate('snyk', 'proxyStrictSSL', true, 'default'), true);
    });

    test('does not skip when value differs from schema default', () => {
      inspectStub.returns({ defaultValue: true });
      assert.strictEqual(service.shouldSkipSettingUpdate('snyk', 'proxyStrictSSL', false, 'default'), false);
    });

    test('does not skip when defaultValue is undefined and value is non-undefined', () => {
      inspectStub.returns({ defaultValue: undefined });
      assert.strictEqual(service.shouldSkipSettingUpdate('snyk', 'someKey', 'value', 'default'), false);
    });

    test('skips when both value and defaultValue are undefined', () => {
      inspectStub.returns({ defaultValue: undefined });
      assert.strictEqual(service.shouldSkipSettingUpdate('snyk', 'someKey', undefined, 'default'), true);
    });
  });

  suite('user scope', () => {
    test('skips when incoming value equals existing user value', () => {
      inspectStub.returns({ globalValue: 'org-a', defaultValue: '' });
      assert.strictEqual(service.shouldSkipSettingUpdate('snyk', 'org', 'org-a', 'user'), true);
    });

    test('skips when incoming value equals default and no explicit user value', () => {
      inspectStub.returns({ globalValue: undefined, defaultValue: '' });
      assert.strictEqual(service.shouldSkipSettingUpdate('snyk', 'org', '', 'user'), true);
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

    test('skips when incoming value equals default and no explicit workspace value', () => {
      inspectStub.returns({ workspaceValue: undefined, defaultValue: true });
      assert.strictEqual(service.shouldSkipSettingUpdate('snyk', 'proxyStrictSSL', true, 'workspace'), true);
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
});
