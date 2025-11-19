# Manual Test Plan for IDE-1366: Get Project Organization from Language Server (VSCode)

## Overview of Changes

**New Feature**: Organization selection in workspace folder settings
- **UI Enhancement**: Auto-select organization checkbox (`snyk.advanced.autoSelectOrganization`)
- **Language Server Integration**: Organization settings are synchronized with the Snyk Language Server via FolderConfig
- **Configuration Watcher**: VSCode config changes are synced to folder configs via `ConfigurationWatcher`
- **Fallback Logic**: VSCode configuration hierarchy (folder → workspace → user → default) serves as fallback

## Test Cases Overview

This test plan includes the following test cases:

1. **Test Case 1: Organization Selection in Workspace Folder Settings**
   - Verify organization can be set per-folder through VSCode settings

2. **Test Case 2: Auto-Select Organization Checkbox**
   - Verify auto-select organization functionality and settings behavior

3. **Test Case 3: VSCode Settings UI Integration**
   - Verify complete settings UI integration and configuration interactions

4. **Test Case 4: Language Server Configuration Updates**
   - Verify configuration changes trigger Language Server updates and are properly synchronized

5. **Test Case 5: Edge Cases and Error Handling**
   - Verify edge cases and error scenarios are handled gracefully

6. **Test Case 6: Integration with Scans**
   - Verify organization settings are correctly used during Snyk scans

7. **Test Case 7: Migration Testing**
   - Verify the extension correctly handles migrated folder configs received from Language Server

8. **Test Case 8: Configuration Hierarchy Changes**
   - Verify changes to configuration at different levels (folder/workspace/user) are handled correctly

9. **Test Case 9: Opting In/Out of Automatic Org Selection** (Critical)
   - Verify opting in and out of automatic organization selection works correctly

10. **Test Case 10: VSCode Restart Scenarios**
    - Verify organization settings persist correctly after VSCode restart and folder configs are refreshed

11. **Test Case 11: Configuration Watcher Bidirectional Sync**
    - Verify `ConfigurationWatcher` correctly syncs changes in both directions (VSCode config ↔ folder configs)

---

## Key Concepts

### Organization Hierarchy (Fallback Order)
1. **Folder-specific values** (highest priority)
   - `autoDeterminedOrg` when auto-select is enabled (`orgSetByUser = false`)
   - `preferredOrg` when manual mode is enabled (`orgSetByUser = true`)
2. **VSCode Configuration Hierarchy** (fallback)
   - Folder-level setting (`snyk.advanced.organization`)
   - Workspace-level setting
   - User-level setting
   - Default value (empty string)
3. **Empty string** (final fallback)

### FolderConfig Fields
- `autoDeterminedOrg`: Organization automatically determined by Language Server from LDX-Sync
- `preferredOrg`: Organization manually set by user
- `orgSetByUser`: Boolean flag indicating if user has manually set organization (`true` = manual, `false` = auto-detect)
- `orgMigratedFromGlobalConfig`: Migration flag

### VSCode Settings
- `snyk.advanced.autoSelectOrganization`: Boolean (scope: "resource", default: true)
  - When `true`: Auto-detect organization (`orgSetByUser = false`)
  - When `false`: Manual organization (`orgSetByUser = true`)
- `snyk.advanced.organization`: String (scope: "resource")
  - Organization ID or name for manual selection
  - Used when `autoSelectOrganization = false`

### Configuration Sync Flow
- **VSCode Config → Folder Config**: `ConfigurationWatcher` syncs VSCode config changes to folder configs
- **Folder Config → VSCode Config**: `handleOrgSettingsFromFolderConfigs()` updates VSCode config from LS folder configs
- **Folder Config → Language Server**: Via `WorkspaceDidChangeConfiguration`
- **Language Server → Folder Config**: Via `$/snyk.folderConfig` notification

### UI Behavior (VSCode)
- **Settings are always editable**: VSCode doesn't disable settings based on checkbox state
- **No read-only display**: Organization value is always editable in settings UI
- **Display value**: When auto-select is enabled, VSCode config shows `autoDeterminedOrg` (but user can still edit it)
- **Configuration levels**: Settings can be set at folder, workspace, user, or default level

---

## Test Case 1: Organization Selection in Workspace Folder Settings

### Objective
Verify organization can be set per-folder through VSCode settings.

### Prerequisites
- VSCode with Snyk extension installed
- Authenticated Snyk account with multiple organizations
- A test workspace folder open in VSCode
- Language Server initialized and folder configs received

### Steps

#### 1.1 Access Settings
1. Open VSCode Settings:
   - **GUI**: `File → Preferences → Settings` (Windows/Linux) or `Code → Preferences → Settings` (macOS)
   - **JSON**: `File → Preferences → Settings` → Click `{}` icon to open `settings.json`
2. Navigate to **Extensions → Snyk** section (or search for "snyk")
3. Verify **"Snyk: Advanced: Auto Select Organization"** checkbox is present
4. Verify **"Snyk: Advanced: Organization"** text field is present

#### 1.2 Test Organization Field Visibility
1. Verify **"Snyk: Advanced: Organization"** field is visible in settings
2. Verify field description explains organization selection
3. Verify field is always editable (VSCode doesn't disable it)

#### 1.3 Test Manual Organization Setting
1. Uncheck **"Snyk: Advanced: Auto Select Organization"** checkbox
2. Verify **"Snyk: Advanced: Organization"** field remains editable (always editable in VSCode)
3. Enter a valid organization ID in the **"Snyk: Advanced: Organization"** field
4. Settings are saved automatically in VSCode (no Apply button needed)
5. Verify the setting is saved in `settings.json`:
   ```json
   {
     "snyk.advanced.autoSelectOrganization": false,
     "snyk.advanced.organization": "org-123"
   }
   ```

#### 1.4 Test Organization Persistence
1. Close and reopen VSCode
2. Open the same workspace folder
3. Open Settings
4. Verify the organization setting is retained
5. Verify checkbox state matches the saved `orgSetByUser` value
6. Verify text field shows correct organization value

#### 1.5 Verify Language Server Communication
1. Open VSCode Output panel (`View → Output`)
2. Select "Snyk" from the output channel dropdown
3. Monitor for `WorkspaceDidChangeConfiguration` calls
4. Verify folder config is sent to Language Server with correct `preferredOrg` and `orgSetByUser` values

### Expected Results
- Organization field is visible and functional in settings
- Settings are saved to VSCode configuration
- Settings are synced to FolderConfig via `ConfigurationWatcher`
- Organization is used in subsequent scans
- Language Server receives updated configuration via `WorkspaceDidChangeConfiguration`

---

## Test Case 2: Auto-Select Organization Checkbox

### Objective
Verify auto-select organization functionality and settings behavior.

### Prerequisites
- Same as Test Case 1
- Language Server has received folder configs with `autoDeterminedOrg` populated

### Steps

#### 2.1 Test Checkbox Visibility and Initial State
1. Open VSCode Settings
2. Navigate to **Extensions → Snyk** section
3. Verify **"Snyk: Advanced: Auto Select Organization"** checkbox is present
4. Verify checkbox description explains auto-select behavior
5. Verify checkbox initial state matches `orgSetByUser` value from Language Server:
   - **Checked** if `orgSetByUser = false` (auto-select enabled)
   - **Unchecked** if `orgSetByUser = true` (manual mode)

#### 2.2 Test Checkbox Behavior - Enabling Auto-Select
1. If checkbox is unchecked, check **"Snyk: Advanced: Auto Select Organization"**
2. Verify **"Snyk: Advanced: Organization"** field shows `autoDeterminedOrg` value (if available)
3. Verify field remains editable (VSCode doesn't make it read-only)
4. Verify settings.json shows:
   ```json
   {
     "snyk.advanced.autoSelectOrganization": true
   }
   ```

#### 2.3 Test Checkbox Behavior - Disabling Auto-Select
1. Uncheck **"Snyk: Advanced: Auto Select Organization"** checkbox
2. Verify **"Snyk: Advanced: Organization"** field remains editable
3. Verify field may be empty or show previous value
4. Verify user can enter manual organization value
5. Verify settings.json shows:
   ```json
   {
     "snyk.advanced.autoSelectOrganization": false,
     "snyk.advanced.organization": "org-123"
   }
   ```

#### 2.4 Test Auto-Select Functionality
1. Ensure checkbox is checked (auto-select enabled)
2. Settings are saved automatically
3. Run a Snyk scan (manually or wait for auto-scan)
4. Verify scan uses `autoDeterminedOrg` from Language Server
5. Verify scan results are associated with the correct organization

#### 2.5 Test Manual Override
1. Uncheck **"Snyk: Advanced: Auto Select Organization"**
2. Enter a specific organization ID in **"Snyk: Advanced: Organization"** field
3. Settings are saved automatically
4. Run a Snyk scan
5. Verify scan uses the manually entered organization
6. Verify `orgSetByUser = true` in folder config sent to Language Server

#### 2.6 Test Auto-Select with Single Folder Workspace
1. Open a workspace with a **single folder**
2. Navigate to Settings → Extensions → Snyk
3. Change **"Snyk: Advanced: Auto Select Organization"** checkbox state
4. Verify settings are saved to the folder's `.vscode/settings.json`:
   - Check that `.vscode/settings.json` exists in the workspace folder
   - Verify settings are written to folder-level settings.json
   - Verify settings are NOT written to workspace-level settings.json (since single folder = folder level)
5. Verify Language Server receives folder config with correct `orgSetByUser` value
6. Verify scans use the correct organization based on folder config

#### 2.7 Test Auto-Select with Multiple Folder Workspace
1. Open a workspace with **multiple folders** (File → Add Folder to Workspace)
2. Configure different auto-select settings for each folder:
   - Folder A: Auto-select enabled (checkbox checked)
   - Folder B: Auto-select disabled (checkbox unchecked)
3. Verify each folder's `.vscode/settings.json` contains its own settings:
   - Folder A: `snyk.advanced.autoSelectOrganization: true`
   - Folder B: `snyk.advanced.autoSelectOrganization: false`
4. Verify workspace-level `.vscode/settings.json` (if exists) does NOT contain folder-specific org settings
5. Verify each folder maintains independent organization settings
6. Run scans on each folder and verify each uses the correct organization

#### 2.8 Test Auto-Select Change at Workspace Level
1. Open a workspace with multiple folders
2. Open workspace-level settings (workspace root `.vscode/settings.json`)
3. Set **"Snyk: Advanced: Auto Select Organization"** at workspace level
4. Verify:
   - Workspace-level setting is saved in workspace root `.vscode/settings.json`
   - **Folder-level settings take precedence** over workspace-level
   - If a folder has no folder-level setting, it falls back to workspace-level
   - Language Server reads settings at folder level (like other IDEs)
   - Each folder's folder config reflects its effective organization (folder-level or workspace-level fallback)
5. Change auto-select at workspace level
6. Verify folders without folder-level settings inherit the workspace-level change
7. Verify folders with folder-level settings are NOT affected by workspace-level change

#### 2.9 Test Auto-Select Change at Global/User Level
1. Open User Settings (File → Preferences → Settings → User tab, or user `settings.json`)
2. Set **"Snyk: Advanced: Auto Select Organization"** at user/global level
3. Verify:
   - User-level setting is saved in user `settings.json`
   - **Folder-level settings take precedence** over user-level
   - **Workspace-level settings take precedence** over user-level
   - If a folder has no folder/workspace-level setting, it falls back to user-level
   - Language Server reads settings at folder level (like other IDEs)
   - Each folder's folder config reflects its effective organization (folder → workspace → user fallback)
4. Change auto-select at user level
5. Verify folders without folder/workspace-level settings inherit the user-level change
6. Verify folders with folder/workspace-level settings are NOT affected by user-level change

#### 2.10 Test Settings.json Writing Behavior (Critical)
**Objective**: Verify settings are only written to `.vscode/settings.json` when relevant and not when it doesn't make sense.

1. **Test: Single Folder Workspace - Folder-Level Setting**
   - Open single folder workspace
   - Set organization at folder level
   - Verify `.vscode/settings.json` in the folder contains the setting
   - Verify workspace-level `.vscode/settings.json` does NOT exist (single folder = no workspace file needed)

2. **Test: Multiple Folder Workspace - Folder-Level Setting**
   - Open workspace with multiple folders
   - Set organization for Folder A at folder level
   - Verify Folder A's `.vscode/settings.json` contains the setting
   - Verify workspace root `.vscode/settings.json` does NOT contain folder-specific org settings
   - Verify Folder B's `.vscode/settings.json` does NOT contain org settings (if not set for Folder B)

3. **Test: Multiple Folder Workspace - Workspace-Level Setting**
   - Open workspace with multiple folders
   - Set organization at workspace level (workspace root `.vscode/settings.json`)
   - Verify workspace root `.vscode/settings.json` contains the setting
   - Verify individual folder `.vscode/settings.json` files do NOT contain org settings (unless explicitly set at folder level)
   - Verify folders without folder-level settings use workspace-level setting

4. **Test: User-Level Setting**
   - Set organization at user level (user `settings.json`)
   - Verify user `settings.json` contains the setting
   - Verify NO `.vscode/settings.json` files are created/modified (user-level doesn't require workspace files)
   - Verify folders without folder/workspace-level settings use user-level setting

5. **Test: Auto-Select Default Value (true)**
   - Open workspace folder
   - Verify if auto-select is at default value (true) and matches Language Server's `orgSetByUser = false`:
     - **Settings.json should NOT be written** if value matches default
     - Settings.json should only be written if user explicitly changes it
   - Change auto-select to false, then back to true
   - Verify settings.json behavior (may or may not remove the setting depending on VSCode behavior)

6. **Test: Organization Field Empty**
   - Set auto-select to false (manual mode)
   - Leave organization field empty
   - Verify:
     - If organization is empty and matches default/fallback, settings.json may not need to contain it
     - Settings.json should only contain organization field if it has a meaningful value
     - Language Server should use fallback hierarchy when organization is empty

### Expected Results
- Checkbox controls organization selection mode correctly
- Auto-select uses appropriate organization from Language Server
- Manual organization setting works when auto-select is disabled
- Language Server receives correct `orgSetByUser` flag
- Settings are always editable (VSCode behavior)
- **Single folder workspace**: Settings written to folder-level `.vscode/settings.json`
- **Multiple folder workspace**: Each folder maintains independent settings; workspace-level settings work as fallback
- **Workspace-level changes**: Only affect folders without folder-level settings
- **Global/user-level changes**: Only affect folders without folder/workspace-level settings
- **Settings.json writing**: Settings are only written when relevant (not for default values, not unnecessarily)
- **Language Server reads at folder level**: Like other IDEs, LS reads folder-level settings, not workspace/global

---

## Test Case 3: VSCode Settings UI Integration

### Objective
Verify complete settings UI integration and configuration interactions.

### Prerequisites
- VSCode with Snyk extension
- Test workspace folder open
- Language Server initialized

### Steps

#### 3.1 Test Settings UI Loading
1. Open VSCode Settings (GUI or JSON)
2. Navigate to **Extensions → Snyk** section
3. Verify all Snyk settings load correctly:
   - Auto-select organization
   - Organization
   - Other Snyk settings
4. Verify no errors in Output panel

#### 3.2 Test Field Population on Settings Open
1. With auto-select **enabled** (`orgSetByUser = false`):
   - Verify checkbox is checked
   - Verify **"Snyk: Advanced: Organization"** shows `autoDeterminedOrg` value (if available)
   - Verify field remains editable

2. With auto-select **disabled** (`orgSetByUser = true`):
   - Verify checkbox is unchecked
   - Verify **"Snyk: Advanced: Organization"** shows `preferredOrg` value (or empty if not set)
   - Verify field is editable

3. With **no folder config** (Language Server not initialized):
   - Verify settings show default values
   - Verify fields are editable

#### 3.3 Test Field Validation
1. Enter invalid organization ID format in **"Snyk: Advanced: Organization"**
2. Test with empty fields
3. Test with very long organization strings
4. Verify VSCode settings validation (if any)
5. Verify Language Server handles invalid values gracefully

#### 3.4 Test Settings Persistence
1. Make changes to organization settings:
   - Toggle auto-select checkbox
   - Enter organization value
2. Settings are saved automatically in VSCode
3. Verify changes are saved in `settings.json`
4. Verify Language Server receives update via `ConfigurationWatcher`
5. Close and reopen Settings
6. Verify changes are persisted

#### 3.5 Test Configuration Levels
1. Test setting organization at different levels:
   - **Folder level**: Set in workspace folder's `.vscode/settings.json`
   - **Workspace level**: Set in workspace root's `.vscode/settings.json`
   - **User level**: Set in user `settings.json`
2. Verify folder-level setting takes precedence
3. Verify fallback to workspace/user level works correctly
4. Verify Language Server receives correct organization based on hierarchy

#### 3.6 Test Settings.json Direct Editing
1. Open `settings.json` directly (JSON view)
2. Manually edit organization settings:
   ```json
   {
     "snyk.advanced.autoSelectOrganization": false,
     "snyk.advanced.organization": "org-123"
   }
   ```
3. Save the file
4. Verify `ConfigurationWatcher` detects the change
5. Verify folder config is updated
6. Verify Language Server receives update

### Expected Results
- Settings UI loads without errors
- Fields populate correctly based on folder config state
- Settings persist correctly
- Configuration hierarchy works correctly
- Direct JSON editing works correctly
- `ConfigurationWatcher` syncs changes properly

---

## Test Case 4: Language Server Configuration Updates

### Objective
Verify configuration changes trigger Language Server updates and are properly synchronized.

### Prerequisites
- VSCode with Snyk extension
- Language Server running and initialized
- Multiple workspace folders (optional, for multi-folder testing)

### Steps

#### 4.1 Test Configuration Propagation
1. Open VSCode Settings
2. Change organization settings:
   - Toggle auto-select checkbox
   - Enter/change organization value
3. Settings are saved automatically
4. Monitor Language Server communication:
   - Check Output panel for `WorkspaceDidChangeConfiguration` calls
   - Verify folder config contains updated values:
     - `preferredOrg` matches organization field value
     - `orgSetByUser` matches checkbox state (`!autoSelectOrganization`)
     - `autoDeterminedOrg` is preserved (never modified by extension)

#### 4.2 Test FolderConfig Update Logic
1. With auto-select **enabled** (checkbox checked):
   - Verify folder config sent to LS has:
     - `orgSetByUser = false`
     - `preferredOrg = ""` (empty string)
     - `autoDeterminedOrg` unchanged (from LS)

2. With auto-select **disabled** (checkbox unchecked):
   - Enter organization in **"Snyk: Advanced: Organization"** field
   - Verify folder config sent to LS has:
     - `orgSetByUser = true`
     - `preferredOrg` = value from organization field
     - `autoDeterminedOrg` unchanged (from LS)

#### 4.3 Test Multiple Workspace Folders
1. Open workspace with multiple folders (File → Add Folder to Workspace)
2. Configure different organizations for different folders:
   - Folder A: Auto-select enabled
   - Folder B: Manual organization "org-123"
   - Folder C: Manual organization "org-456"
3. Verify each folder maintains its own organization setting
4. Verify each folder's `settings.json` has correct values
5. Run scans on each folder
6. Verify each folder uses the correct organization

#### 4.4 Test Language Server Response
1. Make organization setting changes
2. Settings are saved automatically
3. Wait for Language Server to process configuration
4. Verify Language Server sends updated folder configs back via `$/snyk.folderConfig` notification
5. Verify extension updates VSCode config to reflect any changes from Language Server
6. Verify `autoDeterminedOrg` is updated by Language Server (if LDX-Sync provides new value)

#### 4.5 Test Fallback Behavior
1. Clear organization field (set to empty)
2. Disable auto-select
3. Verify VSCode configuration hierarchy is used as fallback:
   - Folder-level setting
   - Workspace-level setting
   - User-level setting
   - Default (empty string)
4. Verify Language Server receives organization from `LanguageServerSettings`
5. Run scan and verify correct organization is used

#### 4.6 Test Configuration Watcher Sync
1. Change organization setting in VSCode UI
2. Verify `ConfigurationWatcher` detects the change
3. Verify `syncFolderConfigAutoOrgOnChange` or `syncFolderConfigPreferredOrgOnWorkspaceFolderOrgSettingChanged` is called
4. Verify folder config is updated
5. Verify Language Server receives update
6. Verify no circular updates (check `foldersBeingUpdatedByLS` flag)

### Expected Results
- Configuration changes are propagated to Language Server via `WorkspaceDidChangeConfiguration`
- Folder config updates contain correct `preferredOrg`, `orgSetByUser`, and `autoDeterminedOrg` values
- Each workspace folder maintains its own organization setting
- Language Server responses are properly handled
- Fallback to configuration hierarchy works correctly
- `ConfigurationWatcher` syncs changes correctly without circular updates

---

## Test Case 5: Edge Cases and Error Handling

### Objective
Verify edge cases and error scenarios are handled gracefully.

### Prerequisites
- VSCode with Snyk extension
- Test workspace folder
- Various test scenarios (see steps)

### Steps

#### 5.1 Test Empty/Null Values
1. Test with `autoDeterminedOrg` empty/null:
   - Verify settings UI handles gracefully
   - Verify fallback to configuration hierarchy works
   - Verify no crashes or errors

2. Test with `preferredOrg` empty when `orgSetByUser = true`:
   - Verify fallback behavior
   - Verify Language Server receives correct values

#### 5.2 Test Language Server Not Initialized
1. Close workspace folder
2. Open Settings (user-level)
3. Verify settings are accessible
4. Verify no errors when accessing settings without workspace folder

#### 5.3 Test Rapid Changes
1. Rapidly toggle auto-select checkbox multiple times
2. Enter/clear organization value multiple times
3. Make rapid changes in `settings.json`
4. Verify no race conditions or UI glitches
5. Verify final state is correct
6. Verify `ConfigurationWatcher` handles rapid changes correctly

#### 5.4 Test Special Characters
1. Enter organization with special characters (if valid)
2. Enter very long organization strings
3. Enter organization with unicode characters
4. Verify handling is correct
5. Verify Language Server receives correct values

#### 5.5 Test Concurrent Modifications
1. Open Settings UI
2. In another editor, modify `settings.json` directly
3. Verify extension handles concurrent modifications correctly
4. Verify Language Server receives consistent state
5. Verify `ConfigurationWatcher` detects changes correctly

#### 5.6 Test Edge Cases with Folder Configs
1. Test with workspace that has organization setting but no folder config:
   - Verify Language Server handles initialization correctly
   - Verify folder configs are created properly
   - Verify organization is properly used

#### 5.7 Test Circular Update Prevention
1. Change organization setting
2. Verify `foldersBeingUpdatedByLS` flag prevents circular updates
3. Verify Language Server updates don't trigger watcher updates
4. Verify no infinite loops

### Expected Results
- Edge cases are handled gracefully
- No crashes or unhandled exceptions
- Error messages are clear and helpful
- Fallback behavior works in all scenarios
- Circular updates are prevented

---

## Test Case 6: Integration with Scans

### Objective
Verify organization settings are correctly used during Snyk scans.

### Prerequisites
- VSCode with Snyk extension
- Authenticated Snyk account
- Test workspace folder with vulnerabilities
- Multiple organizations available

### Steps

#### 6.1 Test Scan with Auto-Select Enabled
1. Enable auto-select organization
2. Settings are saved automatically
3. Trigger a Snyk scan (manual or automatic)
4. Verify scan uses `autoDeterminedOrg` from Language Server
5. Verify scan results show correct organization
6. Verify issues are associated with correct organization

#### 6.2 Test Scan with Manual Organization
1. Disable auto-select
2. Enter specific organization ID
3. Settings are saved automatically
4. Trigger a Snyk scan
5. Verify scan uses manually entered organization
6. Verify scan results show correct organization

#### 6.3 Test Organization Change During Active Scan
1. Start a scan
2. While scan is running, change organization settings
3. Settings are saved automatically
4. Verify scan behavior (may continue with old org or restart)
5. Verify new scans use updated organization

#### 6.4 Test Scan with Invalid Organization
1. Enter invalid/non-existent organization ID
2. Settings are saved automatically
3. Trigger a Snyk scan
4. Verify appropriate error handling
5. Verify error message is clear and actionable

### Expected Results
- Scans use correct organization based on settings
- Organization changes are reflected in subsequent scans
- Error handling for invalid organizations works correctly
- Scan results correctly reflect organization settings

---

## Test Case 7: Migration Testing

### Objective
Verify the extension correctly handles migrated folder configs received from Language Server and properly displays/uses migrated organization settings.

**Note**: Migration logic itself is handled by Language Server. This test case verifies the extension correctly handles the migrated state.

### Prerequisites
- VSCode with Snyk extension
- Test workspace folder with existing organization setting
- Language Server initialized
- Access to Language Server config directory (for resetting migration state)
- `jq` and `sponge` tools installed (for resetting migration state)

### Steps

#### 7.1 Test Receiving Migrated Folder Config from LS
1. Open a workspace folder that has an organization setting but no folder config
2. Verify Language Server initializes
3. Verify extension receives folder config from LS via `$/snyk.folderConfig` notification
4. Verify migrated folder config is handled correctly:
   - Check that `orgMigratedFromGlobalConfig` flag is received from LS
   - Verify `preferredOrg` or `autoDeterminedOrg` is populated based on migration
   - Verify `orgSetByUser` is set correctly based on migration
   - Verify VSCode settings UI reflects the migrated state

#### 7.2 Test Display of Migrated Organization Settings
1. With migrated folder config received from LS:
   - Verify **"Snyk: Advanced: Auto Select Organization"** checkbox state matches `!orgSetByUser`
   - Verify **"Snyk: Advanced: Organization"** field shows correct value:
     - If `orgSetByUser = false`: Shows `autoDeterminedOrg` (if available)
     - If `orgSetByUser = true`: Shows `preferredOrg`
2. Verify settings are saved correctly in VSCode config

#### 7.3 Test Migration State Reset (for re-testing)
1. Locate Language Server config directory:
   - Typically in: `~/.config/snyk/` or similar location
   - Look for config file: `ls-config-Visual Studio Code` or similar
2. To reset folder config back to unmigrated state, use:
   ```bash
   jq '.INTERNAL_LS_CONFIG |= (fromjson | .folderConfigs |= map_values(del(.preferredOrg, .orgMigratedFromGlobalConfig, .orgSetByUser, .autoDeterminedOrg)) | tostring)' 'ls-config-Visual Studio Code' | sponge 'ls-config-Visual Studio Code'
   ```
3. Restart Language Server or VSCode
4. Verify extension receives unmigrated folder config from LS
5. Verify LS migrates it and sends back migrated config
6. Verify extension handles the re-migrated config correctly

#### 7.4 Test Migration with Default Organization
1. Set organization to user's default organization (or empty) in VSCode settings
2. Reset migration state (using command from 7.3)
3. Open workspace folder and trigger migration (handled by LS)
4. Verify extension receives migrated folder config with:
   - `orgSetByUser = false` (user opted into LDX-Sync)
   - `autoDeterminedOrg` populated from LDX-Sync
   - `orgMigratedFromGlobalConfig = true`
5. Verify VSCode settings UI reflects auto-select enabled

#### 7.5 Test Migration with Non-Default Organization
1. Set organization to a non-default organization in VSCode settings
2. Reset migration state
3. Open workspace folder and trigger migration (handled by LS)
4. Verify extension receives migrated folder config with:
   - `orgSetByUser = true` (user opted out of LDX-Sync)
   - `preferredOrg` set to the organization value
   - `orgMigratedFromGlobalConfig = true`
5. Verify VSCode settings UI reflects manual organization mode

#### 7.6 Test Migration with Existing Folder Config
1. Create a workspace folder with existing folder config (already migrated)
2. Verify extension receives folder config from LS
3. Verify migration does not run again (handled by LS)
4. Verify existing folder config values are preserved
5. Verify `orgMigratedFromGlobalConfig` remains `true`

#### 7.7 Test Extension Handling of Unmigrated Folder Configs
1. Reset migration state (using command from 7.3)
2. Open workspace folder
3. Verify extension receives unmigrated folder config from LS (if LS sends it)
4. Verify extension handles it gracefully:
   - No crashes or errors
   - Extension waits for LS to migrate
   - Extension receives migrated config after LS processes it

#### 7.8 Test Migration with Single Folder Workspace
1. Open a **single folder workspace**
2. Set organization at folder level (or user level) before migration
3. Reset migration state (using command from 7.3)
4. Open workspace folder and trigger migration (handled by LS)
5. Verify extension receives migrated folder config from LS
6. Verify `.vscode/settings.json` in the folder reflects migrated state:
   - Auto-select checkbox state matches `!orgSetByUser`
   - Organization field shows correct value
7. Verify settings are written to folder-level `.vscode/settings.json` (not workspace-level, since single folder)
8. Verify Language Server reads settings at folder level

#### 7.9 Test Migration with Multiple Folder Workspace
1. Open a **workspace with multiple folders**
2. Set different organization settings for different folders before migration:
   - Folder A: Organization "org-123" at folder level
   - Folder B: Organization at workspace level
   - Folder C: No organization setting (will use user-level or default)
3. Reset migration state for all folders
4. Open workspace and trigger migration (handled by LS)
5. Verify each folder receives its own migrated folder config from LS
6. Verify each folder's `.vscode/settings.json` reflects its migrated state:
   - Folder A: Settings in Folder A's `.vscode/settings.json`
   - Folder B: Settings in workspace root `.vscode/settings.json` (workspace-level)
   - Folder C: May use user-level settings or default
7. Verify workspace root `.vscode/settings.json` does NOT contain folder-specific org settings for Folder A
8. Verify Language Server reads each folder's settings at folder level (like other IDEs)

#### 7.10 Test Migration with Workspace-Level Organization
1. Open workspace with multiple folders
2. Set organization at **workspace level** (workspace root `.vscode/settings.json`) before migration
3. Reset migration state
4. Open workspace and trigger migration (handled by LS)
5. Verify:
   - Workspace-level organization is migrated by LS
   - Each folder receives migrated folder config (may inherit from workspace-level)
   - Workspace root `.vscode/settings.json` reflects migrated state
   - Individual folder `.vscode/settings.json` files do NOT contain org settings (unless explicitly set at folder level)
   - Language Server reads settings at folder level, using workspace-level as fallback

#### 7.11 Test Migration with Global/User-Level Organization
1. Set organization at **user/global level** (user `settings.json`) before migration
2. Open workspace folder(s) without folder/workspace-level org settings
3. Reset migration state
4. Trigger migration (handled by LS)
5. Verify:
   - User-level organization is migrated by LS
   - Folders without folder/workspace-level settings receive migrated config based on user-level
   - User `settings.json` reflects migrated state
   - NO `.vscode/settings.json` files are created/modified (user-level doesn't require workspace files)
   - Language Server reads settings at folder level, using user-level as fallback

#### 7.12 Test Migration - Settings.json Writing Behavior
**Objective**: Verify settings are only written to `.vscode/settings.json` when relevant after migration.

1. **Test: Migration with Default Values**
   - Reset migration state
   - Open folder with no existing org settings
   - Trigger migration (LS migrates to auto-select enabled, default org)
   - Verify:
     - If migrated state matches defaults, `.vscode/settings.json` may not need org settings
     - Settings.json should only be written if migrated state differs from defaults
     - Language Server uses folder config (which may have migrated values)

2. **Test: Migration with Non-Default Values**
   - Reset migration state
   - Open folder with existing org setting (non-default)
   - Trigger migration (LS migrates to manual mode with preferred org)
   - Verify:
     - `.vscode/settings.json` contains migrated org settings
     - Settings reflect migrated state (auto-select false, preferred org set)
     - Settings are written because they differ from defaults

3. **Test: Migration - Multiple Folders, Different States**
   - Open workspace with multiple folders
   - Folder A: Has org setting → migrates to manual mode
   - Folder B: No org setting → migrates to auto-select mode
   - Verify:
     - Folder A's `.vscode/settings.json` contains org settings (non-default)
     - Folder B's `.vscode/settings.json` may not contain org settings (if default)
     - Workspace root `.vscode/settings.json` does NOT contain folder-specific settings

### Expected Results
- Extension correctly receives and stores migrated folder configs from LS
- VSCode settings UI correctly reflects migrated organization state
- Extension handles both migrated and unmigrated folder configs gracefully
- `orgMigratedFromGlobalConfig` flag is correctly stored and used
- Settings persist correctly after migration
- **Single folder workspace**: Migration settings written to folder-level `.vscode/settings.json` when relevant
- **Multiple folder workspace**: Each folder migrates independently; workspace-level migration works as fallback
- **Workspace-level migration**: Settings written to workspace root `.vscode/settings.json` when relevant
- **User-level migration**: Settings written to user `settings.json`; no workspace files created unnecessarily
- **Settings.json writing**: Settings are only written when they differ from defaults or when explicitly needed
- **Language Server reads at folder level**: Like other IDEs, LS reads folder-level settings, using workspace/user as fallback

---

## Test Case 8: Configuration Hierarchy Changes

### Objective
Verify changes to configuration at different levels (folder/workspace/user) are handled correctly and do not affect folder configs inappropriately.

### Prerequisites
- VSCode with Snyk extension
- Authenticated Snyk account
- Test workspace folder with migrated folder config
- Multiple organizations available

### Steps

#### 7.1 Test Adding/Changing Organization at Folder Level
1. Ensure workspace folder has migrated folder config
2. Open Settings
3. Set **"Snyk: Advanced: Organization"** at folder level (in `.vscode/settings.json`)
4. Settings are saved automatically
5. Verify:
   - Folder-level organization is saved in `.vscode/settings.json`
   - **Folder configs are updated** (folder-specific settings take precedence)
   - Language Server receives updated folder config with `preferredOrg`
   - If folder has no preferred org, fallback to folder-level setting works

#### 7.2 Test Deleting/Blanking Organization at Folder Level
1. Ensure workspace folder has migrated folder config
2. Open Settings
3. Clear **"Snyk: Advanced: Organization"** at folder level (set to empty)
4. Settings are saved automatically
5. Verify:
   - Folder-level organization is cleared in `.vscode/settings.json`
   - **Folder configs are updated** (`preferredOrg` may be cleared)
   - Language Server receives updated folder config
   - If folder has no preferred org, fallback to workspace/user level works

#### 7.3 Test Organization Change at Workspace Level
1. Set organization at workspace level (in workspace root's `.vscode/settings.json`)
2. Verify folder config uses folder-level org if set (not workspace-level)
3. Clear folder-level organization
4. Verify fallback to workspace-level organization works
5. Verify Language Server receives correct organization

#### 7.4 Test Organization Change at User Level
1. Set organization at user level (in user `settings.json`)
2. Clear folder and workspace-level organizations
3. Verify fallback to user-level organization works
4. Verify Language Server receives correct organization

#### 7.5 Test Organization Change with Auto-Select Enabled
1. Enable auto-select at folder level
2. Change organization at workspace or user level
3. Settings are saved automatically
4. Verify:
   - Folder uses `autoDeterminedOrg` (not workspace/user org)
   - Workspace/user org change does not affect folder config
   - Scans use `autoDeterminedOrg`

#### 7.6 Test Configuration Hierarchy Precedence
1. Set different organizations at different levels:
   - Folder level: "org-folder"
   - Workspace level: "org-workspace"
   - User level: "org-user"
2. Verify folder-level takes precedence
3. Clear folder-level, verify workspace-level is used
4. Clear workspace-level, verify user-level is used

### Expected Results
- Organization changes at different levels are saved correctly
- Configuration hierarchy precedence works correctly
- Folder configs are updated appropriately when folder-level settings change
- Language Server receives correct organization based on hierarchy
- Fallback logic works correctly when folder has no preferred org

---

## Test Case 9: Opting In/Out of Automatic Org Selection (Critical)

### Objective
Verify opting in and out of automatic organization selection works correctly (critical functionality).

### Prerequisites
- VSCode with Snyk extension
- Authenticated Snyk account
- Test workspace folder with migrated folder config
- Language Server has `autoDeterminedOrg` populated

### Steps

#### 9.1 Test Opting In to Automatic Org Selection
1. Ensure auto-select is currently **disabled** (checkbox unchecked)
2. Ensure folder has a preferred org set
3. Open Settings
4. Check **"Snyk: Advanced: Auto Select Organization"** checkbox
5. Settings are saved automatically
6. Verify folder config sent to Language Server:
   - `OrgSetByUser = false`
   - `PreferredOrg = ""` (cleared)
   - `AutoDeterminedOrg` is preserved (from LS)
7. Verify Language Server uses `AutoDeterminedOrg` for scans
8. Verify VSCode config shows `autoDeterminedOrg` in organization field (if available)

#### 9.2 Test Opting Out of Automatic Org Selection
1. Ensure auto-select is currently **enabled** (checkbox checked)
2. Open Settings
3. Uncheck **"Snyk: Advanced: Auto Select Organization"** checkbox
4. Settings are saved automatically
5. Verify folder config sent to Language Server:
   - `OrgSetByUser = true`
   - `PreferredOrg = ""` (remains empty, user can enter value)
   - `AutoDeterminedOrg` is preserved (from LS)
6. Verify Language Server uses organization from VSCode config hierarchy as fallback (since preferred org is empty)
7. Verify user can now enter preferred org manually

#### 9.3 Test Opting In - Verify Preferred Org is Cleared
1. Set organization to a specific value
2. Enable auto-select (check checkbox)
3. Settings are saved automatically
4. Verify:
   - `PreferredOrg = ""` in folder config
   - `OrgSetByUser = false`
   - Scans use `AutoDeterminedOrg`

#### 9.4 Test Opting Out - Verify Preferred Org Can Be Set
1. Enable auto-select
2. Disable auto-select (uncheck checkbox)
3. Enter a preferred organization
4. Settings are saved automatically
5. Verify:
   - `PreferredOrg` = entered value
   - `OrgSetByUser = true`
   - Scans use `PreferredOrg`

#### 9.5 Test Opting In/Out Multiple Times
1. Toggle auto-select checkbox multiple times
2. Make various changes
3. Settings are saved automatically after each change
4. Verify:
   - Each state is saved correctly
   - Folder config reflects current checkbox state
   - Language Server receives correct updates
   - No state corruption or errors

### Expected Results
- Opting in to auto-select clears `PreferredOrg` and sets `OrgSetByUser = false`
- Opting out of auto-select sets `OrgSetByUser = true` and allows manual org entry
- `AutoDeterminedOrg` is always preserved (never modified by extension)
- Language Server uses correct organization based on current setting
- Multiple toggles work correctly without state corruption

---

## Test Case 10: VSCode Restart Scenarios

### Objective
Verify organization settings persist correctly after VSCode restart and folder configs are refreshed.

### Prerequisites
- VSCode with Snyk extension
- Authenticated Snyk account
- Test workspace folder with folder configs
- Multiple organizations available

### Steps

#### 10.1 Test VSCode Restart - Authenticated User
1. Configure workspace folder with specific organization settings:
   - Set preferred org or enable auto-select
   - Settings are saved automatically
2. Close VSCode completely
3. Reopen VSCode
4. Open the same workspace folder
5. Verify:
   - Settings persist correctly (VSCode feature)
   - Folder configs are loaded from storage
   - **Every folder config re-fetches `AutoDeterminedOrg` from LDX-Sync**
   - Language Server sends updated folder configs with fresh `AutoDeterminedOrg`
   - Scans use correct organization

#### 10.2 Test VSCode Restart - Unauthenticated User
1. Ensure user is **not authenticated**
2. Configure organization settings (if possible)
3. Close VSCode
4. Reopen VSCode
5. Open the same workspace folder
6. Verify:
   - **No-op**: Use previously saved values for all fields
   - `AutoDeterminedOrg` remains empty (cannot fetch without auth)
   - Folder configs use stored values
   - No errors occur

#### 10.3 Test VSCode Restart - Then Authenticate
1. While unauthenticated, configure settings
2. Close and reopen VSCode
3. Authenticate (OAuth2 or Token)
4. Verify:
   - Folder configs are refreshed
   - `AutoDeterminedOrg` is populated from LDX-Sync
   - Settings work correctly after authentication

#### 10.4 Test VSCode Restart - Multiple Workspace Folders
1. Open workspace with multiple folders (File → Add Folder to Workspace)
2. Configure different organization settings for different folders
3. Close VSCode
4. Reopen VSCode
5. Open the same workspace with all folders
6. Verify:
   - Each folder maintains its own organization settings
   - Each folder config re-fetches `AutoDeterminedOrg`
   - No cross-contamination between folders

### Expected Results
- Settings persist correctly after VSCode restart (VSCode feature)
- Authenticated users: folder configs re-fetch `AutoDeterminedOrg` from LDX-Sync
- Unauthenticated users: use previously saved values (no-op)
- Multiple workspace folders maintain independent settings
- No errors or state corruption after restart

---

## Test Case 11: Configuration Watcher Bidirectional Sync

### Objective
Verify `ConfigurationWatcher` correctly syncs changes in both directions (VSCode config ↔ folder configs).

### Prerequisites
- VSCode with Snyk extension
- Authenticated Snyk account
- Test workspace folder
- Language Server initialized

### Steps

#### 11.1 Test VSCode Config → Folder Config Sync (Auto-Select)
1. Open Settings
2. Toggle **"Snyk: Advanced: Auto Select Organization"** checkbox
3. Settings are saved automatically
4. Verify `ConfigurationWatcher` detects the change
5. Verify `syncFolderConfigAutoOrgOnChange` is called
6. Verify folder config is updated:
   - `orgSetByUser` matches checkbox state (`!autoSelectOrganization`)
7. Verify Language Server receives update via `WorkspaceDidChangeConfiguration`

#### 11.2 Test VSCode Config → Folder Config Sync (Organization)
1. Open Settings
2. Change **"Snyk: Advanced: Organization"** field
3. Settings are saved automatically
4. Verify `ConfigurationWatcher` detects the change
5. Verify `syncFolderConfigPreferredOrgOnWorkspaceFolderOrgSettingChanged` is called
6. Verify folder config is updated:
   - `preferredOrg` matches organization field value
7. Verify Language Server receives update

#### 11.3 Test Folder Config → VSCode Config Sync (from LS)
1. Language Server sends updated folder config via `$/snyk.folderConfig` notification
2. Verify `handleOrgSettingsFromFolderConfigs` is called
3. Verify VSCode config is updated:
   - Organization field shows `autoDeterminedOrg` or `preferredOrg` based on `orgSetByUser`
   - Auto-select checkbox matches `!orgSetByUser`
4. Verify `foldersBeingUpdatedByLS` flag prevents circular updates

#### 11.4 Test Circular Update Prevention
1. Change organization setting in VSCode UI
2. Verify `foldersBeingUpdatedByLS` flag is set when LS updates VSCode config
3. Verify watcher skips updates when flag is set:
   - Check `LanguageServer.isLSUpdatingOrg()` in watcher
4. Verify flag is cleared after update completes
5. Verify no infinite loops occur

#### 11.5 Test Rapid Changes
1. Make rapid changes to organization settings
2. Toggle auto-select multiple times
3. Change organization value multiple times
4. Verify `ConfigurationWatcher` handles rapid changes correctly
5. Verify no race conditions
6. Verify final state is correct

#### 11.6 Test Direct JSON Editing
1. Open `settings.json` directly
2. Manually edit organization settings
3. Save the file
4. Verify `ConfigurationWatcher` detects the change
5. Verify folder config is updated
6. Verify Language Server receives update

### Expected Results
- `ConfigurationWatcher` correctly syncs VSCode config changes to folder configs
- `handleOrgSettingsFromFolderConfigs` correctly syncs folder configs to VSCode config
- Circular updates are prevented via `foldersBeingUpdatedByLS` flag
- Rapid changes are handled correctly
- Direct JSON editing works correctly
- No infinite loops or race conditions

---

## Error Monitoring

Throughout all tests, monitor:

### VSCode Output Panel
- **View → Output** → Select "Snyk" from dropdown
- Look for exceptions, errors, or warnings related to:
  - Organization settings
  - Folder config updates
  - Language Server communication
  - Configuration watcher

### Developer Console
- **Help → Toggle Developer Tools**
- Monitor for:
  - `NullPointerException`
  - `IllegalArgumentException`
  - JSON parsing errors
  - Configuration loading errors
  - Language Server communication errors

### Language Server Logs
- Check Language Server output/logs
- Verify folder config updates are received
- Verify organization resolution works correctly

### Common Issues to Watch For
- Settings not persisting
- UI state not matching actual configuration
- Language Server not receiving updates
- Organization fallback not working
- Race conditions in configuration updates
- Memory leaks from event listeners
- **Circular updates between VSCode config and folder configs** (VSCode-specific)

---

## Regression Testing

Verify existing functionality still works:

### Basic Functionality
- ✅ Basic Snyk scanning (OSS, Code, IaC)
- ✅ Authentication flow (OAuth2 and Token)
- ✅ Issue display and filtering
- ✅ Preferences management (other settings)
- ✅ Language server communication (general)

### Settings Persistence
- ✅ Workspace-level settings persist across VSCode restarts
- ✅ Folder-level settings persist across workspace close/open
- ✅ Settings survive extension updates (if applicable)

### UI Components
- ✅ Settings UI opens/closes correctly
- ✅ All other settings sections work as before
- ✅ Snyk view displays correctly
- ✅ Issue tree/filtering works correctly

---

## Test Data Preparation

### Organizations Setup
1. Create/identify test organizations:
   - Organization A: Default organization
   - Organization B: Secondary organization
   - Organization C: Organization with specific projects
   - Organization D: Organization with Code disabled

### Workspace Folders Setup
1. Create test workspace folders:
   - Folder with no `.vscode/settings.json` (uses defaults)
   - Folder with `.vscode/settings.json` containing organization
   - Folder in multiple organizations
   - Folder with invalid organization reference

### Authentication Setup
1. Ensure test account has access to multiple organizations
2. Verify LDX-Sync is working (for auto-select)
3. Test with both OAuth2 and Token authentication

---

## Success Criteria

All test cases should pass with:
- ✅ No crashes or unhandled exceptions
- ✅ Settings persist correctly
- ✅ Language Server receives correct configuration
- ✅ Scans use correct organization
- ✅ UI reflects actual configuration state
- ✅ Fallback behavior works correctly
- ✅ No regression in existing functionality
- ✅ **Migration is handled correctly** (Test Case 7 - extension handles migrated folder configs from LS)
- ✅ **Configuration hierarchy changes don't affect folder configs inappropriately** (Test Case 8)
- ✅ **Opting in/out of automatic org selection works correctly** (Test Case 9 - Critical)
- ✅ **Settings persist correctly after VSCode restart** (Test Case 10)
- ✅ **Configuration Watcher bidirectional sync works correctly** (Test Case 11 - VSCode-specific)

---

## Notes

### VSCode-Specific Considerations
- Settings are accessed via **File → Preferences → Settings** (Windows/Linux) or **Code → Preferences → Settings** (macOS)
- Settings can be edited in GUI or JSON view
- Settings are resource-scoped (folder-level) by default
- Settings are saved automatically (no Apply button)
- Folder configs are managed per workspace folder
- Configuration hierarchy: folder → workspace → user → default

### Language Server Integration
- Organization settings are synchronized via `WorkspaceDidChangeConfiguration`
- Language Server sends folder configs via `$/snyk.folderConfig` notification
- `autoDeterminedOrg` is always provided by Language Server (never modified by extension)
- `preferredOrg` and `orgSetByUser` are set by extension based on VSCode config
- `ConfigurationWatcher` syncs VSCode config changes to folder configs

### Configuration Watcher Notes
- `ConfigurationWatcher` monitors VSCode config changes
- Syncs changes bidirectionally: VSCode config ↔ folder configs
- Uses `foldersBeingUpdatedByLS` flag to prevent circular updates
- Handles rapid changes and direct JSON editing

