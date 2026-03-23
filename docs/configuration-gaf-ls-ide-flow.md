# Configuration: GAF → snyk-ls → IDE

High-level flow for how settings are stored in GAF, resolved in **snyk-ls**, pushed to IDEs, and how **merges** relate to the **VS Code** extension (`mergeInboundLspConfiguration`, IDE-1638).

## Diagram

```mermaid
flowchart TB
  subgraph external["External & inputs"]
    LDX["LDX-Sync API<br/>(remote org / machine / folder)"]
    IDE_IN["IDE → LS<br/>workspace/didChangeConfiguration"]
    ENRICH["LS enrichment<br/>(git, org detection)"]
  end

  subgraph gaf["GAF — single configuration store"]
    STORE[("Configuration<br/>(Viper / prefix keys)")]
    PFX["Prefixes: user:global:, user:folder:path:,<br/>remote:orgId:, remote:machine:, folder:…"]
  end

  subgraph resolve["snyk-ls — resolution (merge #1)"]
    CR["ConfigResolver<br/>effective value per flag + scope"]
  end

  subgraph outbound["snyk-ls — outbound to IDE"]
    LCP["Assemble LspConfigurationParam<br/>map[string]ConfigSetting + folderConfigs[]"]
    NCFG["$/snyk.configuration"]
    NFOLD["$/snyk.folderConfigs<br/>(folder metadata / org — different contract)"]
  end

  subgraph ide["IDE"]
    HNDL["LanguageClient<br/>onNotification"]
    MERGE_UI["mergeInboundLspConfiguration<br/>(merge #2 — display only)"]
    VIEW["Webview / settings UI<br/>locks, source, values"]
    DCC["workspace/didChangeConfiguration<br/>(partial deltas)"]
  end

  LDX --> STORE
  IDE_IN --> STORE
  ENRICH --> STORE
  STORE --> PFX
  PFX --> CR
  CR --> LCP
  LCP --> NCFG
  STORE --> NFOLD
  NCFG --> HNDL
  NFOLD --> HNDL
  HNDL --> MERGE_UI
  MERGE_UI --> VIEW
  VIEW --> DCC
  DCC --> IDE_IN
```

Source (editable): [`docs/diagrams/configuration-gaf-ls-ide-flow.mmd`](diagrams/configuration-gaf-ls-ide-flow.mmd).

## Where merges happen

| # | Location | What is merged |
|---|----------|----------------|
| **1** | **snyk-ls / GAF / `ConfigResolver`** | Prefix layers (`user:global`, `user:folder`, `remote:*`, defaults) → **authoritative** effective value per setting, folder, and org. This is the real precedence chain (see snyk-ls `docs/configuration.md` when present). |
| **2** | **LS outbound** | Builds **`LspConfigurationParam`**: global `settings` map + per-folder `folderConfigs[].settings` with **`ConfigSetting`** (`value`, `source`, `originScope`, `isLocked`). Already reflects resolver output. |
| **3** | **IDE (VS Code) — `mergeInboundLspConfiguration`** | **Presentation merge only**: spreads global map into each folder’s effective map so the UI can read one object per folder. Does **not** replace LS resolution; must use **same flag keys** as LS (pflag names). |
| **—** | **`$/snyk.folderConfigs` vs `$/snyk.configuration`** | Not the same merge: **folderConfigs notification** carries folder/org **metadata** and related fields; **configuration notification** carries the **map-based effective config** (protocol v25+). Both can land in the IDE; keep contracts separate. |

## Round trip

- **LS → IDE:** `$/snyk.configuration` pushes effective state (and locks) for UI.
- **IDE → LS:** `workspace/didChangeConfiguration` with **`LspConfigurationParam`-shaped** payload; only **changed** keys, `value: null` to clear override (per protocol).

## References

- snyk-ls (e.g. IDE-1786 / config refactor): `ConfigSetting`, `LspConfigurationParam`, `docs/configuration.md`.
- VS Code extension: `lspConfigurationMerge.ts`, `LanguageServer` inbound view, IDE-1638.
