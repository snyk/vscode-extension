// ABOUTME: Unit tests for mapping inbound LS pflags to IdeConfigData
import { strict as assert } from 'assert';
import { mergedGlobalSettingsToIdeConfigData } from '../../../../snyk/common/languageServer/inboundLspConfigurationToIdeConfig';
import { PFLAG } from '../../../../snyk/common/languageServer/serverSettingsToLspConfigurationParam';

suite('inboundLspConfigurationToIdeConfig', () => {
  test('maps known global pflags to IdeConfig fields', () => {
    const ide = mergedGlobalSettingsToIdeConfigData({
      [PFLAG.snykOssEnabled]: { value: true },
      [PFLAG.scanAutomatic]: { value: false },
      [PFLAG.apiEndpoint]: { value: 'https://api.example' },
    });
    assert.equal(ide.activateSnykOpenSource, true);
    assert.equal(ide.scanningMode, 'manual');
    assert.equal(ide.endpoint, 'https://api.example');
  });

  test('returns empty object when no recognized keys', () => {
    const ide = mergedGlobalSettingsToIdeConfigData({});
    assert.deepStrictEqual(ide, {});
  });
});
