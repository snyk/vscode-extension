/**
 * Pure HTML-string assembly for the tree-view webview. Substitutes the
 * `${ideStyle}` and `${ideScript}` placeholders in the LS-emitted HTML.
 *
 * The IDE-injected script (e.g. the executeCommand bridge in
 * `treeViewWebviewScript.ts`) MUST be concatenated BEFORE the overlay
 * positioner script so the latter can rely on `__ideExecuteCommand__`
 * being defined. The dedicated unit test pins this ordering.
 * @internal
 */
export function composeTreeViewHtml(
  html: string,
  nonce: string,
  ideScript: string,
  overlayPositionerScript: string,
): string {
  return html
    .replace('${ideStyle}', `<style nonce="${nonce}"></style>`)
    .replace('${ideScript}', `<script nonce="${nonce}">${ideScript}${overlayPositionerScript}</script>`)
    .replace(/\${nonce}/g, nonce);
}
