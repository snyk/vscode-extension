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
```

Unit tests use Mocha TDD UI (`describe`/`it`) with Sinon for mocking.

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
- Explicit key tracking (`lsOriginatedKeys`) prevents feedback loops when persisting LS-originated settings.

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
