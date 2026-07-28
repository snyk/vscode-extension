# AGENTS.md

The primary agent guidance for this repository lives in [CLAUDE.md](CLAUDE.md)
(project overview, build/dev/test/lint commands, architecture). Read that first.
This file adds only Cursor Cloud environment notes.

## Cursor Cloud specific instructions

Durable, non-obvious notes for agents running in the Cursor Cloud Linux VM. The
update script already runs `npm ci`; the items below are setup context and
gotchas, not install steps to repeat.

- **Node comes from nvm, not `/exec-daemon/node`.** `/exec-daemon/node` is first
  on `PATH` but ships **no npm**. Use the clean `v22.22.3`. The repo `.nvmrc`
  pins `18.19`, but Node 22 works and there is no `engine-strict` restriction, so
  22.22.3 is fine. **Always prepend** `PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"`
  before any `npm` command — nvm is not auto-sourced in non-interactive shells.
- **Standard commands** (see [CLAUDE.md](CLAUDE.md)): `npm run build`
  (`tsc -p ./` + sass → `out/`); `npm run lint` (eslint — warnings only, 0 errors);
  `npm run test:unit` (mocha over `out/test/unit` → 446 passing). Run `npm run build`
  before `npm run test:unit`.
- **`npm run test:integration` cannot run here.** It downloads a full VS Code
  build and needs a display (xvfb); the download host is blocked in the VM. Run it
  outside Cursor Cloud.
- **Reachable:** `registry.npmjs.org`, `github.com`. This extension is a thin UI
  over the `snyk-ls` language server (see the `snyk-ls` repo for the backend).
