// Shared constants for test infrastructure.

/** Env var names used across test infrastructure. */
export const TestEnvVars = {
  /** When 'true', prevents LS initialization during tests. */
  INTEGRATION_MODE: 'SNYK_VSCE_TEST_INTEGRATION_MODE',
  /** JSON-stringified Mocha CLI args passed from runTest.ts to index.ts. */
  MOCHA_CLI_ARGS: 'SNYK_VSCE_TEST_MOCHA_CLI_ARGS',
  /** Snyk API token for E2E auth tests. Set automatically by runE2ETests.ts
   *  from SNYK_TOKEN — callers should set SNYK_TOKEN, not this directly. */
  TOKEN: 'SNYK_VSCE_TEST_TOKEN',
  /** When set, integration tests use a 60s timeout instead of Mocha's default. */
  DEVELOPMENT: 'SNYK_VSCE_DEVELOPMENT',
  /** Path to a local CLI binary. Injected into user-data settings before launch
   *  (sets cliPath + disables automatic dependency management). */
  CLI_PATH: 'SNYK_VSCE_TEST_CLI_PATH',
  /** CLI release channel (e.g. 'preview'). Injected into user-data settings before launch,
   *  overriding the default 'stable' channel for CLI download. */
  CLI_RELEASE_CHANNEL: 'SNYK_VSCE_TEST_CLI_RELEASE_CHANNEL',
} as const;
