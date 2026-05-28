import { ok, strictEqual } from 'assert';
import { composeTreeViewHtml } from '../../../../snyk/common/views/treeViewHtmlComposer';

suite('composeTreeViewHtml', () => {
  const NONCE = 'abc123';
  const TEMPLATE = '<html><head>${ideStyle}</head><body>${ideScript}<!--n=${nonce}--></body></html>';

  test('substitutes the ideStyle placeholder with a nonced empty <style>', () => {
    const result = composeTreeViewHtml(TEMPLATE, NONCE, '', '');
    ok(result.includes(`<style nonce="${NONCE}"></style>`), 'must inject nonced <style> for ${ideStyle}');
    ok(!result.includes('${ideStyle}'), '${ideStyle} placeholder must be replaced');
  });

  test('substitutes the ideScript placeholder with a nonced <script> containing both bundles', () => {
    const result = composeTreeViewHtml(TEMPLATE, NONCE, '/*LS_BUNDLE*/', '/*POSITIONER*/');
    ok(result.includes(`<script nonce="${NONCE}">`), 'must inject nonced <script>');
    ok(result.includes('/*LS_BUNDLE*/'), 'must include the LS bundle');
    ok(result.includes('/*POSITIONER*/'), 'must include the overlay positioner script');
    ok(!result.includes('${ideScript}'), '${ideScript} placeholder must be replaced');
  });

  test('places the IDE bundle BEFORE the overlay positioner so the positioner can rely on it', () => {
    const result = composeTreeViewHtml(TEMPLATE, NONCE, '/*LS_BUNDLE*/', '/*POSITIONER*/');
    const ls = result.indexOf('/*LS_BUNDLE*/');
    const pos = result.indexOf('/*POSITIONER*/');
    ok(ls > -1 && pos > -1, 'both bundles must appear in the output');
    ok(ls < pos, `LS bundle (index ${ls}) must appear before positioner (index ${pos})`);
  });

  test('replaces every ${nonce} occurrence with the supplied nonce', () => {
    const result = composeTreeViewHtml(TEMPLATE, NONCE, '', '');
    ok(result.includes(`<!--n=${NONCE}-->`), 'remaining ${nonce} occurrences must be substituted');
    ok(!result.includes('${nonce}'), 'no ${nonce} placeholder may remain in the output');
  });

  test('uses the nonce inside both the style and the script tag', () => {
    const result = composeTreeViewHtml(TEMPLATE, NONCE, '', '');
    const styleMatches = result.match(new RegExp(`<style nonce="${NONCE}"`, 'g'));
    const scriptMatches = result.match(new RegExp(`<script nonce="${NONCE}"`, 'g'));
    strictEqual(styleMatches?.length, 1, 'exactly one nonced <style> tag');
    strictEqual(scriptMatches?.length, 1, 'exactly one nonced <script> tag');
  });
});
