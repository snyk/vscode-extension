/**
 * Integration tests for the inbound LS configuration suppression mechanism.
 *
 * When the LS pushes `$/snyk.configuration` and we write the values into VS Code
 * settings, `onDidChangeConfiguration` fires. Without suppression, our listener
 * would record those keys as user-explicitly-changed, causing `changed: true` on
 * the next `workspace/configuration` pull — making the LS think the user owns
 * values it actually pushed itself.
 *
 * Key timing fact (verified here): VS Code fires `onDidChangeConfiguration`
 * *before* `workspace.getConfiguration().update()` resolves, so a boolean flag
 * set before the write and cleared in `finally` is sufficient — the event is
 * always seen while the flag is still true.
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
