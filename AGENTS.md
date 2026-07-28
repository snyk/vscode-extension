# AGENTS.md

Agent guidance for the Snyk VS Code extension. See `CLAUDE.md` and
`CONTRIBUTING.md` for general contributor/build docs; this file adds
Cursor-Cloud-specific environment notes.

## Cursor Cloud specific instructions

Environment notes for Cursor Cloud agents (dependencies are pre-installed by the
startup update script; the caveats below are the non-obvious bits).

- **Node/npm:** `/exec-daemon/node` is first on `PATH` but ships **no npm**. Use
  the nvm-managed Node `22.22.3` (nvm default, provides npm `11.12.1`) by
  prepending `PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"` before running
  `npm`. `.nvmrc` names `18.19`, but the project has no Node engine restriction
  and builds/tests fine on Node 22.
- **Build:** `npm run build` (`tsc -p ./` + `sass media`) → `out/`.
- **Lint:** `npm run lint` (`eslint "src/**/*.ts"`) — currently warnings only.
- **Unit tests:** `npm run test:unit` (mocha over `out/test/unit`, ~446 tests,
  green).
- **Integration tests** (`npm run test:integration`) download a full VS Code
  instance and need a display (xvfb); the download host is blocked in the
  sandbox, so run these outside Cursor Cloud.
