import { ok, strictEqual } from 'assert';
import { TreeViewOverlayPositioner } from '../../../../snyk/common/views/treeViewOverlayPositioner';

suite('TreeViewOverlayPositioner', () => {
  suite('computeOverlayTop', () => {
    test('places the overlay above the row with a small gap', () => {
      // Row at y=500, overlay 120 tall, gap 4 → overlay top = 500 - 120 - 4 = 376
      strictEqual(TreeViewOverlayPositioner.computeOverlayTop(500, 120, 4), 376);
    });

    test('clamps to the padding when the overlay would go off the top of the viewport', () => {
      // Row near top (y=20), overlay 100 tall → would be -84, clamped to 4
      strictEqual(TreeViewOverlayPositioner.computeOverlayTop(20, 100, 4), 4);
    });

    test('also clamps when the row is exactly at the padding height', () => {
      // Row at y=4, overlay 50 tall → would be -50, clamped to 4
      strictEqual(TreeViewOverlayPositioner.computeOverlayTop(4, 50, 4), 4);
    });

    test('uses the default 4px gap when padding is omitted', () => {
      strictEqual(TreeViewOverlayPositioner.computeOverlayTop(200, 60), 136);
    });
  });

  suite('buildClientScript', () => {
    let script: string;

    setup(() => {
      script = TreeViewOverlayPositioner.buildClientScript();
    });

    test('targets the error row via .tree-node-error > .tree-node-row', () => {
      ok(
        script.includes('.tree-node-error > .tree-node-row'),
        'Script must look up the error row to position relative to',
      );
    });

    test('listens for overlay insertions via a MutationObserver on document.body', () => {
      ok(script.includes('MutationObserver'), 'Script must use a MutationObserver');
      ok(script.includes('document.body'), 'Observer must be attached to document.body');
      ok(script.includes('childList: true'), 'Observer must watch childList');
    });

    test('only repositions elements with the error-overlay class', () => {
      ok(script.includes("classList.contains('error-overlay')"), 'Script must filter for .error-overlay nodes');
    });

    test('writes the new top using the same clamping formula as computeOverlayTop', () => {
      // The inline JS function must match the exported pure function.
      ok(
        script.includes('Math.max(padding, rowTop - overlayHeight - padding)'),
        'Inline computeOverlayTop must mirror the exported pure function',
      );
    });

    test('uses the GAP_PX constant so the inline math stays in sync with the exported helper', () => {
      ok(script.includes(`, ${TreeViewOverlayPositioner.GAP_PX})`), 'Script must pass GAP_PX as the padding argument');
    });
  });
});
