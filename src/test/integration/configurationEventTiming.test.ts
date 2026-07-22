/**
 * Integration tests for the inbound LS configuration suppression mechanism.
 *
 * When the LS pushes `$/snyk.configuration` and we write the values into VS Code
 * settings, `onDidChangeConfiguration` fires. Without suppression, our listener
 * would record those keys as user-explicitly-changed, causing `changed: true` on
 * the next `workspace/configuration` pull — making the LS think the user owns
 * values it actually pushed itself.
 *
 * Timing fact (verified here): in THIS environment, VS Code fires
 * `onDidChangeConfiguration` *before* `workspace.getConfiguration().update()`
 * resolves, so a boolean flag set before the write and cleared in `finally` is
 * sufficient here — the event is seen while the flag is still true.
 *
 * This is NOT a universal guarantee. IDE-2264 found real-world cases where the
 * write and the change-event broadcast are two separate round-trips (a
 * settings.json write, then a later file-watcher-driven config refresh), so a
 * synchronous-scoped boolean silently missed the event and misattributed the
 * write. Production code (`ConfigurationPersistenceService`) does NOT rely on
 * the synchronous timing this test observes — it uses a write-time tag
 * (`markPendingInboundWrite`/`consumePendingInboundWrite`) that survives an
 * arbitrarily delayed event instead. This test only documents that, in this
 * environment, the simpler timing also happens to hold; it is not the
 * mechanism the production code depends on.
 */
import { strictEqual } from 'assert';
import vscode from 'vscode';
import { OSS_ENABLED_SETTING } from '../../snyk/common/constants/settings';

suite('onDidChangeConfiguration timing relative to updateConfiguration', () => {
  const [configId, ...sectionParts] = OSS_ENABLED_SETTING.split('.');
  const section = sectionParts.join('.');

  test('suppression flag prevents marking LS-pushed keys as user-changed', async () => {
    let markedAsExplicit = false;
    let suppress = false;

    const disposable = vscode.workspace.onDidChangeConfiguration(e => {
      if (suppress) return;
      if (e.affectsConfiguration(OSS_ENABLED_SETTING)) markedAsExplicit = true;
    });

    try {
      suppress = true;
      await vscode.workspace.getConfiguration(configId).update(section, false, vscode.ConfigurationTarget.Global);
      // Wait well past any file-watcher debounce to confirm no delayed second event slips through.
      await new Promise(resolve => setTimeout(resolve, 300));
      suppress = false;

      disposable.dispose();

      // Restore after dispose so the restore write doesn't affect the assertion.
      await vscode.workspace.getConfiguration(configId).update(section, true, vscode.ConfigurationTarget.Global);

      strictEqual(markedAsExplicit, false, 'LS-pushed key was incorrectly marked as user-changed');
    } finally {
      disposable.dispose();
    }
  });
});
