import assert from 'assert';
import { folderConfigsFromLspParam } from '../../../../snyk/common/languageServer/inboundLspFolderSettingsToFolderConfig';
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
