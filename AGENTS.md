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
- **`npm run test:integration` needs two things — check, don't assume.** It downloads
  a full VS Code build from `update.code.visualstudio.com` (which 302-redirects to
  `vscode.download.prss.microsoft.com`) and needs a display. Both have been available
  in cloud VMs — that download host has been reachable, and the VMs have run XFCE on
  `DISPLAY=:1` — so verify before writing these tests off; only fall back to running
  them outside Cursor Cloud if a probe shows the host blocked or there is no display.
- **Driving the extension end-to-end is the strongest proof**, since building and unit
  tests do not show that the extension works in a running editor. `code` is not
  installed on the VM: fetch the stable tarball from `update.code.visualstudio.com`,
  extract it, then launch the extension development host with
  `DISPLAY=:1 <vscode>/bin/code --extensionDevelopmentPath=<repo> --user-data-dir=/tmp/vscode-userdata --no-sandbox --password-store=basic <project>`.
  Set `snyk.advanced.cliPath`, uncheck `snyk.advanced.automaticDependencyManagement`
  and set `snyk.authenticationMethod` to the token method, then supply the token via
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
