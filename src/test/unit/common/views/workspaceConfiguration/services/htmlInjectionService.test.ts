import { ok, strictEqual } from 'assert';
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

  test('injectIdeScripts injects __ideExecuteCommand__ bridge function', () => {
    const processed = service.injectIdeScripts(sampleHtml);

    ok(processed.includes('__ideExecuteCommand__'), 'Should inject __ideExecuteCommand__ function');
    ok(processed.includes("type: 'executeCommand'"), 'Should post executeCommand messages to extension host');
  });

  test('injectIdeScripts injects __saveIdeConfig__ bridge function', () => {
    const processed = service.injectIdeScripts(sampleHtml);

    ok(processed.includes('__saveIdeConfig__'), 'Should inject save config function');
    ok(processed.includes('acquireVsCodeApi'), 'Should inject VS Code API call');
  });

  test('injectIdeScripts does NOT inject deprecated __ideLogin__', () => {
    const processed = service.injectIdeScripts(sampleHtml);

    strictEqual(processed.includes('__ideLogin__'), false, 'Should NOT inject __ideLogin__ (removed)');
  });

  test('injectIdeScripts does NOT inject deprecated __ideLogout__', () => {
    const processed = service.injectIdeScripts(sampleHtml);

    strictEqual(processed.includes('__ideLogout__'), false, 'Should NOT inject __ideLogout__ (removed)');
  });

  test('injectIdeScripts injects scripts before closing body tag', () => {
    const processed = service.injectIdeScripts(sampleHtml);

    ok(processed.includes('</body>'), 'Should preserve closing body tag');
    const scriptIndex = processed.indexOf('<script');
    const bodyCloseIndex = processed.indexOf('</body>');
    ok(scriptIndex < bodyCloseIndex, 'Script should appear before closing body tag');
  });
});
