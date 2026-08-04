import { SNYK_CONTEXT } from '../constants/views';

export type WelcomeViewContext = {
  [key: string]: unknown;
};

const WELCOME_CONTENT = {
  error: `Snyk has encountered a problem. Please restart the extension:
[Restart](command:snyk.restart 'Restart Snyk')
If the error persists, please check your [settings](command:snyk.settings) and [contact us](https://snyk.io/contact-us/?utm_source=vsc).

 You can check the logs to see the exact error in [Snyk Security](command:snyk.showOutputChannel) and [Snyk Language Server](command:snyk.showLsOutputChannel) output channels.
[Display Error](command:snyk.showErrorFromContext)`,
  loading: '👋 Welcome to Snyk for Visual Studio Code.\n⏱️ Please wait, the extension is loading...',
  connectAndTrust: `👋 Let's secure your code!
To scan your project for issues, Snyk needs to:
 1. Connect to your Snyk account: This allows us to securely analyse your code.
2. Trust this workspace: This lets Snyk safely gather information about your project (like dependencies).
You should only scan projects you trust. [More info](https://docs.snyk.io/ide-tools/visual-studio-code-extension/workspace-trust)
By connecting your account with Snyk, you agree to the Snyk [Privacy Policy](https://snyk.io/policies/privacy), and the Snyk [Terms of Service](https://snyk.io/policies/terms-of-service).

[Connect & Trust Workspace](command:snyk.initiateLogin 'Connect with Snyk')`,
  authMethodChanged: `⚠️ Your authentication method has changed.

👉 Please re-authenticate to continue using Snyk

By connecting your account with Snyk, you agree to the Snyk [Privacy Policy](https://snyk.io/policies/privacy), and the Snyk [Terms of Service](https://snyk.io/policies/terms-of-service).

[Connect & Trust Workspace](command:snyk.initiateLogin 'Re-authenticate')`,
  authenticating: `We are now redirecting you to our auth page, go ahead and log in. If a browser window doesn't open after a few seconds, please copy the url below and manually paste it in a browser.
[Copy URL to clipboard](command:snyk.copyAuthLink 'Copy URL to clipboard')`,
  noWorkspace: 'Open a workspace or a folder in Visual Studio Code to start the analysis.',
} as const;

export function getWelcomeMarkdown(viewContext: WelcomeViewContext): string {
  if (viewContext[SNYK_CONTEXT.ERROR]) {
    return WELCOME_CONTENT.error;
  }

  if (!viewContext[SNYK_CONTEXT.INITIALIZED]) {
    return WELCOME_CONTENT.loading;
  }

  if (!viewContext[SNYK_CONTEXT.LOGGEDIN]) {
    if (viewContext[SNYK_CONTEXT.AUTHENTICATION_METHOD_CHANGED]) {
      return WELCOME_CONTENT.authMethodChanged;
    }
    if (viewContext[SNYK_CONTEXT.AUTHENTICATING]) {
      return WELCOME_CONTENT.authenticating;
    }
    return WELCOME_CONTENT.connectAndTrust;
  }

  if (!viewContext[SNYK_CONTEXT.WORKSPACE_FOUND]) {
    return WELCOME_CONTENT.noWorkspace;
  }

  return WELCOME_CONTENT.loading;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderInlineMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(/\[([^\]]+)\]\((command:[^)\s]+)(?:\s+'[^']*')?\)/g, '<a href="$2">$1</a>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
}

export function renderWelcomeHtml(markdown: string): string {
  const blocks = markdown.split('\n\n');
  const htmlBlocks = blocks.map(block => {
    const lines = block.split('\n');
    const renderedLines = lines.map(line => {
      const trimmed = line.trim();
      if (/^\[[^\]]+\]\(command:[^)]+\)$/.test(trimmed)) {
        const match = trimmed.match(/^\[([^\]]+)\]\((command:[^)\s]+)(?:\s+'[^']*')?\)$/);
        if (!match) {
          return `<p>${renderInlineMarkdown(line)}</p>`;
        }
        return `<p class="welcome-button"><a class="welcome-button-link" href="${match[2]}">${escapeHtml(
          match[1],
        )}</a></p>`;
      }
      return `<p>${renderInlineMarkdown(line)}</p>`;
    });
    return renderedLines.join('');
  });

  return htmlBlocks.join('');
}
