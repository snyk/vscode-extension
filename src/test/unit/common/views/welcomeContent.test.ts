import { strict as assert } from 'assert';
import { getWelcomeMarkdown, renderWelcomeHtml } from '../../../../snyk/common/views/welcomeContent';
import { WelcomeWebviewViewProvider } from '../../../../snyk/common/views/welcomeWebviewProvider';
import { SNYK_CONTEXT } from '../../../../snyk/common/constants/views';
import { IContextService } from '../../../../snyk/common/services/contextService';

function makeContextService(viewContext: { [key: string]: unknown }): IContextService {
  return {
    viewContext,
    onDidChangeContext: () => ({ dispose: () => undefined }),
    shouldShowCodeAnalysis: false,
    shouldShowOssAnalysis: false,
    shouldShowIacAnalysis: false,
    setContext: async () => undefined,
  };
}

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

  test('returns error content when extension is in error state', () => {
    const markdown = getWelcomeMarkdown({
      [SNYK_CONTEXT.ERROR]: new Error('boom'),
      [SNYK_CONTEXT.INITIALIZED]: true,
    });

    assert.match(markdown, /Snyk has encountered a problem/);
  });

  test('prefers authenticating content when re-authenticating', () => {
    const markdown = getWelcomeMarkdown({
      [SNYK_CONTEXT.INITIALIZED]: true,
      [SNYK_CONTEXT.LOGGEDIN]: false,
      [SNYK_CONTEXT.AUTHENTICATION_METHOD_CHANGED]: true,
      [SNYK_CONTEXT.AUTHENTICATING]: true,
    });

    assert.match(markdown, /redirecting you to our auth page/);
    assert.doesNotMatch(markdown, /authentication method has changed/);
  });

  test('returns auth method changed content when not authenticating', () => {
    const markdown = getWelcomeMarkdown({
      [SNYK_CONTEXT.INITIALIZED]: true,
      [SNYK_CONTEXT.LOGGEDIN]: false,
      [SNYK_CONTEXT.AUTHENTICATION_METHOD_CHANGED]: true,
      [SNYK_CONTEXT.AUTHENTICATING]: false,
    });

    assert.match(markdown, /authentication method has changed/);
  });

  test('returns no workspace content when logged in without workspace', () => {
    const markdown = getWelcomeMarkdown({
      [SNYK_CONTEXT.INITIALIZED]: true,
      [SNYK_CONTEXT.LOGGEDIN]: true,
      [SNYK_CONTEXT.WORKSPACE_FOUND]: false,
    });

    assert.match(markdown, /Open a workspace or a folder/);
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

suite('WelcomeWebviewViewProvider', () => {
  function makeWebviewView() {
    let html = '';
    return {
      webview: {
        options: {} as Record<string, unknown>,
        get html() {
          return html;
        },
        set html(value: string) {
          html = value;
        },
      },
    };
  }

  test('re-renders content when VS Code resolves a new webview instance', () => {
    const provider = new WelcomeWebviewViewProvider(
      makeContextService({
        [SNYK_CONTEXT.INITIALIZED]: true,
        [SNYK_CONTEXT.LOGGEDIN]: false,
      }),
    );

    const firstView = makeWebviewView();
    provider.resolveWebviewView(firstView as never);
    assert.match(firstView.webview.html, /Let's secure your code!/);

    const secondView = makeWebviewView();
    provider.resolveWebviewView(secondView as never);
    assert.match(secondView.webview.html, /Let's secure your code!/);
  });

  test('skips redundant refresh for the same webview instance and content', () => {
    const provider = new WelcomeWebviewViewProvider(
      makeContextService({
        [SNYK_CONTEXT.INITIALIZED]: true,
        [SNYK_CONTEXT.LOGGEDIN]: false,
      }),
    );
    const webviewView = makeWebviewView();

    provider.resolveWebviewView(webviewView as never);
    const firstHtml = webviewView.webview.html;

    provider.refresh();
    assert.strictEqual(webviewView.webview.html, firstHtml);
  });
});
