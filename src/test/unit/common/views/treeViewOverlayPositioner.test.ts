import { doesNotThrow, ok, strictEqual } from 'assert';
import {
  computeOverlayTop,
  repositionOverlayInDoc,
  RepositionDocLike,
  RepositionElementLike,
  TreeViewOverlayPositioner,
} from '../../../../snyk/common/views/treeViewOverlayPositioner';

function mockElement(top: number, height: number): RepositionElementLike & { selectorTag: string } {
  return {
    selectorTag: '',
    getBoundingClientRect: () => ({ top, height }),
    style: { top: '' },
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
  });
});
