/**
 * Repositions the snyk-ls-emitted `.error-overlay` popup above the triggering
 * `.tree-node-error` row when there's room above; otherwise leaves the LS-
 * positioned-below result alone. This fixes IDE-1808 where the overlay was
 * clipped by the help panel when the Secrets row sat at the bottom of the
 * sidebar.
 *
 * The LS-side `showErrorOverlay` lives inside an IIFE closure and cannot be
 * overridden directly, so we use a MutationObserver to detect when the
 * overlay is appended to `document.body` and rewrite its `top` style.
 *
 * This DOM-poking shim is a fallback — the canonical error path is the
 * native `snyk.showScanErrorDetails` command that the LS dispatches in
 * parallel (snyk-ls tree.js:403). Track removal of this shim once snyk-ls
 * fixes its own flip-above logic (snyk-ls tree.js:127-129).
 */

/** Minimal subset of `Document` consumed by `repositionOverlayInDoc`. Exposed
 *  so tests can drive the function with a hand-rolled mock instead of pulling
 *  in jsdom. */
export interface RepositionDocLike {
  querySelector(selector: string): RepositionElementLike | null;
}

/** Minimal subset of `HTMLElement` consumed by `repositionOverlayInDoc`. */
export interface RepositionElementLike {
  getBoundingClientRect(): { top: number; height: number };
  style: { top: string };
}

/**
 * Pure positioning math, exposed for unit testing. Clamps the computed top
 * to `padding` so the overlay never escapes the top of the viewport.
 */
export function computeOverlayTop(rowTop: number, overlayHeight: number, padding: number): number {
  return Math.max(padding, rowTop - overlayHeight - padding);
}

/**
 * Core DOM logic: find the trigger error row in `doc`, decide whether there's
 * room above for `overlay`, and rewrite `overlay.style.top` if so. No-op when:
 *   - no `.tree-node-error > .tree-node-row` exists, or
 *   - there isn't enough vertical room above the row (the LS-positioned-below
 *     result stays — only the bottom-clipping case is "fixed").
 *
 * Preferred selector is `.tree-node-error > .tree-node-row.selected` (the LS
 * calls `selectNodeRow(row)` immediately before `showErrorOverlay`, so the
 * trigger row carries `.selected`). Falls back to the first match when no
 * selection class is present (defensive).
 */
export function repositionOverlayInDoc(doc: RepositionDocLike, overlay: RepositionElementLike, padding: number): void {
  const errorRow =
    doc.querySelector('.tree-node-error > .tree-node-row.selected') ||
    doc.querySelector('.tree-node-error > .tree-node-row');
  if (!errorRow) return;

  const rowRect = errorRow.getBoundingClientRect();
  const overlayHeight = overlay.getBoundingClientRect().height;
  if (overlayHeight <= 0) return;

  // Only reposition when there's actual room above. Otherwise the clamp would
  // place the overlay's top at `padding` and the overlay's body would extend
  // downward over the row — replacing one clipping bug with an overlap bug.
  // The LS already placed the overlay below; leave that alone in that case.
  if (rowRect.top - overlayHeight - padding < padding) return;

  overlay.style.top = `${computeOverlayTop(rowRect.top, overlayHeight, padding)}px`;
}

export class TreeViewOverlayPositioner {
  /** Vertical gap (in px) between the overlay's bottom edge and the row's top. */
  static readonly GAP_PX = 4;

  /**
   * Returns the JS to inject into the tree-view webview. Stringifies the
   * exported helpers so the live script and the unit-tested TS share a single
   * source of truth.
   */
  static buildClientScript(): string {
    return `
      (function () {
        if (window.__snykOverlayPositioner__) return;
        window.__snykOverlayPositioner__ = true;
        var computeOverlayTop = ${computeOverlayTop.toString()};
        var repositionOverlayInDoc = ${repositionOverlayInDoc.toString()};
        var GAP_PX = ${TreeViewOverlayPositioner.GAP_PX};
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
                repositionOverlayInDoc(document, node, GAP_PX);
              }
            }
          }
        });
        if (document.body) {
          observer.observe(document.body, { childList: true });
        } else {
          document.addEventListener('DOMContentLoaded', function () {
            observer.observe(document.body, { childList: true });
          });
        }
      })();
    `;
  }
}
