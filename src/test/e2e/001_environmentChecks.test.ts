import * as vscode from 'vscode';
import { ok } from 'assert';
import { assertEventually } from '../util/testUtils';
import { getExtension } from '../../extension';
import { configuration } from '../../snyk/common/configuration/instance';

suite('Environment checks', () => {
  test('CORE: workspace folder is open', () => {
    const folders = vscode.workspace.workspaceFolders;
    ok(folders && folders.length > 0, 'Should have at least one workspace folder');
  });

  test('CORE: extension activated', () => {
    const ext = getExtension();
    ok(ext, 'Extension instance should exist');
    ok(ext.context['acquireContext']().extension.isActive, 'Extension should be active');
  });

  test('CORE: Language Server is ready', async function () {
    // May need to download the CLI on first run, so allow a long timeout
    const timeout = 60_000;
    this.timeout(timeout + 10_000);

    await assertEventually(
      () => configuration.getFolderConfigs().length > 0,
      timeout,
      500,
      'LS should become ready (folder configs populated by initial LS notification)',
    );
  });
});
