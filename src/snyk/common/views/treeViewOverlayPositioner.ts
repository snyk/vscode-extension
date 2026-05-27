/**
 * Repositions the snyk-ls-emitted `.error-overlay` popup above the triggering
 * `.tree-node-error` row instead of below it. The LS places the overlay at
 * `row.bottom + 4`, which is clipped by the help panel when the error row is
 * at the bottom of the Snyk sidebar (IDE-1808).
 *
 * The LS-side `showErrorOverlay` lives inside an IIFE closure and cannot be
 * overridden directly, so we use a MutationObserver to detect when the
 * overlay is appended to `document.body` and rewrite its `top` style.
 */
export class TreeViewOverlayPositioner {
  /** Vertical gap (in px) between the overlay's bottom edge and the row's top. */
  static readonly GAP_PX = 4;

  /**
   * Returns the JS to inject into the tree-view webview. Assumes the script
   * runs after `document.body` exists (true when injected via `${ideScript}`
   * at end of body in the LS-emitted HTML).
   */
  static buildClientScript(): string {
    return `
      (function () {
        function computeOverlayTop(rowTop, overlayHeight, padding) {
          return Math.max(padding, rowTop - overlayHeight - padding);
        }
        function repositionAbove(overlay) {
          var errorRow = document.querySelector('.tree-node-error > .tree-node-row');
          if (!errorRow) return;
          var rowRect = errorRow.getBoundingClientRect();
          var overlayHeight = overlay.getBoundingClientRect().height;
          overlay.style.top = computeOverlayTop(rowRect.top, overlayHeight, ${TreeViewOverlayPositioner.GAP_PX}) + 'px';
        }
        var observer = new MutationObserver(function (mutations) {
          for (var i = 0; i < mutations.length; i++) {
            var added = mutations[i].addedNodes;
            for (var j = 0; j < added.length; j++) {
              var node = added[j];
              if (
                node &&
                node.nodeType === 1 &&
                node.classList &&
                node.classList.contains('error-overlay')
              ) {
                repositionAbove(node);
              }
            }
          }
        });
        observer.observe(document.body, { childList: true });
      })();
    `;
  }

  /**
   * Pure positioning math, exposed for unit testing.
   * Mirrors the inline `computeOverlayTop` in the client script — keep them
   * in sync.
   */
  static computeOverlayTop(rowTop: number, overlayHeight: number, padding = TreeViewOverlayPositioner.GAP_PX): number {
    return Math.max(padding, rowTop - overlayHeight - padding);
  }
}
