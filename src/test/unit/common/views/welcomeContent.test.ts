import { strict as assert } from 'assert';
import { getWelcomeMarkdown, renderWelcomeHtml } from '../../../../snyk/common/views/welcomeContent';
import { SNYK_CONTEXT } from '../../../../snyk/common/constants/views';

suite('welcomeContent', () => {
  test('returns connect and trust content when logged out and initialized', () => {
    const markdown = getWelcomeMarkdown({
      [SNYK_CONTEXT.INITIALIZED]: true,
      [SNYK_CONTEXT.LOGGEDIN]: false,
      [SNYK_CONTEXT.AUTHENTICATION_METHOD_CHANGED]: false,
      [SNYK_CONTEXT.AUTHENTICATING]: false,
    });

    assert.match(markdown, /Let's secure your code!/);
    assert.match(markdown, /Connect & Trust Workspace/);
  });

  test('returns loading content before initialization', () => {
    const markdown = getWelcomeMarkdown({
      [SNYK_CONTEXT.INITIALIZED]: false,
    });

    assert.match(markdown, /Please wait, the extension is loading/);
  });

  test('renders command links and primary action button', () => {
    const html = renderWelcomeHtml(
      "Intro text\n\n[Connect & Trust Workspace](command:snyk.initiateLogin 'Connect with Snyk')",
    );

    assert.match(html, /href="command:snyk.initiateLogin"/);
    assert.match(html, /welcome-button-link/);
    assert.match(html, /Connect &amp; Trust Workspace/);
  });
});
