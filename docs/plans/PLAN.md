# vscode-extension — Implementation & Roadmap

**Last updated:** 2026-06-20
**Repo:** github.com/snyk/vscode-extension

> Single source of truth for completed, in-progress, and pending work.
> Sub-plans linked below carry per-PR TDD specs.

## Status legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Merged to `main` |
| 🔄 | In progress |
| ⏳ | Planned — not started |
| ❌ | Cancelled / deferred |

## Completed work

<!-- add entries here as PRs merge -->

---

## In progress

<!-- active branch work -->

---

## Pending

### IDE-1954 — Auto-refresh the HTML settings page

**Sub-plan:** [IDE-1954-auto-refresh-html-settings.md](IDE-1954-auto-refresh-html-settings.md)

| PR | Title | Items | Notes |
|----|-------|-------|-------|
| ⏳ PR-1 | Auto-refresh open settings page on config change | `reloadIfOpen()` on provider + interface; LS chains it after inbound persistence; INT + wiring tests | VS Code counterpart of merged snyk-ls + IntelliJ work; ~120 lines, single PR |

---

## Architecture reference

| Document | Purpose |
|----------|---------|
| docs/configuration-gaf-ls-ide-flow.md | GAF → LS → IDE configuration merge chain |
