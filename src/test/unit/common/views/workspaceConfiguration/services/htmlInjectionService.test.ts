// ABOUTME: Unit tests for HtmlInjectionService
// ABOUTME: Tests IDE script injection
import { ok } from 'assert';
import { HtmlInjectionService } from '../../../../../../snyk/common/views/workspaceConfiguration/services/htmlInjectionService';

suite('HtmlInjectionService', () => {
  let service: HtmlInjectionService;

  const sampleHtml = `<!DOCTYPE html>
<html>
<head><title>Test Config</title></head>
<body>
  <form id="configForm">
    <input type="text" name="endpoint" id="endpoint" value="https://api.snyk.io">
    <button id="save-config-btn">Save</button>
  </form>
</body>
</html>`;

  setup(() => {
    service = new HtmlInjectionService();
  });

  test('injectIdeScripts injects IDE bridge functions', () => {
    const processed = service.injectIdeScripts(sampleHtml);

    ok(processed.includes('__saveIdeConfig__'), 'Should inject save config function');
    ok(processed.includes('__ideLogin__'), 'Should inject login function');
    ok(processed.includes('__ideLogout__'), 'Should inject logout function');
    ok(processed.includes('acquireVsCodeApi'), 'Should inject VS Code API call');
  });
});
