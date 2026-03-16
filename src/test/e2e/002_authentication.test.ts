import { ok } from 'assert';
import { getExtension } from '../../extension';
import { LanguageServer } from '../../snyk/common/languageServer/languageServer';
import { configuration } from '../../snyk/common/configuration/instance';
import { SNYK_CONTEXT } from '../../snyk/common/constants/views';
import { DID_CHANGE_CONFIGURATION_METHOD } from '../../snyk/common/constants/languageServer';
import { TestEnvVars } from '../testConstants';
import { assertEventually } from '../util/testUtils';

suite('Authentication', () => {
  test('not logged in initially (in-memory secret storage is empty)', () => {
    const ext = getExtension();
    ok(ext, 'Extension instance should exist');
    const loggedIn = ext.contextService.viewContext[SNYK_CONTEXT.LOGGEDIN];
    ok(!loggedIn, `Should not be logged in yet (loggedIn=${String(loggedIn)})`);
  });

  test('CORE: set token via secret storage, LS authenticates, loggedIn becomes true', async function () {
    this.timeout(30_000);

    // runE2ETests.ts moves SNYK_TOKEN -> TestEnvVars.TOKEN so the LS starts unauthenticated.
    const token = process.env[TestEnvVars.TOKEN];
    ok(
      token && token.length > 0,
      'SNYK_TOKEN must be set when launching E2E tests (runE2ETests.ts moves it to the internal env var)',
    );

    // authenticationMethod is already set to "API Token (Legacy)" in .vscode/settings.json

    // Store token in secret storage (same as "Snyk: Set Token" without the input box)
    await configuration.setToken(token);

    // Tell LS to re-read config so it picks up the new token
    const lc = (getExtension()['languageServer'] as LanguageServer)['client'];
    await lc.sendNotification(DID_CHANGE_CONFIGURATION_METHOD, {});

    // Wait for LS to authenticate and send $/snyk.hasAuthenticated -> sets loggedIn=true
    const ext = getExtension();
    ok(ext, 'Extension instance should exist');
    await assertEventually(
      () => ext.contextService.viewContext[SNYK_CONTEXT.LOGGEDIN] === true,
      20_000,
      200,
      'loggedIn should become true after setting the token',
    );
  });
});
