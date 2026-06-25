import { ok, strictEqual } from 'assert';
import * as vm from 'vm';
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

  test('injectIdeScripts injects __ideConfirmationDialog__ bridge function', () => {
    const processed = service.injectIdeScripts(sampleHtml);

    ok(processed.includes('__ideConfirmationDialog__'), 'Should inject __ideConfirmationDialog__ function');
    ok(processed.includes("type: 'confirmationDialog'"), 'Should post confirmationDialog messages to extension host');
    ok(
      processed.includes('window.__ideRegisterCallback__(callback)'),
      'Should register the callback via the shared __ideRegisterCallback__ helper for the messageResult reply',
    );
  });

  test('injectIdeScripts exposes shared callback register/resolve helpers', () => {
    const processed = service.injectIdeScripts(sampleHtml);

    ok(processed.includes('__ideRegisterCallback__'), 'Should inject shared __ideRegisterCallback__ helper');
    ok(processed.includes('__ideResolveCallback__'), 'Should inject shared __ideResolveCallback__ helper');
  });

  // Executes the actual injected script so a string-JS typo in the confirm wrapper (which the
  // substring checks above would miss) fails a test, and the bridge mechanism/round-trip is proven.
  interface RunResult {
    window: Record<string, unknown>;
    posted: Record<string, unknown>[];
    dispatchMessage: (data: unknown) => void;
  }

  function runInjectedScript(): RunResult {
    const processed = service.injectIdeScripts(sampleHtml);
    const match = processed.match(/<script nonce="[^"]*">([\s\S]*?)<\/script>/);
    if (!match) throw new Error('expected an injected <script> block');

    const posted: Record<string, unknown>[] = [];
    const listeners: ((e: { data: unknown }) => void)[] = [];
    const window: Record<string, unknown> = {
      addEventListener: (type: string, fn: (e: { data: unknown }) => void) => {
        if (type === 'message') listeners.push(fn);
      },
    };
    const acquireVsCodeApi = () => ({ postMessage: (m: Record<string, unknown>) => posted.push(m) });

    vm.runInNewContext(match[1], { window, acquireVsCodeApi });

    return { window, posted, dispatchMessage: data => listeners.forEach(fn => fn({ data })) };
  }

  test('injected __ideConfirmationDialog__ round-trips a messageResult reply (executed)', () => {
    const { window, posted, dispatchMessage } = runInjectedScript();

    strictEqual(typeof window.__ideConfirmationDialog__, 'function', 'confirm bridge is defined');
    const confirm = window.__ideConfirmationDialog__ as (m: string, cb: (r: unknown) => void) => void;

    let received: unknown = 'unset';
    confirm('Reset?', r => {
      received = r;
    });

    const confirmMsg = posted.find(m => m.type === 'confirmationDialog');
    if (!confirmMsg) throw new Error('expected a confirmationDialog message to be posted');
    strictEqual(confirmMsg.message, 'Reset?');
    const cbId = confirmMsg.callbackId as string;
    ok(/^__cb_\d+$/.test(cbId), 'registers with a well-formed callbackId');

    dispatchMessage({ type: 'messageResult', callbackId: cbId, result: true });
    strictEqual(received, true, 'messageResult reply resolves the confirm callback with the boolean');
  });

  test('__ideConfirmationDialog__ registers through the shared __ideRegisterCallback__ helper', () => {
    const { window } = runInjectedScript();

    // Wrap the shared helper to record delegation, then call confirm — proves the mechanism
    // (not just that the round-trip happens to work) is the shared registry, not an inline copy.
    const original = window.__ideRegisterCallback__ as (cb: unknown) => string | null;
    const registered: unknown[] = [];
    window.__ideRegisterCallback__ = (cb: unknown) => {
      registered.push(cb);
      return original(cb);
    };

    const confirm = window.__ideConfirmationDialog__ as (m: string, cb: (r: unknown) => void) => void;
    const myCallback = () => {
      /* noop */
    };
    confirm('Reset?', myCallback);

    strictEqual(registered.length, 1, 'confirm delegates registration to the shared helper');
    strictEqual(registered[0], myCallback, 'the confirm callback is the one registered');
  });

  test('__ideExecuteCommand__ and __ideConfirmationDialog__ share one callback registry and counter', () => {
    const { window, posted } = runInjectedScript();

    const exec = window.__ideExecuteCommand__ as (c: string, a: unknown[], cb?: (r: unknown) => void) => void;
    const confirm = window.__ideConfirmationDialog__ as (m: string, cb: (r: unknown) => void) => void;

    exec('snyk.x', [], () => {
      /* noop */
    });
    confirm('Reset?', () => {
      /* noop */
    });

    const execMsg = posted.find(m => m.type === 'executeCommand') as Record<string, unknown>;
    const confirmMsg = posted.find(m => m.type === 'confirmationDialog') as Record<string, unknown>;

    strictEqual(execMsg.callbackId, '__cb_1', 'first registration via the shared counter');
    strictEqual(confirmMsg.callbackId, '__cb_2', 'confirm continues the same counter — proving a shared registry');
  });

  test('injectIdeScripts injects scripts before closing body tag', () => {
    const processed = service.injectIdeScripts(sampleHtml);

    ok(processed.includes('</body>'), 'Should preserve closing body tag');
    const scriptIndex = processed.indexOf('<script');
    const bodyCloseIndex = processed.indexOf('</body>');
    ok(scriptIndex < bodyCloseIndex, 'Script should appear before closing body tag');
  });

  test('injectIdeScripts does not inject scripts when no closing body tag', () => {
    const htmlWithoutBodyClose = '<html><head></head><body><p>content</p></html>';

    const processed = service.injectIdeScripts(htmlWithoutBodyClose);

    strictEqual(processed.includes('__ideExecuteCommand__'), false, 'Should not inject script when no </body> tag');
  });

  test('injectIdeScripts passes apiUrl from message to window.setAuthToken', () => {
    const processed = service.injectIdeScripts(sampleHtml);

    ok(processed.includes('message.apiUrl'), 'Should forward apiUrl from message to window.setAuthToken');
  });

  test('injectIdeScripts guards setAuthToken call with typeof check', () => {
    const processed = service.injectIdeScripts(sampleHtml);

    ok(
      processed.includes("typeof window.setAuthToken === 'function'"),
      'Should guard setAuthToken call with typeof check to handle pages that have not yet defined it',
    );
  });
});
