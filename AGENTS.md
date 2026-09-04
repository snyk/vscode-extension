## Project Overview

Snyk Security VS Code extension — TypeScript extension that integrates Snyk scanning (Code/SAST, Open Source/SCA, IaC, Secrets) into VS Code via a Language Server (`snyk-ls`). Repository: `snyk/vscode-extension`.

## Build & Development Commands

```bash
npm install                # Install dependencies
npm run build              # Compile TypeScript + SCSS (same as vscode:prepublish)
npm run rebuild            # Clean + build
npm run watch-all          # Watch TS + SCSS concurrently

# Testing
npm run test:unit          # Rebuild + run all unit tests (mocha TDD)
npm run test:unit:watch    # Unit tests in watch mode
npm run test:unit:single -- src/test/unit/path/to/file.test.ts  # Single test file (ts-node, no rebuild needed)
npm run test:integration   # Rebuild + run integration tests (vscode-test-electron)

# Linting
npm run lint               # ESLint check
npm run lint:fix           # ESLint auto-fix
npm run knip               # Unused exports/files/deps check
```

Unit tests use Mocha TDD UI (`describe`/`it`) with Sinon for mocking.

Before committing: run `npm run lint:fix` and `npm run knip`.

## Architecture

### Layered Structure

```
src/extension.ts          → activate/deactivate (delegates to SnykExtension)
src/snyk/extension.ts     → SnykExtension (main class, initializes everything)
src/snyk/base/modules/baseSnykModule.ts → Service composition, constructor DI
src/snyk/common/          → Shared services, configuration, VS Code adapters, constants
src/snyk/snykCode/        → Snyk Code (SAST) product
src/snyk/snykOss/         → Snyk Open Source (SCA) product
src/snyk/snykIac/         → Infrastructure as Code product
src/snyk/snykSecrets/     → Secrets detection product
src/snyk/cli/             → CLI binary interaction
```

Package-by-feature organization: each product owns its views, services, and types. Shared code goes in `common/` by concern.

### Language Server Integration

The extension communicates with `snyk-ls` (Go binary, downloaded at runtime) via LSP/JSON-RPC:

- **Inbound notifications**: `$/snyk.configuration` (settings from LS), `$/snyk.scan` (scan results), `$/snyk.showIssueDetail`
- **Outbound**: `workspace/didChangeConfiguration` (push), `workspace/configuration` (pull via middleware)
- Configuration flows through GAF → snyk-ls ConfigResolver → `LspConfigurationParam` → IDE. See `docs/configuration-gaf-ls-ide-flow.md` for the full merge chain.
- Middleware in the LanguageClient intercepts configuration requests to convert to `LspConfigurationParam` format.
- Explicit key tracking (`lastKnownValueCache` + `ExplicitOverridesMap`) prevents feedback loops when persisting LS-originated settings.

Key LS files:
- `src/snyk/common/languageServer/languageServer.ts` — LanguageClient lifecycle
- `src/snyk/common/languageServer/types.ts` — LSP types and `LspConfigurationParam`
- `src/snyk/common/languageServer/settings.ts` — `LanguageServerSettings` (config serialization)
- `src/snyk/common/languageServer/lsConfigurationListener.ts` — Inbound config handler

### Service & DI Pattern

No DI framework. Services instantiated in `BaseSnykModule` constructor and passed via constructor injection. Key services:
- `AuthenticationService` — OAuth2/PAT/token management
- `Configuration` (singleton) — VS Code settings access
- `LanguageServer` — LSP client lifecycle
- `CommandController` — Routes and debounces VS Code commands
- `ProductService<T>` — Base class for each scan product (subscribes to LS scan results, manages tree views/diagnostics)

### State & Events

- **VS Code Context keys**: `snyk:loggedIn`, `snyk:initialized`, `snyk:codeEnabled`, etc. — control command/view visibility
- **RxJS Observables**: Async event streams for scan results and issues
- **Configuration change watchers**: File, editor, and workspace configuration listeners

## Conventions

- **Interfaces**: `I<EntityName>` (e.g., `IProductService`, `IAuthenticationService`)
- **Commands**: `SNYK_<ACTION>_COMMAND` constants (e.g., `SNYK_START_COMMAND`)
- **Context keys**: `SNYK_CONTEXT.<ALL_CAPS>` (e.g., `SNYK_CONTEXT.LOGGEDIN`)
- **Files**: camelCase. **Classes**: PascalCase.
- **Tests**: Mirror source structure under `src/test/unit/`. Test file = `<source>.test.ts`.
- **VS Code adapters**: Wrappers in `src/snyk/common/vscode/` enable unit testing without VS Code runtime.

## Development Workflow

- Read the Jira issue description/acceptance criteria before starting non-trivial work; update the Jira ticket with a progress comment as you go. Never commit an implementation plan or its diagrams to the repo.
- This is not a library: delete unused files instead of deprecating them.
- Use Sinon for mocking; reuse existing mocks rather than hand-rolling new ones.
- Run `npm run lint:fix` (fixing only issues in changed files) and the full test suite (`npm run test:unit` and `npm run test:integration`) before committing.
- Run Snyk SCA/Code scans against the project's absolute path before committing and after `package.json`/`package-lock.json` changes; fix real findings, don't touch test fixtures. Check third-party package health with Snyk Advisor (`curl`) before adding a new dependency.
- Before each commit, check for and address feedback from the PR review bot (snyk-pr-review-bot) on any open PR.
- Add a summary of user-facing changes to the changelog for the next release (usually a minor semver bump); never edit past changelog entries.
- Keep `./docs` up to date.
- Never use `--no-verify` or otherwise skip commit hooks, and never amend commits. Use atomic, conventional-commit-style commits; if a Jira ID (`IDE-XXXX`) appears in the branch name, append it to the subject.
- Never push without asking first, and never force-push. Regularly fetch `main` and offer to merge it into the working branch.
- After pushing, offer to open a draft PR using `.github/pull_request_template.md` (or update the existing PR description) with a title/description generated from the diff against `main`.

## Cursor Cloud specific instructions

Durable, non-obvious notes for agents running in the Cursor Cloud Linux VM. The
update script already runs `npm ci`, so the items below are setup context and
gotchas rather than install steps to repeat.

- **Node comes from nvm, not `/exec-daemon/node`.** `/exec-daemon/node` is first on
  `PATH` but ships **no npm**. Use the nvm-managed Node install (currently
  `v22.22.3`, providing npm `11.12.1`) and **always prepend**
  `PATH="$(ls -d "$HOME"/.nvm/versions/node/v22.* 2>/dev/null | sort -V | tail -1)/bin:$PATH"`
  before any `npm` command, resolving the installed patch version rather than
  hardcoding it — nvm is not auto-sourced in non-interactive shells, and a future VM
  snapshot bumping the patch version would otherwise silently fall through to
  `/exec-daemon/node`, which has no npm. `.nvmrc` pins `18.19`, but
  `package.json` declares no Node `engines` constraint (only `vscode`), and the
  project builds and tests fine on Node 22.
- **`npm run test:integration` should run on a saved GUI environment — do not assume it
  cannot.** It uses `@vscode/test-electron`, which downloads its **own** VS Code build to
  `.vscode-test/` from `update.code.visualstudio.com` (302-redirects to
  `vscode.download.prss.microsoft.com`) — this is separate from the `~/vscode` dev-host
  install below. It needs a display. On a GUI VM both prerequisites hold (download host
  reachable, XFCE on `DISPLAY=:1`, and `/dev/shm` remounted to 2G), and the suite passes
  (confirmed passing previously). Only fall back to running it outside Cursor Cloud if a
  probe actually shows the host blocked or there is no display.
- **Driving the extension end-to-end is the strongest proof**, since building and unit
  tests do not show that the extension works in a running editor. On a saved GUI
  environment VS Code is already installed by the update script at **`~/vscode/bin/code`**
  — use that; do **not** download a fresh tarball unless setup failed and the binary is
  missing (the update script's log will say why). Launch the extension development host with
  `DISPLAY=:1 ~/vscode/bin/code --extensionDevelopmentPath=<repo> --user-data-dir=/tmp/vscode-userdata --no-sandbox --password-store=basic <project>`.
  Set `snyk.advanced.cliPath`, uncheck `snyk.advanced.automaticDependencyManagement`
  and set `snyk.advanced.authenticationMethod` to `"API Token (Legacy)"`, then supply the token via
  the Command Palette (`Snyk: Set Token`). The panel's *Trust folder* button has been
  unreliable — setting `"snyk.trustedFolders": ["<project>"]` in
  `<user-data-dir>/User/settings.json` and reloading is the dependable route.
- **Three headless-Linux launch failures, none of which names its own cause.** They apply
  to `npm run test:integration` as well, since that drives a real VS Code:
  - **`--password-store=basic` is required.** Without it there is no keyring for VS Code's
    secret storage to talk to, so `Snyk: Set Token` cannot persist a token and
    authentication silently never completes.
  - **`renderer process gone (reason: crashed, code: 4)` is a `/dev/shm` problem, not an
    extension bug.** Chromium needs more than the 64 MB some VMs default to, and the real
    error underneath is `font_data_service_impl.cc: Check failed: No space left on
    device`. Fix with `sudo mount -o remount,size=2G /dev/shm`, which lasts for the life
    of that VM only, so it must be re-applied on each new one.
  - **A silent exit with no output** means a killed instance left a stale
    `~/.config/Code/code.lock` or `*.sock` behind; remove them before relaunching. Shut
    the dev host down cleanly, and after any `kill`, clean those up first.
- **Authentication does not come from the environment.** The extension passes the
  token it holds in its own settings to the language server, so neither the ambient
  `SNYK_TOKEN` nor the CLI's `~/.config/configstore` authenticates it — running
  `snyk auth` in a terminal has no effect here. Use the API-token method rather than
  OAuth2, whose browser flow times out in this environment. If `cliPath` is left
  unset the extension downloads its own CLI/LS from `downloads.snyk.io` /
  `static.snyk.io`, which also works.
- **This extension is a thin UI over the `snyk-ls` language server.** Scan results,
  configuration merging and product behaviour are implemented there — when
  something looks wrong in the UI, confirm which side owns it before digging here.
- **Probe egress instead of trusting a host list.** The allowlist changes between
  runs, so treat any reachable/blocked list — including in older revisions of this
  section — as stale. Matching is per hostname, and a bare entry is apex-exact
  while `*.example.com` covers subdomains only, so an apex host has to be
  allowlisted in its own right. A block surfaces as a TLS reset mid-handshake
  rather than a DNS failure, so check a host directly before concluding anything:
  `timeout 12 openssl s_client -connect update.code.visualstudio.com:443 -servername update.code.visualstudio.com </dev/null`.
  The hosts worth probing for this repo are `registry.npmjs.org`, `github.com`,
  and the two VS Code download hosts above if you need integration tests.
