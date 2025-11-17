# Implementation Plan: Move MCP Configuration to Language Server

## Overview
Move MCP (Model Context Protocol) configuration logic from the VS Code extension to the language server and refactor analytics handling to use the language server's existing infrastructure.

## Goals
1. Move MCP configuration logic from `vscode-extension/src/snyk/cli/mcp/mcp.ts` to the language server
2. Remove special analytics handling in the configuration watcher and use language server's existing analytics infrastructure
3. Implement custom notification `$/snyk.configureSnykMCP` for IDE-specific MCP configuration that requires VS Code APIs

## Architecture

### Current State
- MCP configuration is handled entirely in the VS Code extension (`mcp.ts`)
- Configuration changes trigger MCP reconfiguration via `handleSecurityAtInceptionChange`
- Analytics for MCP config changes are sent from the extension using custom code
- Extension directly modifies IDE-specific config files (Cursor, Windsurf, VS Code)

### Target State
- Language server determines MCP configuration needs based on settings
- Language server sends `$/snyk.configureSnykMCP` notification with cmd, args, env
- IDE extension listens for notification and configures MCP using IDE-specific APIs
- Analytics for all config changes (including MCP) flow through language server's existing infrastructure

## Implementation Phases

### Phase 1: Planning ✓
- [x] Analyze current MCP configuration logic
- [x] Analyze current analytics flow
- [x] Identify files and packages to modify
- [x] Create implementation plan
- [x] Get approval for implementation plan

### Phase 2: Implementation (TDD)

#### Step 1: Add MCP configuration settings to Language Server [COMPLETE]
**Objective**: Add new configuration fields to the language server's Settings struct

**Files to modify**:
- `snyk-ls/internal/types/lsp.go`
- `snyk-ls/application/config/config.go`
- `snyk-ls/application/server/configuration.go`

**Actions**:
- [ ] Write tests for new configuration fields (in progress)
  - Test parsing `autoConfigureSnykMcpServer` from settings
  - Test parsing `secureAtInceptionExecutionFrequency` from settings
  - Test configuration change detection
- [ ] Add fields to `Settings` struct in `lsp.go`:
  - `AutoConfigureSnykMcpServer string` 
  - `SecureAtInceptionExecutionFrequency string`
- [ ] Add fields to `Config` struct in `config.go`:
  - `autoConfigureSnykMcpServer bool`
  - `secureAtInceptionExecutionFrequency string`
- [ ] Add getters/setters with proper locking
- [ ] Update `writeSettings` in `configuration.go` to handle new fields
- [ ] Add analytics for config changes using `analytics.SendConfigChangedAnalytics`
  - Call for `autoConfigureSnykMcpServer` changes
  - Call for `secureAtInceptionExecutionFrequency` changes
- [ ] Run tests: `make test`
- [ ] Run linter: `make lint`
- [ ] Fix any issues

#### Step 2: Create MCP configuration notification type [IN PROGRESS]
**Objective**: Define the notification structure for `$/snyk.configureSnykMCP`

**Files to modify**:
- `snyk-ls/internal/types/lsp.go`

**Actions**:
- [ ] Write tests for MCP configuration notification type (skipped)
- [ ] Add `SnykConfigureMcpParams` struct:
  ```go
  type SnykConfigureMcpParams struct {
    Command string            `json:"command"`
    Args    []string          `json:"args"`
    Env     map[string]string `json:"env"`
    IdeName string            `json:"ideName"` // "cursor", "windsurf", "vscode"
  }
  ```
- [ ] Run tests: `make test`
- [ ] Fix any issues

#### Step 3: Implement MCP configuration logic in Language Server
**Objective**: Move the MCP configuration logic from extension to LS

**Files to create**:
- `snyk-ls/application/config/mcp_config.go`
- `snyk-ls/application/config/mcp_config_test.go`

**Actions**:
- [ ] Write comprehensive tests for MCP configuration logic
  - Test detecting IDE type from integration environment
  - Test building MCP command and args
  - Test building MCP environment variables
  - Test triggering notification when config changes
- [ ] Create `mcp_config.go` with functions:
  - `shouldConfigureMcp(c *Config) bool` - check if MCP should be configured
  - `getMcpCommand(c *Config) string` - get CLI path
  - `getMcpArgs() []string` - return `["mcp", "-t", "stdio"]`
  - `getMcpEnv(c *Config) map[string]string` - build env vars (SNYK_CFG_ORG, SNYK_API, IDE_CONFIG_PATH, TRUSTED_FOLDERS)
  - `getIdeName(c *Config) string` - determine IDE from integration environment
  - `configureMcp(c *Config)` - main function to trigger configuration
- [ ] Integrate `configureMcp` into `UpdateSettings` in `configuration.go`
- [ ] Send analytics for MCP config changes using `analytics.SendConfigChangedAnalytics`
  - Example: `analytics.SendConfigChangedAnalytics(c, "autoConfigureSnykMcpServer", oldValue, newValue, triggerSource)`
  - Example: `analytics.SendConfigChangedAnalytics(c, "secureAtInceptionExecutionFrequency", oldValue, newValue, triggerSource)`
- [ ] Run tests: `make test`
- [ ] Run linter: `make lint`
- [ ] Fix any issues

#### Step 4: Register MCP configuration notification handler
**Objective**: Add notification handler to send MCP config to IDE

**Files to modify**:
- `snyk-ls/application/server/notification.go`

**Actions**:
- [ ] Write tests for notification registration
- [ ] Add case in `registerNotifier` switch statement:
  ```go
  case types.SnykConfigureMcpParams:
    notifier(c, srv, "$/snyk.configureSnykMCP", params)
    logger.Debug().Interface("mcpConfig", params).Msg("sending MCP config to client")
  ```
- [ ] Update `configureMcp` to send notification via `di.Notifier().Send()`
- [ ] Run tests: `make test`
- [ ] Fix any issues

#### Step 5: Update VS Code extension to handle MCP notification
**Objective**: Listen for `$/snyk.configureSnykMCP` and configure MCP

**Files to modify**:
- `vscode-extension/src/snyk/common/languageServer/languageServer.ts`
- `vscode-extension/src/snyk/cli/mcp/mcp.ts`

**Actions**:
- [ ] Write tests for notification handler
- [ ] Create interface for MCP config params in `languageServer.ts`:
  ```typescript
  interface McpConfigParams {
    command: string;
    args: string[];
    env: Record<string, string>;
    ideName: string;
  }
  ```
- [ ] Register notification handler in `LanguageServer` class
- [ ] Refactor `mcp.ts`:
  - Keep IDE-specific configuration functions
  - Remove configuration change detection (now in LS)
  - Remove analytics sending (now in LS)
  - Create new function `handleMcpConfigNotification(params: McpConfigParams)`
  - Delegate to appropriate IDE-specific function based on `ideName`
- [ ] Run tests: `npm run test:unit`
- [ ] Run tests: `npm run test:integration`
- [ ] Run linter: `npm run lint:fix`
- [ ] Fix any issues

#### Step 6: Remove redundant analytics code from extension
**Objective**: Remove special analytics handling for MCP config changes

**Files to modify**:
- `vscode-extension/src/snyk/common/configuration/securityAtInceptionHandler.ts`
- `vscode-extension/src/snyk/common/watchers/configurationWatcher.ts`

**Actions**:
- [ ] Write/update tests for configuration handling
- [ ] In `securityAtInceptionHandler.ts`:
  - Remove `sendConfigChangedAnalytics` function (lines 71-88)
  - Remove calls to `sendConfigChangedAnalytics` (lines 42-49, 58-65)
  - Keep memento state tracking
  - Simplify to only call `configureMcpHosts` when needed
- [ ] In `configurationWatcher.ts`:
  - Configuration change handling remains the same
  - Analytics will now be sent by LS automatically
- [ ] Run tests: `npm run test:unit`
- [ ] Run linter: `npm run lint:fix`
- [ ] Fix any issues

#### Step 7: Add configuration settings to extension settings sync
**Objective**: Ensure new settings are synced to LS

**Files to check/modify**:
- `vscode-extension/src/snyk/common/languageServer/languageServer.ts`

**Actions**:
- [ ] Verify settings sync includes MCP configuration fields
- [ ] Add if missing: `autoConfigureSnykMcpServer` and `secureAtInceptionExecutionFrequency`
- [ ] Run tests: `npm run test:unit`
- [ ] Fix any issues

#### Step 8: Update documentation
**Objective**: Document the new MCP configuration flow

**Files to create/modify**:
- `snyk-ls/docs/mcp-configuration.md`
- `vscode-extension/docs/` (if exists)

**Actions**:
- [ ] Create mermaid diagram for MCP configuration flow
- [ ] Document the notification protocol
- [ ] Document IDE-specific configuration requirements
- [ ] Run `make generate-diagrams` (for snyk-ls)
- [ ] Add to implementation plan

### Phase 3: Review

#### Step 1: Code Review
- [ ] Self-review all changes
- [ ] Ensure all tests pass
- [ ] Ensure no new linting errors
- [ ] Verify test coverage >= 80%

#### Step 2: Integration Testing
- [ ] Test MCP configuration in VS Code
- [ ] Test MCP configuration in Cursor
- [ ] Test MCP configuration in Windsurf
- [ ] Test configuration changes trigger reconfiguration
- [ ] Test analytics are sent correctly
- [ ] Verify rules publishing still works

#### Step 3: Security Scanning
- [ ] Run `snyk_code_scan` on both repositories
- [ ] Run `snyk_sca_scan` on both repositories (if dependencies changed)
- [ ] Fix any security issues found

#### Step 4: Final Cleanup
- [ ] Remove any temporary test files
- [ ] Update CHANGELOG entries
- [ ] Verify no implementation plan files are staged for commit

## Progress Tracking

### Current Status
- Phase: Implementation (Phase 2)
- Step: Step 1 - Add MCP configuration settings to Language Server
- Next: Write tests for new configuration fields

### Completed Steps
- [x] Initial analysis
- [x] Implementation plan creation
- [x] Plan approval received

### In Progress
- [ ] Phase 2, Step 1: Add MCP configuration settings to Language Server

### Blocked
- None

## Technical Details

### MCP Environment Variables
```typescript
// Built by language server, sent to IDE
{
  SNYK_CFG_ORG?: string,        // From config.organization
  SNYK_API?: string,              // From config.snykApiEndpoint  
  IDE_CONFIG_PATH?: string,       // IDE name from integration environment
  TRUSTED_FOLDERS?: string        // Semicolon-separated trusted folders
}
```

### Notification Flow
```
Configuration Change
  ↓
LS: workspace/didChangeConfiguration handler
  ↓
LS: UpdateSettings
  ↓
LS: Detect MCP config change
  ↓
LS: Send analytics (using existing infrastructure)
  ↓
LS: Send $/snyk.configureSnykMCP notification
  ↓
IDE: Receive notification
  ↓
IDE: Call IDE-specific configuration function
  ↓
IDE: Configure MCP (file writes, API calls, etc.)
```

### Files Summary

**Language Server (snyk-ls)**:
- `internal/types/lsp.go` - Add Settings fields and notification type
- `application/config/config.go` - Add config fields and methods
- `application/config/mcp_config.go` - New: MCP configuration logic
- `application/config/mcp_config_test.go` - New: Tests
- `application/server/configuration.go` - Update settings handler
- `application/server/notification.go` - Register notification
- `docs/mcp-configuration.md` - New: Documentation

**VS Code Extension (vscode-extension)**:
- `src/snyk/common/languageServer/languageServer.ts` - Add notification handler
- `src/snyk/cli/mcp/mcp.ts` - Refactor to handle notifications
- `src/snyk/common/configuration/securityAtInceptionHandler.ts` - Remove analytics
- `src/snyk/common/watchers/configurationWatcher.ts` - Simplify (analytics now in LS)

## Testing Strategy

### Unit Tests
- **Language Server**:
  - Configuration field parsing
  - MCP environment building
  - MCP command/args generation
  - IDE name detection
  - Notification sending
  
- **Extension**:
  - Notification handler registration
  - MCP configuration delegation
  - IDE-specific configuration (with mocks)

### Integration Tests
- **Language Server**:
  - Configuration change triggers MCP notification
  - Analytics sent on config change
  
- **Extension**:
  - Notification received triggers configuration
  - Configuration changes persist correctly

### E2E Tests (Manual)
- Test in VS Code with Copilot
- Test in Cursor
- Test in Windsurf
- Verify MCP servers appear correctly
- Verify rules are published correctly

## Commit Strategy

Atomic commits for each step:
1. `feat: add MCP configuration settings to language server [ISSUE-ID]`
2. `feat: add MCP configuration notification type [ISSUE-ID]`
3. `feat: implement MCP configuration logic in language server [ISSUE-ID]`
4. `feat: register MCP configuration notification handler [ISSUE-ID]`
5. `feat: add MCP notification handler to VS Code extension [ISSUE-ID]`
6. `refactor: remove redundant MCP analytics from extension [ISSUE-ID]`
7. `chore: update MCP configuration documentation [ISSUE-ID]`

## Notes
- No issue ID found in current branch (main)
- This is a cross-repository change (snyk-ls + vscode-extension)
- Must maintain backwards compatibility during transition
- Analytics flow changes but analytics data remains the same
- IDE-specific logic remains in extension (can't move file I/O and API calls to LS)

