// ABOUTME: Unit tests for mapping inbound LS LS keys to IdeConfigData
import { strict as assert } from 'assert';
import { mergedGlobalSettingsToIdeConfigData } from '../../../../snyk/common/languageServer/inboundLspConfigurationToIdeConfig';
import { LS_KEY } from '../../../../snyk/common/languageServer/serverSettingsToLspConfigurationParam';

suite('inboundLspConfigurationToIdeConfig', () => {
  test('maps known global LS keys to IdeConfig fields', () => {
    const ide = mergedGlobalSettingsToIdeConfigData({
      [LS_KEY.snykOssEnabled]: { value: true },
      [LS_KEY.scanAutomatic]: { value: false },
      [LS_KEY.apiEndpoint]: { value: 'https://api.example' },
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
