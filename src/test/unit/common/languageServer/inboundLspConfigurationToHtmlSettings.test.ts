// ABOUTME: Unit tests for mapping inbound LS keys to HtmlSettingsData
import { strict as assert } from 'assert';
import { mapLspSettingsToHtmlSettings } from '../../../../snyk/common/languageServer/inboundLspConfigurationToHtmlSettings';
import { LS_KEY } from '../../../../snyk/common/languageServer/serverSettingsToLspConfigurationParam';

suite('inboundLspConfigurationToHtmlSettings', () => {
  test('maps known global LS keys to HtmlSettings fields', () => {
    const result = mapLspSettingsToHtmlSettings({
      [LS_KEY.snykOssEnabled]: { value: true },
      [LS_KEY.scanAutomatic]: { value: false },
      [LS_KEY.apiEndpoint]: { value: 'https://api.example' },
    });
    assert.equal(result.snyk_oss_enabled, true);
    assert.equal(result.scan_automatic, false);
    assert.equal(result.api_endpoint, 'https://api.example');
  });

  test('maps issue view fields as separate LS keys', () => {
    const result = mapLspSettingsToHtmlSettings({
      [LS_KEY.issueViewOpenIssues]: { value: true },
      [LS_KEY.issueViewIgnoredIssues]: { value: false },
    });
    assert.equal(result.issue_view_open_issues, true);
    assert.equal(result.issue_view_ignored_issues, false);
  });

  test('returns empty object when no recognized keys', () => {
    const result = mapLspSettingsToHtmlSettings({});
    assert.deepStrictEqual(result, {});
  });
});
