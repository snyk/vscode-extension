# Implementation Plan: Replace Axios with VSCode HTTP Client

## Objective
Replace axios HTTP client with VSCode's built-in HTTP client that respects VSCode proxy settings for downloading the Snyk CLI.

## Current State Analysis
- Axios is used in `src/snyk/cli/staticCliApi.ts` and `src/snyk/common/download/downloader.ts`
- Proxy configuration is handled in `src/snyk/common/proxy.ts`
- Downloads are performed in `downloader.ts` with progress tracking

## Implementation Steps

### Step 1: Create VSCode HTTP Client Module
- Create a new module `src/snyk/common/vscodeHttpClient.ts`
- Implement functions to handle HTTP requests using Node.js built-in `https` module
- Ensure proxy settings are read from VSCode's configuration
- Support streaming downloads with progress tracking

### Step 2: Update Static CLI API
- Modify `src/snyk/cli/staticCliApi.ts`
- Replace axios imports with new VSCode HTTP client
- Update `getLatestCliVersion()` method
- Update `downloadBinary()` method
- Update `getSha256Checksum()` method

### Step 3: Update Downloader Module
- Modify `src/snyk/common/download/downloader.ts`
- Replace axios imports and usage
- Update download stream handling
- Maintain cancellation token support
- Keep progress reporting functionality

### Step 4: Update Proxy Module
- Modify `src/snyk/common/proxy.ts`
- Remove axios-specific configuration
- Keep proxy detection logic for VSCode HTTP client
- Ensure compatibility with existing proxy settings

### Step 5: Update Tests
- Update unit tests in `test/unit/download/downloader.test.ts`
- Update unit tests for staticCliApi if they exist
- Mock new HTTP client instead of axios
- Ensure all test cases pass

### Step 6: Clean Up Dependencies
- Remove axios from `package.json`
- Run `npm install` to update `package-lock.json`

### Step 7: Testing & Validation
- Run unit tests: `npm run test:unit`
- Run integration tests: `npm run test:integration`
- Run linter: `npm run lint:fix`
- Run Snyk security scans

## Atomic Commits Plan
1. feat: create VSCode HTTP client module with proxy support
2. refactor: replace axios with VSCode HTTP client in staticCliApi
3. refactor: update downloader to use VSCode HTTP client
4. refactor: clean up proxy module and remove axios dependencies
5. test: update unit tests for new HTTP client
6. chore: remove axios from package.json and update dependencies
7. docs: update CHANGELOG.md with migration details

## Key Considerations
- Maintain backward compatibility with existing proxy settings
- Preserve download progress reporting
- Support cancellation tokens
- Handle SSL certificate validation
- Ensure proper error handling and logging 