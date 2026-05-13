import assert from 'assert';
import { folderConfigsFromLspParam } from '../../../../snyk/common/languageServer/inboundLspFolderSettingsToFolderConfig';
import { FolderConfig } from '../../../../snyk/common/configuration/configuration';
import { LS_KEY } from '../../../../snyk/common/languageServer/serverSettingsToLspConfigurationParam';
import type { LspConfigurationParam } from '../../../../snyk/common/languageServer/types';

suite('folderConfigsFromLspParam', () => {
  test('returns empty array when no folderConfigs in param', () => {
    const param: LspConfigurationParam = { settings: { endpoint: { value: 'https://x', source: 'd' } } };
    const out = folderConfigsFromLspParam(param);
    assert.deepStrictEqual(out, []);
  });

  test('builds FolderConfig from LS folder settings', () => {
    const param: LspConfigurationParam = {
      folderConfigs: [
        {
          folderPath: '/proj',
          settings: {
            [LS_KEY.baseBranch]: { value: 'develop', source: 'ls' },
            [LS_KEY.localBranches]: { value: ['develop', 'main'], source: 'ls' },
            [LS_KEY.preferredOrg]: { value: 'my-org', source: 'ls' },
          },
        },
      ],
    };
    const out = folderConfigsFromLspParam(param);
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].folderPath, '/proj');
    assert.strictEqual(out[0].baseBranch(), 'develop');
    assert.deepStrictEqual(out[0].localBranches(), ['develop', 'main']);
    assert.strictEqual(out[0].preferredOrg(), 'my-org');
    // defaults for fields LS didn't send
    assert.strictEqual(out[0].orgSetByUser(), false);
    assert.strictEqual(out[0].autoDeterminedOrg(), '');
  });

  test('builds multiple folder configs', () => {
    const param: LspConfigurationParam = {
      folderConfigs: [
        {
          folderPath: '/a',
          settings: {
            [LS_KEY.referenceFolder]: { value: '/ref', source: 'ls' },
          },
        },
        {
          folderPath: '/b',
          settings: {
            [LS_KEY.orgSetByUser]: { value: true, source: 'ls' },
          },
        },
      ],
    };
    const out = folderConfigsFromLspParam(param);
    assert.strictEqual(out.length, 2);
    assert.strictEqual(out[0].folderPath, '/a');
    assert.strictEqual(out[0].referenceFolderPath(), '/ref');
    assert.strictEqual(out[1].folderPath, '/b');
    assert.strictEqual(out[1].orgSetByUser(), true);
  });
});

suite('FolderConfig.setSetting', () => {
  test('marks new setting as changed', () => {
    const fc = new FolderConfig('/proj');
    fc.setSetting('severity_filter_critical', true);
    assert.deepStrictEqual(fc.settings['severity_filter_critical'], { value: true, changed: true });
  });

  test('marks changed when value is identical to current', () => {
    const fc = new FolderConfig('/proj', {
      severity_filter_critical: { value: true, changed: false, source: 'org' },
    });
    fc.setSetting('severity_filter_critical', true);
    assert.strictEqual(fc.settings['severity_filter_critical'].changed, true);
  });

  test('updates and marks changed when value differs', () => {
    const fc = new FolderConfig('/proj', {
      severity_filter_critical: { value: true, changed: false, source: 'org' },
    });
    fc.setSetting('severity_filter_critical', false);
    assert.deepStrictEqual(fc.settings['severity_filter_critical'], { value: false, changed: true });
  });

  test('preserves changed:true when value is identical and already changed', () => {
    const fc = new FolderConfig('/proj', {
      severity_filter_critical: { value: true, changed: true },
    });
    fc.setSetting('severity_filter_critical', true);
    assert.strictEqual(fc.settings['severity_filter_critical'].changed, true);
  });
});
