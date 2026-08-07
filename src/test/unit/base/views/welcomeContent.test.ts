import { ok, strictEqual } from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { SNYK_SETTINGS_COMMAND } from '../../../../snyk/common/constants/commands';
import { SNYK_VIEW_WELCOME } from '../../../../snyk/common/constants/views';

type ViewsWelcomeContribution = {
  view: string;
  contents: string;
  when?: string;
};

// The settings cog in the view title bar is only rendered while the tree view is hovered or focused,
// so the logged out panels have to expose the settings page through their own content.
suite('Welcome view content', () => {
  let loggedOutContributions: ViewsWelcomeContribution[];

  setup(() => {
    const packageJsonPath = path.resolve(__dirname, '../../../../..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
      contributes: { viewsWelcome: ViewsWelcomeContribution[] };
    };

    loggedOutContributions = packageJson.contributes.viewsWelcome.filter(
      contribution =>
        contribution.view === SNYK_VIEW_WELCOME && contribution.contents.includes('Connect & Trust Workspace'),
    );
  });

  test('finds the Connect & Trust panels', () => {
    strictEqual(loggedOutContributions.length, 2);
  });

  test('Connect & Trust panels link to the Snyk settings page', () => {
    for (const contribution of loggedOutContributions) {
      ok(
        contribution.contents.includes(`](command:${SNYK_SETTINGS_COMMAND}`),
        `expected a settings link in welcome content for "${contribution.when ?? ''}"`,
      );
    }
  });
});
