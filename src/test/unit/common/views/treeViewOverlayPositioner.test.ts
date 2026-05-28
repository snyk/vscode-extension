import { deepStrictEqual, doesNotThrow, ok, strictEqual } from 'assert';
import {
  attachLiveListeners,
  computeOverlayTop,
  LiveWindowLike,
  repositionOverlayInDoc,
  RepositionDocLike,
  RepositionElementLike,
  TreeViewOverlayPositioner,
} from '../../../../snyk/common/views/treeViewOverlayPositioner';

function mockElement(top: number, height: number): RepositionElementLike {
  return {
    getBoundingClientRect: () => ({ top, height }),
    style: { top: '', bottom: '', transform: '' },
  };
}

function mockDoc(matches: Record<string, RepositionElementLike | null>): RepositionDocLike {
  return {
    querySelector: (selector: string) => matches[selector] ?? null,
  };
}

suite('TreeViewOverlayPositioner', () => {
  suite('computeOverlayTop', () => {
    test('places the overlay above the row with the requested gap', () => {
      strictEqual(computeOverlayTop(500, 120, 4), 376);
    });

    test('clamps to the padding when the overlay would go off the top of the viewport', () => {
      strictEqual(computeOverlayTop(20, 100, 4), 4);
    });

    test('handles negative rowTop (row scrolled above viewport)', () => {
      strictEqual(computeOverlayTop(-50, 100, 4), 4);
    });

    test('preserves fractional inputs', () => {
      strictEqual(computeOverlayTop(500.5, 120.25, 4), 376.25);
    });
  });

  suite('repositionOverlayInDoc', () => {
    const GAP = 4;

    test('rewrites overlay.style.top when there is room above the row', () => {
      const row = mockElement(500, 24);
      const overlay = mockElement(0, 120);
      repositionOverlayInDoc(mockDoc({ '.tree-node-error > .tree-node-row.selected': row }), overlay, GAP);
      strictEqual(overlay.style.top, '376px');
    });

    test('prefers the .selected row when multiple .tree-node-error rows exist', () => {
      const selectedRow = mockElement(500, 24); // the one the user clicked
      const firstRow = mockElement(100, 24); // a different error product, would have been picked by querySelector previously
      const overlay = mockElement(0, 120);
      repositionOverlayInDoc(
        mockDoc({
          '.tree-node-error > .tree-node-row.selected': selectedRow,
          '.tree-node-error > .tree-node-row': firstRow,
        }),
        overlay,
        GAP,
      );
      // 500 - 120 - 4 = 376 (selected row), NOT 4 (clamp from firstRow at y=100 with 120-tall overlay)
      strictEqual(overlay.style.top, '376px');
    });

    test('falls back to the first .tree-node-error row when none is .selected', () => {
      const firstRow = mockElement(500, 24);
      const overlay = mockElement(0, 120);
      repositionOverlayInDoc(
        mockDoc({
          '.tree-node-error > .tree-node-row.selected': null,
          '.tree-node-error > .tree-node-row': firstRow,
        }),
        overlay,
        GAP,
      );
      strictEqual(overlay.style.top, '376px');
    });

    test('does nothing when no error row exists (early return)', () => {
      const overlay = mockElement(0, 120);
      repositionOverlayInDoc(mockDoc({}), overlay, GAP);
      strictEqual(overlay.style.top, '', 'overlay.style.top must not be mutated');
    });

    test('does nothing when there is no room above (would overlap the row)', () => {
      // Row near top of viewport, overlay too tall to fit above it.
      const row = mockElement(20, 24);
      const overlay = mockElement(0, 100);
      repositionOverlayInDoc(mockDoc({ '.tree-node-error > .tree-node-row': row }), overlay, GAP);
      // Leave the LS-positioned-below result alone — replacing bottom-clip with row-overlap would be no better.
      strictEqual(overlay.style.top, '', 'overlay.style.top must not be mutated when overlay would overlap the row');
    });

    test('does nothing when overlay height is reported as zero (pre-layout race)', () => {
      // MutationObserver can fire before children/icons lay out, leaving height=0.
      const row = mockElement(500, 24);
      const overlay = mockElement(0, 0);
      repositionOverlayInDoc(mockDoc({ '.tree-node-error > .tree-node-row': row }), overlay, GAP);
      strictEqual(overlay.style.top, '', 'must not write a wrong top from a zero-height measurement');
    });

    test('clears bottom and transform when writing top to defend against opposing-anchor stretch', () => {
      // Simulate a future LS revision that anchored the overlay with `bottom`
      // or a transform — without clearing them, our `top` write would stretch
      // the overlay between two anchors.
      const row = mockElement(500, 24);
      const overlay: RepositionElementLike = {
        getBoundingClientRect: () => ({ top: 0, height: 120 }),
        style: { top: '', bottom: '20px', transform: 'translateY(10px)' },
      };
      repositionOverlayInDoc(mockDoc({ '.tree-node-error > .tree-node-row': row }), overlay, GAP);
      strictEqual(overlay.style.top, '376px');
      strictEqual(overlay.style.bottom, '', 'bottom anchor must be cleared');
      strictEqual(overlay.style.transform, '', 'transform anchor must be cleared');
    });

    test('does NOT clear bottom/transform when the early-return branch is taken', () => {
      // If we decide not to reposition (no row, no room, zero height), we
      // must also leave the existing anchor styles untouched so we don't
      // disturb whatever the LS set.
      const overlay: RepositionElementLike = {
        getBoundingClientRect: () => ({ top: 0, height: 120 }),
        style: { top: '', bottom: '20px', transform: 'translateY(10px)' },
      };
      repositionOverlayInDoc(mockDoc({}), overlay, GAP);
      strictEqual(overlay.style.bottom, '20px', 'bottom must not be touched on early return');
      strictEqual(overlay.style.transform, 'translateY(10px)', 'transform must not be touched on early return');
    });
  });

  suite('attachLiveListeners', () => {
    type Event = 'resize';

    function mockWindow(withResizeObserver: boolean): LiveWindowLike & {
      listeners: Map<Event, Set<() => void>>;
      observerInstances: Array<{ observed: unknown[]; disconnected: boolean }>;
    } {
      const listeners = new Map<Event, Set<() => void>>();
      const observerInstances: Array<{ observed: unknown[]; disconnected: boolean }> = [];

      const win: LiveWindowLike & {
        listeners: Map<Event, Set<() => void>>;
        observerInstances: Array<{ observed: unknown[]; disconnected: boolean }>;
      } = {
        listeners,
        observerInstances,
        addEventListener(event: Event, handler: () => void) {
          if (!listeners.has(event)) listeners.set(event, new Set());
          listeners.get(event)?.add(handler);
        },
        removeEventListener(event: Event, handler: () => void) {
          listeners.get(event)?.delete(handler);
        },
      };

      if (withResizeObserver) {
        win.ResizeObserver = class {
          private record: { observed: unknown[]; disconnected: boolean };
          constructor(_cb: () => void) {
            this.record = { observed: [], disconnected: false };
            observerInstances.push(this.record);
          }
          observe(el: unknown) {
            this.record.observed.push(el);
          }
          disconnect() {
            this.record.disconnected = true;
          }
        } as unknown as LiveWindowLike['ResizeObserver'];
      }

      return win;
    }

    test('attaches a window resize listener and observes the overlay when ResizeObserver is available', () => {
      const win = mockWindow(true);
      const overlay = {};
      let calls = 0;
      attachLiveListeners(win, overlay, () => calls++);

      strictEqual(win.listeners.get('resize')?.size, 1, 'must register exactly one resize listener');
      strictEqual(win.observerInstances.length, 1, 'must create exactly one ResizeObserver');
      deepStrictEqual(win.observerInstances[0].observed, [overlay], 'observer must observe the overlay element');
    });

    test('teardown removes the resize listener and disconnects the ResizeObserver', () => {
      const win = mockWindow(true);
      const teardown = attachLiveListeners(win, {}, () => undefined);
      teardown();

      strictEqual(win.listeners.get('resize')?.size ?? 0, 0, 'resize listener must be removed');
      strictEqual(win.observerInstances[0].disconnected, true, 'ResizeObserver must be disconnected');
    });

    test('teardown is idempotent — calling more than once is a no-op', () => {
      const win = mockWindow(true);
      const teardown = attachLiveListeners(win, {}, () => undefined);
      teardown();
      doesNotThrow(() => teardown(), 'second teardown call must not throw');
    });

    test('reposition callback fires when the window resize listener is invoked', () => {
      const win = mockWindow(false);
      let calls = 0;
      attachLiveListeners(win, {}, () => calls++);
      const handlers = Array.from(win.listeners.get('resize') ?? []);
      handlers[0]();
      strictEqual(calls, 1, 'resize must trigger reposition');
    });

    test('skips the ResizeObserver branch when the environment does not provide one', () => {
      const win = mockWindow(false);
      attachLiveListeners(win, {}, () => undefined);
      strictEqual(win.observerInstances.length, 0, 'must not construct an observer when none is available');
    });
  });

  suite('buildClientScript', () => {
    const script = TreeViewOverlayPositioner.buildClientScript();

    test('is syntactically valid JavaScript', () => {
      // Catches typos, missing braces, or template-literal escape errors that
      // would otherwise only surface in the webview at runtime. The Function
      // constructor parses (but does not execute) the script body.
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      doesNotThrow(() => new Function(script), 'buildClientScript() output must parse as a function body');
    });

    test('targets the snyk-ls error-overlay class', () => {
      ok(script.includes("'error-overlay'"), 'Script must look up the LS-emitted overlay class');
    });

    test('installs a MutationObserver on document.body to watch for overlay insertions', () => {
      ok(script.includes('MutationObserver'), 'Script must use a MutationObserver');
      ok(script.includes('document.body'), 'Observer must be attached to document.body');
      ok(script.includes('childList: true'), 'Observer must watch childList');
    });

    test('guards against double-registration via a window-scoped singleton flag', () => {
      ok(script.includes('window.__snykOverlayPositioner__'), 'Script must guard re-injection');
    });

    test('handles the document.body-not-ready edge case', () => {
      ok(script.includes('DOMContentLoaded'), 'Script must defer observer registration if body is null');
    });

    test('wires live listeners and tears them down on overlay removal', () => {
      ok(script.includes('attachLiveListeners'), 'Script must call attachLiveListeners on overlay insertion');
      ok(script.includes('removedNodes'), 'Script must watch removedNodes to tear listeners down');
    });
  });
});
