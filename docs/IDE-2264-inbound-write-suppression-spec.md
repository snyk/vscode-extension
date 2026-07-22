# Spec: Centralize inbound-write attribution suppression (IDE-2264 follow-up)

Local spec file — not published to a tracker (repo has no issue-tracker/triage-label config yet; see `setup-matt-pocock-skills`). Originated from PR #782 (snyk/vscode-extension) review comment #3624369972.

## Problem Statement

A Snyk VS Code user resets a global setting to project defaults (via the settings dialog, or the LS echoing a prior reset) for a setting they never actually overrode. VS Code fires no `onDidChangeConfiguration` event for a no-op write, so the write-time attribution tag meant to suppress misattributing that write to the user is never consumed — it leaks forward. The next time the user *genuinely* edits that same setting, the stale tag suppresses the explicit-change marking, the edit is not sent to the language server, and the LS reverts it to the org default. User-visible symptom: "I changed my setting but it keeps reverting."

A second, related gap: the same write-time tag is also never cleared when the write itself throws (no event will follow a failed write either). This failure-cleanup was added for the reset path but not for the regular inbound-settings-sync path, leaving an inconsistent, hard-to-reason-about suppression contract split across two call sites with two different "should I even write this" checks.

## Solution

Two fixes, both landing on existing seams rather than new machinery:

1. **Unify the no-op check.** `ScopeDetectionService.shouldSkipSettingUpdate` is already the single authority the settings-sync path (`applySettingsMap`) uses to decide "is this write redundant." Add a branch for clearing writes (`value === undefined`): skip iff no override exists at any scope to clear. The reset path (`applyVscodeKeyResets`) calls this same predicate instead of a bespoke `workspace.inspectConfiguration` peek, so both write paths share one "should this write happen" decision instead of two divergent ones.

2. **Centralize the mark/write/cleanup mechanics.** Extract a single private helper (`writeTaggedAsInboundOrigin`) that marks the vscodeKey pending, performs the write, and — if the write throws — immediately consumes (clears) the marker before rethrowing, since no event will arrive to consume it otherwise. Both `applyVscodeKeyResets` and `applySettingsMap` call this helper instead of hand-rolling mark/write/catch independently. This closes the write-failure leak on both paths instead of just one.

## User Stories

1. As a VS Code extension user who has never overridden a given Snyk setting, I want a "reset to project defaults" action (mine or replayed from the LS) to leave no residual state, so that my next genuine edit of that setting is not silently swallowed.
2. As a VS Code extension user, I want my explicit setting changes to always reach the language server, so that my org's policy resolution reflects what I actually chose rather than reverting behind my back.
3. As a VS Code extension user, I want a failed settings write (e.g. a transient VS Code API error) to not corrupt the attribution state of that setting, so that my next edit attempt still behaves normally.
4. As a maintainer of `ConfigurationPersistenceService`, I want one shared "should this write happen" predicate for both the reset path and the settings-sync path, so that a no-op-detection fix only needs to be made once.
5. As a maintainer, I want one shared "mark, write, clean up on failure" helper, so that a new call site can't forget to pair `markPendingInboundWrite` with `consumePendingInboundWrite` and silently reintroduce this class of bug.
6. As a test author, I want the existing `shouldSkipSettingUpdate`-stubbing seam in `configurationPersistenceService.test.ts` to remain the single point of control for "does this reset write proceed," so that the ~10 existing reset tests need no fixture changes.
7. As a reviewer of this change, I want the outbound reset path's `onWriteSuccess` callback (which queues the LS-facing pending-reset signal via `markPendingReset`) to keep firing even when there was no VS Code override to clear, so that the "Reset to Project Defaults" UI action still behaves correctly for settings the user never touched.
8. As a maintainer, I want the tracker interface (`IExplicitLspConfigurationChangeTracker`) left unchanged (its two write-suppression methods stay optional), so that none of the 28 existing fake-tracker test doubles across 3 test files need updating for this fix.

## Implementation Decisions

- **`ScopeDetectionService.shouldSkipSettingUpdate`** (`scopeDetectionService.ts`) gains a new branch, checked before the existing scope switch: when `value === undefined`, skip iff neither `globalValue` nor `workspaceValue` is set on the inspected configuration (i.e., there is nothing to clear). Existing branches (LS-effective-known skip, scope-fallback skip) are unchanged.
- **`ConfigurationPersistenceService.applyVscodeKeyResets`** (`configurationPersistenceService.ts`) replaces its ad hoc `workspace.inspectConfiguration(...).globalValue !== undefined` precondition with a call to `this.scopeDetectionService.shouldSkipSettingUpdate(configurationId, section, undefined, 'user', EFFECTIVE_VALUE_UNKNOWN)`. When it returns true, neither the mark nor the write happen for that vscodeKey group — but the `onWriteSuccess` callback for every `lsKey` in the group still runs unconditionally, since callers (notably the outbound reset path's `markPendingReset` queuing) depend on it regardless of whether a VS Code override existed to clear.
- **New private helper `writeTaggedAsInboundOrigin(vscodeKey, configurationId, section, value, configurationTarget)`** on `ConfigurationPersistenceService`: calls `markPendingInboundWrite?.(vscodeKey)`, awaits `workspace.updateConfiguration(...)`, and on throw calls `consumePendingInboundWrite?.(vscodeKey)` before rethrowing. Both `applyVscodeKeyResets` (on the non-skip branch) and `applySettingsMap` call this helper instead of inlining the mark/write sequence.
- `applyVscodeKeyResets`'s existing per-group `try`/`catch` (which logs and skips `onWriteSuccess` on failure) is preserved; the helper's internal consume-on-throw composes with it rather than replacing it.
- `applySettingsMap`'s equivalent write is routed through the same helper, which — as a side effect — fixes its previously-unaddressed write-failure marker leak (its own catch block only logged before this change).
- No change to `IExplicitLspConfigurationChangeTracker`: `markPendingInboundWrite?`/`consumePendingInboundWrite?` remain optional. Making them required was considered (raised by an automated reviewer) but rejected — it would force updates to all 28 fake-tracker object literals across `languageServer.test.ts`, `middleware.test.ts`, and `configurationPersistenceService.test.ts` for a non-blocking type-safety nicety.
- The pre-existing `suppressConfigFeedbackFromInboundPersistence` boolean (gating `LanguageClientMiddleware`'s outbound `didChangeConfiguration` echo suppression) is untouched — unrelated concern, out of scope for this ticket per prior investigation.

## Testing Decisions

Good tests here observe attribution outcome through the public seam (`ConfigurationPersistenceService.persistInboundLspConfiguration` / `handleSaveConfig`, through to `tracker.isExplicitlyChanged`), not internal marker-set state — consistent with the existing sibling test `'inbound LS persistence never marks settings explicit, even on a delayed change event'` in `languageServer.test.ts`, which this work follows as prior art.

- **New test (already written, currently red against the pre-fix code, green after)**: `'global reset of a never-overridden key does not leak a pending marker into the next genuine user edit'` in `languageServer.test.ts`. Real `ConfigurationPersistenceService` + real `ScopeDetectionService`, a fake workspace that only dispatches `onDidChangeConfiguration` when a write's value actually changes (modeling real VS Code no-op semantics), asserting a subsequent genuine edit of the same key gets marked explicit.
- **Existing test fixture correction**: `'a change event delayed past the write no longer deletes the pending reset'` (`languageServer.test.ts`) — its fake `inspectConfiguration` is updated to report a pre-existing global override, so the test continues to genuinely exercise the mark-then-delayed-event path it's named for (previously it accidentally always reported no override, which the old code ignored but the new no-op check would otherwise skip).
- **No changes required** to the ~10 reset-related tests in `configurationPersistenceService.test.ts` (spanning inbound `applyGlobalResets`, outbound `applyOutboundGlobalResets`, and shared-vscodeKey dedupe suites) — they already stub `IScopeDetectionService.shouldSkipSettingUpdate` to unconditionally return `false`, which is exactly the seam this fix now routes through.
- **New coverage to add**: a write-failure test for `applySettingsMap` mirroring the existing reset-path failure test (`'does not mark pending reset or unmark explicit-changed when updateConfiguration throws'`), asserting the marker is cleared (not leaked) when `updateConfiguration` rejects during a regular settings-sync write.

## Out of Scope

- `middleware.ts` / `suppressConfigFeedbackFromInboundPersistence` outbound-echo timing — a separate, pre-existing concern noted in prior investigation, not touched by this change.
- `applySettingsMap`'s cold-effective-cache no-op detection gap (flagged non-blocking by the automated reviewer): `value` at that call site is always a concrete resolved value, never `undefined`, so the new `shouldSkipSettingUpdate` branch does not engage there. Would need a separate fix (e.g., comparing against the actual persisted value regardless of cache warmth).
- Making `IExplicitLspConfigurationChangeTracker`'s two write-suppression methods required rather than optional.
- IDE-2254 (the inverse bug: the Code-enablement key never getting marked) — separate ticket per existing HANDOFF notes.

## Further Notes

This started as a narrow fix for one PR review comment (stale marker on a no-op reset write). An initial implementation added a bespoke `hasOverride` precondition directly against `workspace.inspectConfiguration`, which broke ~10 existing tests because their fixtures blanket-stub `inspectConfiguration` (not the seam those tests actually control) while already stubbing `shouldSkipSettingUpdate` to never skip. Routing through the existing `ScopeDetectionService` seam instead resolves the test breakage as a side effect of using the right abstraction, not by patching fixtures. `HANDOFF.md` in the worktree root has the original ticket's investigation notes and open items.
