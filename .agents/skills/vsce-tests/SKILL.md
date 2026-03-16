---
name: vsce-tests
description: Running tests for the Snyk VS Code extension (snyk/vscode-extension). Use when asked to run unit, integration, or E2E tests for the Snyk VSCE.
---

# VS Code Extension Tests

## Test Commands

| Suite | Command | Notes |
|-------|---------|-------|
| Unit | `npm run test:unit` | Mocha TDD, runs in Node (no VS Code host) |
| Integration | `npm run test:integration` | Launches VS Code via `@vscode/test-electron` with LS disabled |
| E2E | `SNYK_TOKEN="..." npm run test:e2e` | Launches VS Code via `@vscode/test-electron` with real LS, requires `SNYK_TOKEN` |

All commands include `npm run rebuild` automatically.

## Filtering Tests

All suites support `-- --grep` to filter by test or suite name. All args after `--` are forwarded to Mocha.

```bash
# Unit — filter by name
npm run test:unit -- --grep 'FeatureFlagService'

# Integration — filter by suite or test name
npm run test:integration -- --grep 'changing org'

# Integration — with extra mocha args
npm run test:integration -- --grep 'Simultaneous' --timeout 0

# E2E — filter by name
SNYK_TOKEN="..." npm run test:e2e -- --grep 'authentication'
```

## Unit: Single File Shortcut

```bash
npm run test:unit:single -- 'src/test/unit/path/to/file.test.ts'
```

This uses `ts-node/register` so it runs from source (no rebuild needed).

## E2E: `SNYK_TOKEN`

**DO NOT check whether `SNYK_TOKEN` is set.** Do not echo it, test it, or gate the command on it. Just run `npm run test:e2e` directly — the test harness itself will fail with a clear error if the token is missing.

**If you have a memory of the 1Password item name**, inline it:

```bash
SNYK_TOKEN="$( op item get "${OP_ITEM_NAME_FOR_SNYK_TOKEN}" --field credential --reveal )" npm run test:e2e
```

Replace `${OP_ITEM_NAME_FOR_SNYK_TOKEN}` with the item name from your memory.

**If you have no memory of the item name**, just run:

```bash
npm run test:e2e
```

The token is expected to already be in the environment (e.g. from the user's shell profile).

If the test fails with `"ERROR: SNYK_TOKEN env var must be set to run E2E tests."`, ask the user for the token or 1Password item name, save it as a memory, then re-run the test with the inline above from then on.

## E2E: Core Tests

Regardless of `--grep`, all tests prefixed with `"CORE: "` always run in E2E.

## Logs (Integration & E2E)

Both integration and E2E test runners print the **exthost log directory** at the start and end of the run. Look for lines like:

```
Exthost directory: /path/to/.vscode-test/user-data/logs/<timestamp>/window1/exthost
```

Inside that directory, under `output_logging_<timestamp>/`, you'll find:
- **`<N>-Snyk Security.log`** — the extension's output log
- **`<N>-Snyk Language Server.log`** — the LS output log

The `<N>` prefix is a sequence number assigned by VS Code and is **not fixed** — look for files matching the name, not a specific number.

## Environment Variables

See `src/test/testConstants.ts` for the canonical list of test env var names (`TestEnvVars`).

| Variable | Used By | Purpose |
|----------|---------|---------|
| `SNYK_TOKEN` | E2E | Auth token for real LS — **required** |
| `SNYK_LOG_LEVEL` | Integration, E2E | LS log level (defaults to `info`) |
| `SNYK_VSCE_DEVELOPMENT` | Integration, E2E | Sets 60s test timeout when set |
| `SNYK_VSCE_TEST_CLI_PATH` | E2E | Path to a local CLI binary — skips download entirely |
| `SNYK_VSCE_TEST_CLI_RELEASE_CHANNEL` | E2E | CLI release channel (e.g. `preview`) — overrides default `stable` |

### User-Data Settings Reset

Both integration and E2E runners **reset** `.vscode-test/user-data/User/settings.json` to `{}` before every launch. This prevents stale machine-scoped settings (e.g. `cliPath`, `trustedFolders`) from leaking between runs.

### E2E: CLI Binary Configuration

By default E2E tests download the CLI from the `stable` release channel. If `ls-protocol-version-N` isn't published yet on `stable`, the download will 403 and LS won't start.

**Use a local binary** (skips download completely):
```bash
SNYK_VSCE_TEST_CLI_PATH="/path/to/snyk-macos-arm64" npm run test:e2e
```

**Use the preview channel** (if the version exists there):
```bash
SNYK_VSCE_TEST_CLI_RELEASE_CHANNEL="preview" npm run test:e2e
```

These are injected into `.vscode-test/user-data/User/settings.json` as the relevant Snyk VS Code Extension settings before launch.
