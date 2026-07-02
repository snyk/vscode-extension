// ABOUTME: Integration tests for WorkspaceConfigurationWebviewProvider
// ABOUTME: Tests HTML fetching and webview panel creation
import { strictEqual, ok } from 'assert';
import sinon from 'sinon';
import * as vscode from 'vscode';
import { WorkspaceConfigurationWebviewProvider } from '../../snyk/common/views/workspaceConfiguration/workspaceConfigurationWebviewProvider';
import { ExtensionContext } from '../../snyk/common/vscode/extensionContext';
import { LoggerMock } from '../unit/mocks/logger.mock';
import { IVSCodeCommands } from '../../snyk/common/vscode/commands';
import { IVSCodeWorkspace } from '../../snyk/common/vscode/workspace';
import { IConfiguration } from '../../snyk/common/configuration/configuration';
import { IHtmlInjectionService } from '../../snyk/common/views/workspaceConfiguration/services/htmlInjectionService';
import { IScopeDetectionService } from '../../snyk/common/views/workspaceConfiguration/services/scopeDetectionService';
import { IMessageHandlerFactory } from '../../snyk/common/views/workspaceConfiguration/handlers/messageHandlerFactory';
import { SNYK_WORKSPACE_CONFIGURATION_COMMAND } from '../../snyk/common/constants/commands';

suite('WorkspaceConfigurationWebviewProvider', () => {
  let provider: WorkspaceConfigurationWebviewProvider;
  let commandExecutorMock: IVSCodeCommands;
  let workspaceMock: IVSCodeWorkspace;
  let contextMock: ExtensionContext;
  let configurationMock: IConfiguration;
  let htmlInjectionServiceMock: IHtmlInjectionService;
  let scopeDetectionServiceMock: IScopeDetectionService;
  let messageHandlerFactoryMock: IMessageHandlerFactory;
  let logger: LoggerMock;
  let executeCommandStub: sinon.SinonStub;
  let updateConfigurationStub: sinon.SinonStub;

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
    logger = new LoggerMock();

    executeCommandStub = sinon.stub().resolves(sampleHtml);
    commandExecutorMock = {
      executeCommand: executeCommandStub,
    } as unknown as IVSCodeCommands;

    updateConfigurationStub = sinon.stub().resolves();
    workspaceMock = {
      updateConfiguration: updateConfigurationStub,
      getConfiguration: sinon.stub(),
      getWorkspaceFolders: sinon.stub().returns([]),
    } as unknown as IVSCodeWorkspace;

    contextMock = {
      extensionPath: '/test/path',
      getExtensionUri: () => ({ fsPath: '/test/path' }),
    } as ExtensionContext;

    configurationMock = {
      setToken: sinon.stub().resolves(),
      getToken: sinon.stub().resolves(undefined),
    } as unknown as IConfiguration;

    htmlInjectionServiceMock = {
      injectIdeScripts: sinon.stub().returnsArg(0),
    } as unknown as IHtmlInjectionService;

    scopeDetectionServiceMock = {
      getSettingScope: sinon.stub().returns('default'),
      populateScopeIndicators: sinon.stub().returnsArg(0),
    } as unknown as IScopeDetectionService;

    messageHandlerFactoryMock = {
      handleMessage: sinon.stub().resolves(),
    } as unknown as IMessageHandlerFactory;

    provider = new WorkspaceConfigurationWebviewProvider(
      contextMock,
      logger,
      commandExecutorMock,
      workspaceMock,
      configurationMock,
      htmlInjectionServiceMock,
      scopeDetectionServiceMock,
      messageHandlerFactoryMock,
    );
  });

  teardown(() => {
    sinon.restore();
  });

  test('fetchConfigurationHtml calls language server command', async () => {
    // Access private method for testing
    const html = await provider['fetchConfigurationHtml']();

    sinon.assert.calledOnceWithExactly(executeCommandStub, SNYK_WORKSPACE_CONFIGURATION_COMMAND);
    strictEqual(html, sampleHtml);
  });

  test('fetchConfigurationHtml returns sample HTML content', async () => {
    const html = await provider['fetchConfigurationHtml']();

    ok(html, 'HTML should not be null or undefined');
    ok(html.includes('<!DOCTYPE html>'), 'HTML should be a complete document');
    ok(html.includes('configForm'), 'HTML should contain the config form');
    ok(html.includes('save-config-btn'), 'HTML should contain save button');
  });

  test('fetchConfigurationHtml handles error gracefully', async () => {
    executeCommandStub.rejects(new Error('LS command failed'));

    const html = await provider['fetchConfigurationHtml']();

    strictEqual(html, undefined);
  });

  test('reloadIfOpen re-fetches and re-renders HTML when panel is open', async () => {
    const newHtml = '<html>fresh</html>';
    const injectedHtml = '<html>fresh-injected</html>';
    executeCommandStub.resolves(newHtml);
    // Override injectIdeScripts for this test to return a sentinel so the output assertion
    // actually verifies the pipeline ran, not just that webview.html was set to the raw fetch result.
    // resetBehavior() is required in sinon 11 to override a stub initialised with returnsArg().
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const injectStub = htmlInjectionServiceMock.injectIdeScripts as sinon.SinonStub;
    injectStub.resetBehavior();
    injectStub.returns(injectedHtml);
    const webview = { html: 'old-html' };
    provider['panel'] = { webview } as unknown as vscode.WebviewPanel;

    await provider.reloadIfOpen();

    // eslint-disable-next-line @typescript-eslint/unbound-method
    const populateScopeIndicatorsStub = scopeDetectionServiceMock.populateScopeIndicators as sinon.SinonStub;
    sinon.assert.calledOnce(executeCommandStub);
    sinon.assert.calledOnce(populateScopeIndicatorsStub);
    sinon.assert.calledOnce(injectStub);
    strictEqual(webview.html, injectedHtml); // sentinel value — verifies pipeline ran
  });

  test('reloadIfOpen is a no-op when panel is not open', async () => {
    await provider.reloadIfOpen();

    sinon.assert.notCalled(executeCommandStub);
  });

  test('reloadIfOpen handles fetch failure without throwing', async () => {
    executeCommandStub.rejects(new Error('LS fetch failed'));
    const stubFallback = sinon.stub(provider as any, 'getFallbackHtml').rejects(new Error('no fallback'));
    const webview = { html: 'old-html' };
    provider['panel'] = { webview } as unknown as vscode.WebviewPanel;

    await provider.reloadIfOpen(); // must not throw

    strictEqual(webview.html, 'old-html'); // html unchanged
    stubFallback.restore();
  });

  // IDE-1954: concurrent reloads must not overwrite latest html with stale html.
  // Regression test: without serialization, a slow first fetch that resolves after a
  // fast second fetch would overwrite webview.html with stale content.
  // Hardened: records the sequence of html writes to prove strict submission order.
  test('reloadIfOpen serializes concurrent calls — writes happen in submission order, no out-of-order overwrite', async () => {
    const writeOrder: string[] = [];
    const webview = {
      get html(): string {
        return writeOrder[writeOrder.length - 1] ?? 'initial';
      },
      set html(v: string) {
        writeOrder.push(v);
      },
    };
    provider['panel'] = { webview } as unknown as vscode.WebviewPanel;

    // Arrange: first fetch is SLOW (controlled manually), second fetch resolves immediately.
    // Without a serialized queue both fetches run concurrently; the second resolves faster,
    // writes secondHtml, then the first resolves later and overwrites with stale firstHtml
    // (wrong order: [secondHtml, firstHtml]).
    // With the serialized queue the first fetch must complete before the second starts
    // (order: [firstHtml, secondHtml]).
    const firstHtml = '<html>first-slow</html>';
    const secondHtml = '<html>second-fast</html>';

    let resolveFirst!: (v: string | undefined) => void;
    const firstFetchPromise = new Promise<string | undefined>(resolve => {
      resolveFirst = resolve;
    });

    // Stub fetchConfigurationHtml directly to avoid the slow retry path.
    const fetchStub = sinon
      .stub(provider as any, 'fetchConfigurationHtml')
      .onCall(0)
      .returns(firstFetchPromise)
      .onCall(1)
      .resolves(secondHtml);

    // Queue both reloads without awaiting either.
    const reload1 = provider.reloadIfOpen();
    const reload2 = provider.reloadIfOpen();

    // Resolve the slow first fetch so the queue can drain.
    resolveFirst(firstHtml);

    // Await both in submission order.
    await reload1;
    await reload2;

    // Assert writes happened in submission order: first then second.
    // This is the proof that the queue is serialized — without the queue the order would
    // be [secondHtml, firstHtml] because the second fetch resolves before the first.
    strictEqual(writeOrder.length, 2, 'Expected exactly two html writes');
    strictEqual(writeOrder[0], firstHtml, 'Expected first write to be firstHtml (submission order)');
    strictEqual(writeOrder[1], secondHtml, 'Expected second write to be secondHtml (submission order)');
    // Final value is the last-queued call's result.
    strictEqual(
      writeOrder[writeOrder.length - 1],
      secondHtml,
      'Expected second (last-queued) html to be final, but got stale first html — out-of-order overwrite bug',
    );

    fetchStub.restore();
  });

  // IDE-1954: queue chain survives a render step that throws — the next reload still executes
  test('reloadIfOpen queue chain survives a rejected render step', async () => {
    const webview = { html: 'initial' };
    provider['panel'] = { webview } as unknown as vscode.WebviewPanel;

    const goodHtml = '<html>good</html>';

    // Stub fetchConfigurationHtml directly so we don't trigger slow retry logic.
    // First call rejects (simulates a render failure), second resolves.
    const fetchStub = sinon
      .stub(provider as any, 'fetchConfigurationHtml')
      .onCall(0)
      .rejects(new Error('fetch failed'))
      .onCall(1)
      .resolves(goodHtml);

    const reload1 = provider.reloadIfOpen();
    const reload2 = provider.reloadIfOpen();

    await reload1;
    await reload2;

    // Second reload must have executed and written its html.
    strictEqual(webview.html, goodHtml, 'Queue should survive a rejected step and execute the next reload');
    fetchStub.restore();
  });

  // IDE-1954 issue 1: showPanel must route its initial render through the shared reloadQueue
  // so that a concurrent reloadIfOpen cannot race with it and write stale html last.
  test('showPanel initial render is serialized with concurrent reloadIfOpen via shared queue', async () => {
    // Simulate panel not yet open — showPanel will create it and render.
    // We pre-inject a fake panel so we can test without real VS Code APIs.
    const writeOrder: string[] = [];
    const webview = {
      get html(): string {
        return writeOrder[writeOrder.length - 1] ?? '';
      },
      set html(v: string) {
        writeOrder.push(v);
      },
      onDidReceiveMessage: sinon.stub(),
      postMessage: sinon.stub().resolves(true),
    };
    const fakePanel = {
      webview,
      title: '',
      reveal: sinon.stub(),
      onDidDispose: sinon.stub(),
      onDidChangeViewState: sinon.stub(),
      iconPath: undefined as unknown,
    };

    const showPanelHtml = '<html>show-panel</html>';
    const reloadHtml = '<html>reload-after</html>';

    let resolveShowPanel!: (v: string | undefined) => void;
    const showPanelFetchPromise = new Promise<string | undefined>(resolve => {
      resolveShowPanel = resolve;
    });

    // Stub createWebviewPanel to install our fake panel synchronously.
    // All three vscode globals are restored in finally so they never leak into later tests
    // even when an assertion throws.
    const createPanelStub = sinon
      .stub(vscode.window, 'createWebviewPanel')
      .returns(fakePanel as unknown as vscode.WebviewPanel);
    const uriFileStub = sinon.stub(vscode.Uri, 'file').returns({ fsPath: '/stub' } as unknown as vscode.Uri);
    const uriJoinStub = sinon.stub(vscode.Uri, 'joinPath').returns({ fsPath: '/stub/icon' } as unknown as vscode.Uri);

    const fetchStub = sinon
      .stub(provider as any, 'fetchConfigurationHtml')
      .onCall(0)
      .returns(showPanelFetchPromise) // showPanel's fetch is slow
      .onCall(1)
      .resolves(reloadHtml); // reloadIfOpen's fetch is fast

    try {
      // Start showPanel (creates panel, begins slow initial render).
      const showPanelPromise = provider.showPanel();

      // Concurrently queue a reload (fast fetch).
      const reloadPromise = provider.reloadIfOpen();

      // Resolve the slow showPanel fetch so both can complete.
      resolveShowPanel(showPanelHtml);

      await showPanelPromise;
      await reloadPromise;

      // With a shared queue: showPanel renders first (showPanelHtml), reload renders second (reloadHtml).
      // Without a shared queue: both run concurrently; reload's fast fetch writes reloadHtml first,
      // then showPanel's slow fetch overwrites with showPanelHtml — stale final value.
      strictEqual(writeOrder.length, 2, 'Expected exactly two html writes');
      strictEqual(writeOrder[0], showPanelHtml, 'Expected showPanel html written first (submission order)');
      strictEqual(writeOrder[1], reloadHtml, 'Expected reload html written second (submission order)');
    } finally {
      createPanelStub.restore();
      uriFileStub.restore();
      uriJoinStub.restore();
      fetchStub.restore();
    }
  });

  // IDE-1954 issue 2a: after panel dispose, a stale pre-dispose reloadIfOpen call must not
  // render into the fresh panel that is opened afterwards.
  //
  // Covers the PRE-FETCH guard in reloadIfOpen's queued step via the IDENTITY arm
  // (this.panel !== panelAtEnqueue). The stale step's panelAtEnqueue captured the old panel;
  // when the step runs, this.panel is the FRESH panel (truthy, different object), so
  // `this.panel !== panelAtEnqueue` fires and the step aborts before calling fetchConfigurationHtml.
  //
  // Simulates real dispose order: onPanelDispose() is called first (resets the queue and clears
  // this.panel internally via super), then the fresh panel is installed — matching how VS Code
  // actually triggers the dispose event followed by the user re-opening the settings page.
  // The stale step was already enqueued against the old panel, so when it finally executes it
  // finds this.panel = freshPanel ≠ panelAtEnqueue = oldPanel → identity arm fires.
  //
  // Test observability: fetchStub must be called exactly once (only the fresh step fetched)
  // and the fresh panel must receive exactly freshHtml (nothing from the stale step).
  test('reloadQueue is reset on panel dispose — pre-dispose queued renders do not write to the fresh panel', async () => {
    // Track writes to each panel separately via recorder objects.
    const firstWrites: string[] = [];
    const firstWebview = {
      get html(): string {
        return firstWrites[firstWrites.length - 1] ?? 'first-initial';
      },
      set html(v: string) {
        firstWrites.push(v);
      },
    };
    const freshWrites: string[] = [];
    const freshWebview = {
      get html(): string {
        return freshWrites[freshWrites.length - 1] ?? 'fresh-initial';
      },
      set html(v: string) {
        freshWrites.push(v);
      },
    };

    const freshHtml = '<html>fresh-post-reopen</html>';

    // Stub fetchConfigurationHtml to always resolve freshHtml:
    // - correct behaviour: stale step aborts via identity guard before fetching (zero stale calls);
    //   fresh step fetches and renders — fetchStub called exactly once.
    // - bug (no identity guard): stale step passes guard, fetches freshHtml, renders it to
    //   whichever panel is current (freshPanel) — fetchStub called twice, freshWrites gets
    //   an extra entry from the stale step before the fresh step's entry.
    const fetchStub = sinon.stub(provider as any, 'fetchConfigurationHtml').resolves(freshHtml);

    // Set up the first panel and queue a stale reload (captured panelAtEnqueue = firstPanel).
    const firstPanel = { webview: firstWebview } as unknown as vscode.WebviewPanel;
    provider['panel'] = firstPanel;
    const staleReload = provider.reloadIfOpen();

    // Simulate real VS Code dispose sequence: call onPanelDispose() which resets the queue
    // and clears this.panel internally (via super.onPanelDispose). Do NOT null this.panel
    // manually first — that would make the stale step abort via the `!this.panel` null arm
    // rather than the `this.panel !== panelAtEnqueue` identity arm we are testing here.
    provider['onPanelDispose']();

    // Install the fresh panel — this.panel is now a new, distinct object.
    // When the stale step's queued body runs, it sees this.panel = freshPanel (truthy)
    // but panelAtEnqueue = firstPanel (different object) → identity arm fires → aborts.
    provider['panel'] = { webview: freshWebview } as unknown as vscode.WebviewPanel;
    const freshReload = provider.reloadIfOpen();

    await staleReload;
    await freshReload;

    // The stale step must have aborted via the identity arm without calling fetchConfigurationHtml.
    // The fresh step is the only fetch caller.
    sinon.assert.calledOnce(fetchStub);

    // The first panel must have received zero writes (stale step never rendered).
    strictEqual(firstWrites.length, 0, 'Stale step must not write to the first panel — it should have aborted');

    // The fresh panel must show freshHtml with no contamination from the stale step.
    strictEqual(freshWrites[freshWrites.length - 1], freshHtml, 'Fresh panel must show fresh html');
    strictEqual(freshWrites.length, 1, 'Fresh panel must receive exactly one write (from the fresh step only)');

    fetchStub.restore();
  });

  // IDE-1954 issue 2b: covers the INNER (post-fetch) identity guard inside renderConfigurationHtml.
  // Scenario: a stale reload's queued step passes the pre-fetch guard (this.panel === panelAtEnqueue
  // at step-execution time because the panel is still set), then is suspended inside
  // renderConfigurationHtml awaiting the slow fetch. While suspended, the panel is disposed and a
  // fresh panel is installed. When the stale fetch resolves, the post-fetch guard
  // (this.panel !== panel) must fire and abort the write — stale html must NOT appear on either
  // panel (the fresh panel because the guard blocks it; the old panel because it is disposed).
  //
  // Observable: the fresh panel receives only freshHtml (one write). The stale step's fetch result
  // is discarded. We confirm this by counting writes to the fresh panel AND asserting the fresh
  // panel's final html is freshHtml, not staleHtml.
  //
  // Without the inner guard: the stale step would write staleHtml to `panel` (= firstPanel, the
  // panelAtEnqueue reference). However, because the freshReload's queue runs on the reset queue
  // (independent of the stale step's now-detached promise), both writes land and — crucially —
  // the stale step ALSO writes to the fresh panel when this.panel happened to equal panel at
  // render time. We construct the test so the stale step IS suspended mid-fetch while the fresh
  // panel is already installed, meaning `this.panel = freshPanel` at the inner guard check.
  // Without the guard, the write goes to `panel.webview.html` where panel = firstPanel (= firstWebview),
  // not freshWebview — so we assert that the stale write does NOT appear anywhere on the fresh panel
  // AND that the first panel only receives writes from before the dispose (none in this test).
  test('renderConfigurationHtml inner identity guard aborts stale write after panel is replaced mid-fetch', async () => {
    // Track writes to both panels to confirm the stale step wrote nothing anywhere after suspend.
    const firstWrites: string[] = [];
    const firstWebview = {
      get html(): string {
        return firstWrites[firstWrites.length - 1] ?? 'first-initial';
      },
      set html(v: string) {
        firstWrites.push(v);
      },
    };
    const freshWrites: string[] = [];
    const freshWebview = {
      get html(): string {
        return freshWrites[freshWrites.length - 1] ?? 'fresh-initial';
      },
      set html(v: string) {
        freshWrites.push(v);
      },
    };

    const staleHtml = '<html>stale-mid-fetch</html>';
    const freshHtml = '<html>fresh-after-reopen</html>';

    // The stale step passes the pre-fetch guard (panelAtEnqueue = firstPanel, this.panel = firstPanel
    // at execution time), then suspends inside renderConfigurationHtml on staleFetchPromise.
    let resolveStale!: (v: string | undefined) => void;
    const staleFetchPromise = new Promise<string | undefined>(resolve => {
      resolveStale = resolve;
    });

    const firstPanel = { webview: firstWebview } as unknown as vscode.WebviewPanel;
    provider['panel'] = firstPanel;

    const fetchStub = sinon
      .stub(provider as any, 'fetchConfigurationHtml')
      .onCall(0)
      .returns(staleFetchPromise) // stale step suspends here
      .onCall(1)
      .resolves(freshHtml); // fresh step completes immediately

    // Queue the stale reload. Because the queue is already resolved, its body starts immediately
    // as a microtask: passes the pre-fetch guard (this.panel = firstPanel = panelAtEnqueue), then
    // suspends on staleFetchPromise inside renderConfigurationHtml.
    const staleReload = provider.reloadIfOpen();

    // Yield enough microtask ticks for the stale step's body to run up to (and including)
    // the await on staleFetchPromise. The queue chain is .catch().then(body), so two ticks
    // are needed: one for .catch() to pass through, one for the .then(body) to start and
    // reach `await fetchConfigurationHtml()` (where it suspends on staleFetchPromise).
    // After these yields the stale step is suspended mid-fetch inside renderConfigurationHtml.
    await Promise.resolve();
    await Promise.resolve();

    // Self-verification: confirm the stale step has already called fetchConfigurationHtml
    // (i.e. it passed the pre-fetch guard and is suspended mid-fetch). If this assertion
    // fails, add more `await Promise.resolve()` ticks above until it holds — the test is
    // only meaningful when the stale step is genuinely suspended inside renderConfigurationHtml,
    // proving the INNER post-fetch identity guard (not the pre-fetch guard) is what fires.
    sinon.assert.calledOnce(fetchStub);

    // Dispose the panel and install a fresh one while the stale fetch is in-flight.
    provider['onPanelDispose']();
    provider['panel'] = { webview: freshWebview } as unknown as vscode.WebviewPanel;

    // Queue a fresh reload against the new panel.
    const freshReload = provider.reloadIfOpen();

    // Resolve the stale fetch. The stale renderConfigurationHtml call resumes.
    // Inner guard: this.panel = freshPanel ≠ panel (= firstPanel) → aborts (with fix).
    // Without the fix: the stale step writes staleHtml to firstPanel.webview.html (firstWrites).
    resolveStale(staleHtml);

    await staleReload;
    await freshReload;

    // With the inner guard: stale step aborted after fetch → firstWrites is empty.
    // Without the guard: stale step writes staleHtml to firstPanel → firstWrites = [staleHtml].
    strictEqual(
      firstWrites.length,
      0,
      'Stale mid-fetch html was written to the disposed first panel — inner identity guard is missing or broken',
    );
    // Fresh panel must show freshHtml and nothing stale.
    strictEqual(freshWrites.includes(staleHtml), false, 'staleHtml must not appear on the fresh panel');
    strictEqual(freshWrites[freshWrites.length - 1], freshHtml, 'Fresh panel must show freshHtml');

    fetchStub.restore();
  });
});
