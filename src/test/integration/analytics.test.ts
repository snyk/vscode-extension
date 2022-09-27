import { strictEqual } from 'assert';
import { configuration } from '../../snyk/common/configuration/instance';
import * as vscode from 'vscode';
import { VSCODE_VIEW_CONTAINER_COMMAND } from '../../snyk/common/constants/commands';
import * as sinon from 'sinon';
import itly from '../../ampli';

suite('Analytics', () => {
  let welcomeIsViewed: sinon.SinonSpy;

  setup(async () => {
    await configuration.clearToken();
    await configuration.setShouldReportEvents(true);

    welcomeIsViewed = sinon.spy(itly, 'welcomeIsViewed');
  });

  teardown(() => {
    welcomeIsViewed.restore();
  });

  test('"Welcome Is Viewed" is tracked if telemetry is on', async () => {
    await vscode.commands.executeCommand(VSCODE_VIEW_CONTAINER_COMMAND);

    strictEqual(welcomeIsViewed.called, true);
    strictEqual(welcomeIsViewed.calledOnce, true);
  });

  test('"Welcome Is Viewed" not tracked if telemetry is off', async () => {
    await configuration.setShouldReportEvents(false);

    await vscode.commands.executeCommand('workbench.action.toggleSidebarVisibility');
    await vscode.commands.executeCommand(VSCODE_VIEW_CONTAINER_COMMAND);

    strictEqual(welcomeIsViewed.notCalled, true);
  });
});
