# AGENTS.md

The primary agent guidance for this repository lives in [CLAUDE.md](CLAUDE.md)
(project overview, build/dev/test/lint commands, architecture) and
[CONTRIBUTING.md](CONTRIBUTING.md) — read those first. This file adds only Cursor
Cloud environment notes.

## Cursor Cloud specific instructions

Durable, non-obvious notes for agents running in the Cursor Cloud Linux VM. The
update script already runs `npm ci`, so the items below are setup context and
gotchas rather than install steps to repeat.

- **Node comes from nvm, not `/exec-daemon/node`.** `/exec-daemon/node` is first on
  `PATH` but ships **no npm**. Use the nvm-managed `v22.22.3` (which provides npm
  `11.12.1`) and **always prepend**
  `PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"` before any `npm` command —
  nvm is not auto-sourced in non-interactive shells. `.nvmrc` pins `18.19`, but
  `package.json` declares no Node `engines` constraint (only `vscode`), and the
  project builds and tests fine on Node 22.
- **Standard commands** are in [CLAUDE.md](CLAUDE.md): `npm run build`
  (`tsc -p ./` plus sass, output in `out/`), `npm run lint` (eslint — warnings
  only, 0 errors), and `npm run test:unit` (mocha over `out/test/unit`, ~446
  passing). Run `npm run build` before `npm run test:unit`: the unit tests execute
  compiled output from `out/`, so a stale build produces misleading results.
- **`npm run test:integration` cannot run here.** It downloads a full VS Code build
  from `update.code.visualstudio.com` (which 302-redirects to
  `vscode.download.prss.microsoft.com`) and needs a display via xvfb. Unless both
  hosts are allowlisted and a display is available, run it outside Cursor Cloud.
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
