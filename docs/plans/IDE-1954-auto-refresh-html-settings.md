<!-- sub-plan: linked from docs/plans/PLAN.md -->

# IDE-1954 — Auto-refresh the HTML settings page

**Ticket:** IDE-1954
**Branch:** `feat/IDE-1954_auto-refresh-html-settings`
**Status:** Planning

## Problem

When the language server pushes a `$/snyk.configuration` notification (e.g. settings changed
elsewhere — another window, an org/scope change, or LS-side defaults resolving), the open HTML
settings page in VS Code shows stale values until the user closes and reopens it. The LS and
IntelliJ already implement live refresh; this is the VS Code side.

## Desired behaviour (customer outcome)

- **When settings change while the settings page is open, the page updates to show the current
  values without the user closing and reopening it.**
- **When the settings page is not open, nothing happens** — it will fetch fresh state the next
  time it is opened.

## Change shape (3 files + 2 test files)

1. `IWorkspaceConfigurationWebviewProvider` gains `reloadIfOpen(): Promise<void>`.
2. `WorkspaceConfigurationWebviewProvider` implements `reloadIfOpen()`: if `this.panel` exists,
   re-fetch HTML from the LS, apply scope indicators + IDE-script injection, and set
   `this.panel.webview.html`. No-op when `this.panel` is undefined.
3. `LanguageServer` calls `reloadIfOpen()` **after inbound persistence completes** (chained onto
   the existing `configPersistenceQueue`), so the re-fetched HTML reflects the just-persisted
   settings rather than the previous state.

### Critical ordering detail

`handleSnykConfigurationNotification` currently calls `runInboundPersistence(params)`, which is
fire-and-forget — it queues async disk writes on `configPersistenceQueue` and returns `void`.
Calling `reloadIfOpen()` synchronously after it would re-fetch HTML **before** the new settings
are persisted, re-rendering stale state and reintroducing the bug at a different layer. The reload
MUST be sequenced after the persistence promise resolves. Approach: have `runInboundPersistence`
return the queued promise (it already builds `this.configPersistenceQueue = ...then(...)`), and in
`handleSnykConfigurationNotification` chain `.then(() => this.workspaceConfigurationProvider?.reloadIfOpen())`
onto it. The reload runs whether or not persistence succeeded (the existing `.catch` inside the
queue keeps it alive), which is correct — a fresh fetch reflects whatever ended up persisted.

### Shared render path

`showPanel()` already contains the fetch → `populateScopeIndicators` → `injectIdeScripts` →
`panel.webview.html` sequence (lines 74–82), including the fallback branch. `reloadIfOpen()` must
apply the **same** transform so the reloaded page is identical to a freshly-opened one. Extract a
private `renderConfigurationHtml(): Promise<void>` helper that both `showPanel()` (after creating
the panel) and `reloadIfOpen()` call, to avoid divergence between the two render paths. This is a
surgical refactor of existing logic — no behaviour change to `showPanel`.

## Architecture

**Interface change** (`workspaceConfiguration.types.ts`):

```ts
export interface IWorkspaceConfigurationWebviewProvider {
  showPanel(): Promise<void>;
  disposePanel(): void;
  setAuthToken(token: string, apiUrl?: string): void;
  reloadIfOpen(): Promise<void>;
}
```

**Provider** (`workspaceConfigurationWebviewProvider.ts`):

```ts
async reloadIfOpen(): Promise<void> {
  if (!this.panel) {
    return;
  }
  await this.renderConfigurationHtml();
}

// extracted from showPanel(); contains fetch + scope + inject + fallback branch
private async renderConfigurationHtml(): Promise<void> { /* ... */ }
```

`reloadIfOpen()` wraps its body in the same `try/catch` + `ErrorHandler.handle` pattern as
`showPanel()` so a failed reload never throws into the LS notification handler.

**LanguageServer** (`languageServer.ts`):

```ts
private handleSnykConfigurationNotification(params: LspConfigurationParam): void {
  this.logger.debug('Received $/snyk.configuration notification');
  void this.runInboundPersistence(params).then(() =>
    this.workspaceConfigurationProvider?.reloadIfOpen(),
  );
}

private runInboundPersistence(params: LspConfigurationParam): Promise<void> {
  this.configPersistenceQueue = this.configPersistenceQueue
    .catch(() => {/* keep queue alive */})
    .then(async () => { /* unchanged */ });
  return this.configPersistenceQueue;
}
```

The mock interface (`src/test/unit/mocks/languageServer.mock.ts`) and the LS test helper
already exercise `setWorkspaceConfigurationProvider`; the new mock provider used in the wiring
test must expose a `reloadIfOpen` stub.

## Flow diagram

`docs/diagrams/IDE-1954_reload_flow.mmd`

## Test scenarios (Phase 1.4 — outside-in)

### Layer 2 — Integration (provider, real component under test)

Existing suite: `src/test/integration/workspaceConfigurationWebviewProvider.test.ts`.
The panel cannot be created without the VS Code webview runtime; these tests construct the
provider and drive `reloadIfOpen()` against a stubbed `this.panel` (set via the test seam the
suite already uses for private access), asserting the observable outcome — that the panel's
`webview.html` is updated from a fresh LS fetch, or left untouched when no panel exists.

| Test ID | Given | When | Then | Test function |
|---------|-------|------|------|---------------|
| INT-001 | settings page is open (panel present) | a config update arrives and `reloadIfOpen()` runs | the panel's `webview.html` is replaced with freshly-fetched, scope-annotated, script-injected HTML (LS command called again) | `TestReloadIfOpen_PanelOpen_RefetchesAndRerenders` |
| INT-002 | settings page is not open (no panel) | `reloadIfOpen()` runs | no LS fetch occurs and no error is thrown (silent no-op) | `TestReloadIfOpen_NoPanel_IsNoOp` |
| INT-003 | settings page is open, LS fetch fails on all retries | `reloadIfOpen()` runs | the error is handled (no throw); panel HTML is left at its previous value | `TestReloadIfOpen_FetchFails_HandledNoThrow` |

### Layer 2 — Integration / wiring (LanguageServer ↔ provider)

In `src/test/unit/common/languageServer/languageServer.test.ts`, reusing the existing
`startLanguageServerWithRecordingClient({ workspaceConfigurationProvider })` seam and the
`notificationHandlers['$/snyk.configuration']` dispatch idiom (already used at line 594).

| Test ID | Given | When | Then | Test function |
|---------|-------|------|------|---------------|
| WIRE-001 | LS started with a provider whose `reloadIfOpen` is a stub | a `$/snyk.configuration` notification is dispatched | `reloadIfOpen()` is called exactly once **after** inbound persistence resolves (assert call order vs the persist stub) | `TestSnykConfigurationNotification_ReloadsProviderAfterPersist` |
| WIRE-002 | LS started without a provider set | a `$/snyk.configuration` notification is dispatched | no throw (optional-chaining guard holds) | `TestSnykConfigurationNotification_NoProvider_NoThrow` |

WIRE-001 is the regression guard for the ordering detail: it must assert `reloadIfOpen` fired
**after** the persistence step, not merely that it fired. Use a shared call-order recorder
(sinon `callOrder`) across the persist stub and the `reloadIfOpen` stub.

### Layer 4 — Manual (webview rendering — cannot be automated)

| Test ID | Scenario | Steps | Expected |
|---------|----------|-------|----------|
| MAN-001 | Open settings page refreshes live | 1. Open Snyk settings page. 2. From another VS Code window (or via an org/scope change) change a setting that the LS echoes back. | The open page updates to the new value without being closed/reopened. |
| MAN-002 | Closed page does nothing | 1. Ensure settings page is closed. 2. Trigger a config change. 3. Open the settings page. | The page opens showing current values; no errors in the Snyk output channel. |

### Self-check

- Customer-visible behaviours (live refresh, no-op when closed) each have an acceptance-level
  manual row (MAN-001/002) — webview DOM rendering cannot be automated in this repo.
- The service boundary introduced (LS → provider `reloadIfOpen`) has a named wiring test
  (WIRE-001) asserting call **order**, not just call presence — this is the ghost-test guard.
- Integration tests (INT) precede no unit tests because there is no standalone branching logic
  beyond the `if (!this.panel)` guard, which INT-001/INT-002 already cover. No unit layer needed.

## Phase 2 — Implementation (single checkpoint, outside-in TDD)

**CP-1.1: Auto-refresh open settings page on `$/snyk.configuration`**

**Goal:** When settings change while the HTML settings page is open, it re-renders in place with
current values; when closed, nothing happens.

**Files to modify:**
- `src/snyk/common/views/workspaceConfiguration/types/workspaceConfiguration.types.ts` — add `reloadIfOpen(): Promise<void>` to the interface.
- `src/snyk/common/views/workspaceConfiguration/workspaceConfigurationWebviewProvider.ts` — extract `renderConfigurationHtml()` from `showPanel()`; add `reloadIfOpen()`.
- `src/snyk/common/languageServer/languageServer.ts` — make `runInboundPersistence` return the queued promise; chain `reloadIfOpen()` after it in `handleSnykConfigurationNotification`.
- `src/test/unit/mocks/languageServer.mock.ts` — only if the mock implements the provider interface and needs the new method (verify; likely no change — it mocks `ILanguageServer`, not the provider).

**Files to modify (tests):**
- `src/test/integration/workspaceConfigurationWebviewProvider.test.ts` — INT-001/002/003.
- `src/test/unit/common/languageServer/languageServer.test.ts` — WIRE-001/002.

**Todo (RED before GREEN, outside-in):**
- [ ] [WIRE-001] Write failing wiring test (call order: persist → reloadIfOpen) → RED
- [ ] [WIRE-002] Write failing no-provider test → RED
- [ ] [INT-001] Write failing reload-refetches test → RED
- [ ] [INT-002] Write failing no-panel no-op test → RED
- [ ] [INT-003] Write failing fetch-failure-handled test → RED
- [ ] Add `reloadIfOpen` to the interface
- [ ] Extract `renderConfigurationHtml()` and add `reloadIfOpen()` in the provider → INT green
- [ ] Return the queued promise from `runInboundPersistence`; chain `reloadIfOpen()` after persist → WIRE green
- [ ] `npm run test:unit` and `npm run test:integration` — all green
- [ ] `npm run lint` — zero issues
- [ ] MAN-001 / MAN-002 performed by hand before merge

**Commit:** `feat: auto-refresh open HTML settings page on configuration change [IDE-1954]`

**Real-wiring note:** the LS → provider boundary is wired in
`handleSnykConfigurationNotification` (`languageServer.ts`); the provider is injected via the
existing `setWorkspaceConfigurationProvider` (called in `src/snyk/extension.ts:405`). Wiring test:
`TestSnykConfigurationNotification_ReloadsProviderAfterPersist` (WIRE-001).

## Effort estimate

| PR | Scope | Agent dev | PR review | Manual | Total |
|----|-------|-----------|-----------|--------|-------|
| PR 1 | reloadIfOpen + wiring + tests (~120 lines, well under 700) | 0.5d | 1d | 0.5d | 2d |

## Phase 3 — Review

- [ ] `npm run lint` clean
- [ ] `npm run test:unit` + `npm run test:integration` green
- [ ] verification skill run with zero blocking findings
- [ ] MAN-001/002 manually verified
- [ ] PR description notes this is the VS Code counterpart of the merged snyk-ls + IntelliJ work
