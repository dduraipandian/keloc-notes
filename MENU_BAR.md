# mdnotes — Native Menu Bar Implementation Plan

**Scope.** Build a professional-grade native menu bar for mdnotes that follows the Apple Human Interface Guidelines (HIG). macOS only in this pass; Go code is structured so Windows / Linux menu builders can be added later without a refactor.

**Deliverables.**

- Native macOS menu bar (App, File, Edit, View, Window, Help).
- Native-styled **Preferences** window (Appearance, Folder accent color).
- **About** dialog styled like the native macOS About panel.
- **Markdown import/export** (single note + folder-preserving `.zip`).
- **IndexedDB JSON backup** import/export for power users.
- Dynamic enablement: menu items enable / disable / check based on app state.
- Keyboard-shortcut reconciliation: menu accelerators own global shortcuts; JS keeps pane-scoped shortcuts.

**Audience.** Junior contributors. Follow the ground rules, do work items M1 → M11 in order, and each item starts by writing a failing test.

---

## Ground rules (read before starting any item)

1. **Sequential execution.** Do items in order: M1 → M11 (M12 optional). Each item's tests must pass before moving to the next.
2. **Tests first (TDD).** Write or update test cases **before** implementation. Run them, confirm they fail for the right reason, then implement until they pass.
3. **Do not edit existing tests** unless the item explicitly says to. Ask permission if you believe a test must change.
4. **Run full suite after each item.** `cd frontend && npm run test && npm run check` for frontend, `go test ./...` for Go.
5. **Manual verification for UI-visible changes.** Use `wails dev` and exercise the path described in the item's Verification step.
6. **No new frontend dependencies** without approval. Go dependencies are limited to Go stdlib (`archive/zip`, `encoding/json`, `os`) plus existing Wails packages.
7. **Scope discipline.** Change only what each item lists. If you spot an adjacent bug, add it to Part B of [CHECKLIST.md](CHECKLIST.md) — do not fix it here.

Commands:

```bash
cd frontend
npm run test                                   # all tests
npm run test -- <path/to/file.test.ts>         # single file
npm run check                                  # svelte-check + tsc (must exit 0)
# From repo root:
go test ./...                                  # Go tests
wails dev                                      # full-stack dev
```

---

## Architecture overview

### Menu tree

```
mdnotes (App menu)
├─ About mdnotes                  → opens About dialog
├─ ─────
├─ Preferences...  ⌘,             → opens Preferences window
├─ ─────
├─ Services                       → macOS system services (role)
├─ ─────
├─ Hide mdnotes       ⌘H          (role)
├─ Hide Others        ⌥⌘H         (role)
├─ Show All                       (role)
├─ ─────
└─ Quit mdnotes       ⌘Q          (role)

File
├─ New Note           ⌘N          → noteService.create
├─ New Folder         ⇧⌘N         → folderService.create
├─ ─────
├─ Close Window       ⌘W          (role)
├─ ─────
├─ Import ▸
│  ├─ Markdown Archive (.zip)...  → Markdown import flow
│  └─ Backup (.json)...           → JSON backup restore
├─ Export ▸
│  ├─ Current Note (.md)  ⇧⌘E     → single note export   [enabled when a note is selected]
│  ├─ All Notes (.zip)...         → bulk Markdown export
│  └─ Backup (.json)...           → JSON backup export
├─ ─────
├─ Move to Trash      ⌘⌫          [enabled when selected note is not already in trash]
└─ Empty Trash        ⇧⌘⌫         [enabled when trash has items]

Edit
├─ Undo               ⌘Z          (role)
├─ Redo               ⇧⌘Z         (role)
├─ ─────
├─ Cut                ⌘X          (role)
├─ Copy               ⌘C          (role)
├─ Paste              ⌘V          (role)
├─ Select All         ⌘A          (role)
├─ ─────
├─ Find               ⌘F          → focuses note-list search input
├─ ─────
├─ Start Dictation                (role — macOS system)
└─ Emoji & Symbols    ⌃⌘Space     (role — macOS system)

View
├─ Toggle Sidebar     ⌃⌘S         → hides / shows folder pane
├─ Toggle Note List   ⌃⌘L         → hides / shows notes pane
├─ ─────
├─ Appearance ▸
│  ├─ Light                       [checkmark when theme is 'light']
│  ├─ Dark                        [checkmark when theme is 'dark']
│  └─ Follow System               [checkmark when theme is 'system']
├─ ─────
└─ Enter Full Screen  ⌃⌘F         (role)

Window
├─ Minimize           ⌘M          (role)
├─ Zoom                           (role)
├─ ─────
└─ Bring All to Front             (role)

Help
├─ mdnotes Help                   → placeholder, emits menu:help (bridge no-op for now)
└─ Report a Bug                   → placeholder, emits menu:help (bridge no-op for now)
```

### Dynamic enablement matrix

| Menu item                      | Enabled / checked when                                                      |
| ------------------------------ | --------------------------------------------------------------------------- |
| Export → Current Note (.md)    | `selectedNote != null`                                                      |
| Move to Trash                  | `selectedNote != null && !selectedNote.deletedAt`                           |
| Empty Trash                    | any note or folder has `deletedAt` set                                      |
| Appearance → Light/Dark/System | use **checkbox**-style items; checkmark reflects current `themeStore.theme` |

### Go↔JS event contract

**Go → JS events (emitted when the user clicks a menu item):**

| Event                      | Payload                         | Bridge handler                                        |
| -------------------------- | ------------------------------- | ----------------------------------------------------- |
| `menu:new-note`            | —                               | `noteService.create(selectionStore.selectedFolderID)` |
| `menu:new-folder`          | —                               | `folderService.create()`                              |
| `menu:delete-note`         | —                               | `uiStore.confirmNoteDelete(...)`                      |
| `menu:empty-trash`         | —                               | `uiStore.confirmEmptyTrash(...)`                      |
| `menu:focus-search`        | —                               | focus the notes-pane search input                     |
| `menu:toggle-sidebar`      | —                               | `uiStateStore.toggleSidebar()`                        |
| `menu:toggle-note-list`    | —                               | `uiStateStore.toggleNoteList()`                       |
| `menu:set-theme`           | `'light' \| 'dark' \| 'system'` | `themeStore.setTheme(payload)`                        |
| `menu:open-preferences`    | —                               | show Preferences modal                                |
| `menu:open-about`          | —                               | show About modal                                      |
| `menu:export-note`         | —                               | single-note markdown export                           |
| `menu:export-all-markdown` | —                               | bulk markdown export                                  |
| `menu:export-backup`       | —                               | JSON backup export                                    |
| `menu:import-markdown`     | —                               | markdown zip import                                   |
| `menu:import-backup`       | —                               | JSON backup import                                    |
| `menu:help`                | —                               | placeholder, no-op                                    |

**JS → Go (bound methods):**

| Method                                 | Purpose                                                              |
| -------------------------------------- | -------------------------------------------------------------------- |
| `App.UpdateMenuState(state)`           | push current Svelte state → Go updates item `.Disabled` / `.Checked` |
| `App.ExportNoteToFile(title, content)` | write a `.md` via save dialog                                        |
| `App.ExportNotesZip(payload)`          | save zip via save dialog                                             |
| `App.ImportNotesZip()`                 | open dialog, read zip, return parsed notes                           |
| `App.SaveBackupFile(content)`          | save JSON backup via save dialog                                     |
| `App.ReadBackupFile()`                 | open dialog, return file contents                                    |

### `MenuState` (Go)

```go
type MenuState struct {
    HasSelectedNote     bool
    SelectedNoteInTrash bool
    TrashHasItems       bool
    Theme               string // "light" | "dark" | "system"
}
```

### Keyboard-shortcut ownership

| Shortcut                                                 | Owner                | Notes                                    |
| -------------------------------------------------------- | -------------------- | ---------------------------------------- |
| ⌘N, ⇧⌘N, ⌘,, ⌘F, ⌘⌫, ⇧⌘⌫, ⇧⌘E, ⌃⌘S, ⌃⌘L                  | Go menu accelerators | Global actions; menu owns them           |
| ⌘Z/Y, ⌘X/C/V/A, ⌘Q/W/H/M, ⌃⌘F                            | Go menu roles        | System roles provide these               |
| `/`, `Escape`, arrow keys, `Enter`, `Delete`/`Backspace` | JS (`shortcuts.ts`)  | Pane-scoped / DOM-contextual, keep in JS |

---

## Items table

| ID  | Title                                                 | Priority | Effort | Depends on | Status |
| --- | ----------------------------------------------------- | -------- | ------ | ---------- | ------ |
| M1  | Go menu package scaffold + App menu                   | P0       | 2 h    | —          | `[x]`  |
| M2  | File menu (create/close/trash)                        | P0       | 2 h    | M1         | `[x]`  |
| M3  | Edit menu (roles + Find)                              | P0       | 1 h    | M1         | `[x]`  |
| M4  | View menu (toggles + Appearance)                      | P0       | 2 h    | M1         | `[x]`  |
| M5  | Window + Help menus                                   | P1       | 45 min | M1         | `[x]`  |
| M6  | Dynamic enablement bridge                             | P0       | 2 h    | M1–M5      | `[ ]`  |
| M7  | Keyboard-shortcut reconciliation                      | P0       | 45 min | M1–M5      | `[ ]`  |
| M8  | About dialog                                          | P1       | 1 h    | M1         | `[ ]`  |
| M9  | Preferences window (Appearance + Folder accent color) | P1       | 3 h    | M1         | `[ ]`  |
| M10 | Markdown import / export (zip)                        | P1       | 3 h    | M2         | `[ ]`  |
| M11 | IndexedDB JSON backup                                 | P2       | 2 h    | M2         | `[ ]`  |
| M12 | Windows / Linux extensibility scaffolding             | P2       | 30 min | M1         | `[ ]`  |

---

## M1 — Go menu package scaffold + App menu

**Goal.** Create an extensible Go package that builds the macOS menu bar. Wire it into Wails. First pass: App menu only (About, Preferences..., Services, Hide, Quit).

### Step 1 — Write the Go integration test first

1. Create `menu/menu_test.go`.
2. Assert `BuildMacMenu(host)` returns a `*menu.Menu` whose first submenu is titled `mdnotes` and contains items with labels: `About mdnotes`, `Preferences...`, `Quit mdnotes`.
3. Assert the `Preferences...` accelerator is `Cmd+,`.
4. **Test gate:** `go test ./menu/...` fails because the package does not exist.

### Step 2 — Create the `menu/` package

1. Create `menu/menu.go`.
2. Define a small interface so the package does not depend on `main`:
   ```go
   type MenuHost interface {
       OnOpenAbout()
       OnOpenPreferences()
       // Grows as later items land.
   }
   ```
3. Implement `BuildMacMenu(host MenuHost) *menu.Menu` using `github.com/wailsapp/wails/v2/pkg/menu` and `pkg/menu/keys`.
4. Populate the App submenu:
   - About mdnotes → `host.OnOpenAbout()`
   - Separator
   - Preferences... with `keys.CmdOrCtrl(",")` → `host.OnOpenPreferences()`
   - Separator
   - Services submenu (role)
   - Separator
   - Hide / Hide Others / Show All (roles)
   - Separator
   - Quit (role)
5. **Test:** rerun `go test ./menu/...` — integration test passes.

### Step 3 — Wire menu into `main.go` and `app.go`

1. In [main.go](main.go), add `Menu: menuPkg.BuildMacMenu(app)` to the `options.App{...}` struct.
2. In [app.go](app.go), implement `OnOpenAbout()` and `OnOpenPreferences()` — each calls `runtime.EventsEmit(a.ctx, "menu:open-about")` / `"menu:open-preferences"`.
3. No test here — manual only, see Step 4.

### Step 4 — Manual verification

1. `wails dev`.
2. The macOS menu bar shows **mdnotes** at the left with `About mdnotes`, `Preferences...`, standard Services/Hide/Quit.
3. Click `Preferences...` — no visible effect (Svelte side not wired yet). In DevTools, confirm the `menu:open-preferences` event fires.
4. ⌘Q quits the app.

**PR title:** `feat(menu): scaffold Go menu package and macOS App menu`.

---

## M2 — File menu

**Goal.** File menu with New Note, New Folder, Close Window, Move to Trash, Empty Trash. Import/Export submenus are created as empty stubs (M10/M11 fill them in). Events are wired end-to-end.

### Step 1 — Go test

1. Extend `menu/menu_test.go`. Assert File submenu exists and contains `New Note` (⌘N), `New Folder` (⇧⌘N), `Move to Trash` (⌘⌫), `Empty Trash` (⇧⌘⌫), plus empty `Import` and `Export` submenus.
2. **Test gate:** fails.

### Step 2 — Extend `menu/menu.go`

1. Add `buildFileMenu(host MenuHost) *menu.MenuItem`.
2. Extend `MenuHost` with `OnNewNote()`, `OnNewFolder()`, `OnDeleteNote()`, `OnEmptyTrash()`.
3. Accelerators:
   - `keys.CmdOrCtrl("n")` for New Note
   - `keys.Combo("n", keys.CmdOrCtrlKey, keys.ShiftKey)` for New Folder
   - `keys.Combo("Backspace", keys.CmdOrCtrlKey)` for Move to Trash
   - `keys.Combo("Backspace", keys.CmdOrCtrlKey, keys.ShiftKey)` for Empty Trash
4. Append File submenu after App submenu in `BuildMacMenu`.
5. Test passes.

### Step 3 — Go event emitters

1. In [app.go](app.go), add `OnNewNote`, `OnNewFolder`, `OnDeleteNote`, `OnEmptyTrash` — each emits its matching `menu:*` event.

### Step 4 — Write the Svelte bridge test first

1. Create `frontend/tests/unit/menuBridge.test.ts`.
2. Cases:
   - (a) `menu:new-note` → `noteService.create` is called with `selectionStore.selectedFolderID`.
   - (b) `menu:new-folder` → `folderService.create` is called.
   - (c) `menu:delete-note` when `selectedNote.deletedAt == null` → `uiStore.confirmNoteDelete` is called.
3. Mock `$lib/wailsjs/runtime/runtime`'s `EventsOn` — the handler you register should be invoked synchronously by your mock when you call an `emit(event, payload)` helper.
4. **Test gate:** fails (bridge does not exist).

### Step 5 — Create the Svelte menu bridge

1. Create `frontend/src/lib/menu/menuBridge.svelte.ts` exporting `initMenuBridge(): () => void` (returns unsubscribe).
2. Inside: subscribe to each `menu:*` event listed in the Event Contract, dispatching to the appropriate service / store.
3. In [+layout.svelte](frontend/src/routes/+layout.svelte) `onMount`, call `initMenuBridge()` and include its unsubscribe function in the cleanup return.
4. Test passes.

### Step 6 — Manual verification

1. `wails dev`.
2. File → New Note creates a note in the active folder.
3. File → New Folder opens the folder-creation flow.
4. File → Move to Trash deletes the selected note (confirmation dialog).
5. File → Empty Trash prompts and empties trash.

**PR title:** `feat(menu): File menu with create / close / trash actions`.

---

## M3 — Edit menu

**Goal.** Edit menu backed by native roles (Undo / Redo / Cut / Copy / Paste / Select All / Dictation / Emoji) plus a custom Find item.

### Step 1 — Go test

Assert Edit submenu contains role-based items for Undo, Redo, Cut, Copy, Paste, Select All, plus a `Find` item with accelerator ⌘F.

### Step 2 — Implement

1. If Wails v2 exposes a helper like `menu.EditMenu()`, use it — it provides Cut/Copy/Paste/Dictation/Emoji & Symbols with correct system wiring.
2. Otherwise append items manually via `AppendRole(menu.UndoRole)`, `menu.CopyRole`, etc.
3. Append a `Find` item with `keys.CmdOrCtrl("f")` → `host.OnFocusSearch()`.

### Step 3 — Wire Find in Svelte

1. `OnFocusSearch` emits `menu:focus-search`.
2. Bridge handler: set `uiStateStore.activePane = 'notes'`, then focus the search input (`document.querySelector('[data-testid="notes-pane"] input')`).

### Step 4 — Verification

1. `wails dev`. ⌘X / ⌘C / ⌘V work in any text input.
2. ⌘F focuses the search input regardless of which pane was active.

**PR title:** `feat(menu): Edit menu with system roles and Find`.

---

## M4 — View menu

**Goal.** Toggle Sidebar, Toggle Note List, Appearance submenu with Light / Dark / Follow System (checkmark reflects active theme).

### Step 1 — State plumbing & tests first

1. In [uiState.svelte.ts](frontend/src/lib/stores/uiState.svelte.ts), add `sidebarVisible = $state(true)`, `noteListVisible = $state(true)`, plus `toggleSidebar()` / `toggleNoteList()` methods.
2. Write tests in `frontend/tests/unit/uiState.test.ts`:
   - `toggleSidebar()` flips `sidebarVisible`.
   - `toggleNoteList()` flips `noteListVisible`.
3. Write a bridge test: `menu:set-theme` with `'dark'` → `themeStore.setTheme('dark')` is called.
4. Bridge test: `menu:toggle-sidebar` → `uiStateStore.toggleSidebar()` is called.
5. **Test gate:** tests fail.

### Step 2 — Implement state & wire layout

1. Implement the store methods.
2. In [+layout.svelte](frontend/src/routes/+layout.svelte), conditionally render the sidebar / note-list panes based on `sidebarVisible` / `noteListVisible`. Prefer `display: none` / width 0 so pane widths are preserved when re-shown.

### Step 3 — Extend `menu/menu.go`

1. Add `buildViewMenu(host MenuHost) *menu.MenuItem`.
2. Items:
   - Toggle Sidebar — `keys.Combo("s", keys.ControlKey, keys.CmdOrCtrlKey)` → `host.OnToggleSidebar()`
   - Toggle Note List — `keys.Combo("l", keys.ControlKey, keys.CmdOrCtrlKey)` → `host.OnToggleNoteList()`
   - Separator
   - Appearance submenu with three **checkbox-style** items (`Type: menu.CheckboxType`) — Light / Dark / Follow System. Each calls `host.OnSetTheme("light" | "dark" | "system")`.
   - Separator
   - Enter Full Screen (role)
3. `App.OnSetTheme(value)` emits `menu:set-theme` with the payload.

### Step 4 — Verification

1. `wails dev`. View → Toggle Sidebar hides/shows the folder pane; same for Toggle Note List.
2. Appearance → Dark switches theme; checkmark moves once M6 (dynamic enablement) lands. Until then the checkmark won't update — that's expected.

**PR title:** `feat(menu): View menu with pane toggles and appearance`.

---

## M5 — Window + Help menus

**Goal.** Standard Window menu via roles. Help menu with placeholder items.

### Steps

1. **Window:** use `menu.WindowMenu()` if available — provides Minimize, Zoom, Bring All to Front. Otherwise build manually (`menu.MinimizeRole`, `menu.ZoomRole`).
2. **Help:** add `mdnotes Help` and `Report a Bug` items. Both call `host.OnHelp(topic string)` which emits `menu:help` with a string payload (`'help' | 'report-bug'`). Bridge handler is a no-op that logs for now.
3. **Test:** integration test confirms both menus exist with expected items.
4. **Verification:** `wails dev` — ⌘M minimizes the window; Help menu shows both items.

**PR title:** `feat(menu): Window and Help menus`.

---

## M6 — Dynamic enablement bridge

**Goal.** Menu items enable / disable / check according to the current app state.

### Step 1 — Go: `MenuState` + `UpdateMenuState`

1. Create `menu/state.go` with the `MenuState` struct (see Architecture section).
2. Modify `BuildMacMenu` to return a `*MenuRefs` struct alongside the menu:
   ```go
   type MenuRefs struct {
       MoveToTrash       *menu.MenuItem
       EmptyTrash        *menu.MenuItem
       ExportCurrentNote *menu.MenuItem
       AppearanceLight   *menu.MenuItem
       AppearanceDark    *menu.MenuItem
       AppearanceSystem  *menu.MenuItem
   }
   ```
3. Store pointers when building each item.
4. Add `func (r *MenuRefs) Apply(state MenuState, ctx context.Context)` that mutates `.Disabled` / `.Checked` fields then calls `runtime.MenuUpdateApplicationMenu(ctx)`.
5. In [app.go](app.go), add:
   ```go
   func (a *App) UpdateMenuState(state menu.MenuState) error {
       a.menuRefs.Apply(state, a.ctx)
       return nil
   }
   ```
   Bind `a` in the Wails options (already done) — the method becomes available in JS.

### Step 2 — Go unit test

1. `menu/state_test.go`: construct a fresh menu+refs, call `Apply(MenuState{...}, nil)` (skip the `MenuUpdateApplicationMenu` side-effect by passing a nil ctx and handling it gracefully, or by splitting the pure "compute state on items" from the "tell runtime to refresh" parts). Assert each item's `.Disabled` / `.Checked` matches the expected values.

### Step 3 — Svelte bridge

1. In `menuBridge.svelte.ts`, add a `$effect` that builds a `MenuState` from current stores:
   - `HasSelectedNote` — `notesStore.selectedNote != null`
   - `SelectedNoteInTrash` — `notesStore.selectedNote?.deletedAt != null`
   - `TrashHasItems` — derive from `notesStore` / `folderStore` counts (add a `$derived` if needed)
   - `Theme` — `themeStore.theme`
2. Call the generated `UpdateMenuState` binding whenever the derived state changes. Rely on Svelte's natural batching; no manual debounce.

### Step 4 — Svelte test

1. `frontend/tests/unit/menuBridgeState.test.ts`: when `notesStore.selectedNote` becomes `null`, the bound `UpdateMenuState` is called with `HasSelectedNote: false`. Mock the binding.

### Step 5 — Verification

1. `wails dev`. Deselect all notes → File → Move to Trash is greyed.
2. Select a trashed note → Move to Trash stays greyed.
3. Empty trash → Empty Trash greys out.
4. Switch theme → checkmark on Appearance updates to the chosen option.

**PR title:** `feat(menu): dynamic enablement bridge between Svelte state and Go menu`.

---

## M7 — Keyboard-shortcut reconciliation

**Goal.** Remove `⌘N` and `⌘⇧N` from JS `handleGlobalShortcut`. Menu accelerators now own them. Pane-scoped shortcuts (`/`, Escape, arrows, Enter, Delete / Backspace) stay in JS.

### Step 1 — Update or add tests

1. If tests for `handleGlobalShortcut` assert ⌘N behavior, change the assertions to expect `handleGlobalShortcut` to return `false` for ⌘N and ⌘⇧N. If no such tests exist, add minimal ones.
2. Retain `/` (focus search) tests — still JS-owned.

### Step 2 — Implementation

1. In [shortcuts.ts](frontend/src/lib/keyboard/shortcuts.ts), delete the `n` / `shift+n` branches in `handleGlobalShortcut`. Everything else stays.
2. In [+layout.svelte](frontend/src/routes/+layout.svelte), update the `handleGlobalShortcut(event, {...})` call — drop `createNote` and `createFolder` from the passed actions. Keep `focusSearch`.
3. `GlobalShortcutActions` type in `shortcuts.ts` should lose `createNote` and `createFolder`.

### Step 3 — Verification

1. `wails dev`. ⌘N creates a note (via the menu now). ⌘⇧N creates a folder. `/` focuses search.
2. `npm run test && npm run check` are green.

**PR title:** `refactor(shortcuts): hand ⌘N / ⌘⇧N to the native menu`.

---

## M8 — About dialog

**Goal.** Custom Svelte modal styled like the native macOS About panel — centered, fixed-size, app icon + name + version + copyright.

### Step 1 — Test first

1. Create `frontend/tests/unit/components/about.test.ts`.
2. Cases:
   - Renders app name, version (pass via prop or read from `import.meta.env.VITE_APP_VERSION`), copyright line.
   - Clicking the close button invokes the `onClose` prop.
3. **Test gate:** fails (component does not exist).

### Step 2 — Component

1. Create [frontend/src/lib/components/About.svelte](frontend/src/lib/components/About.svelte).
2. Layout:
   - Centered fixed-size (~360×440 px) panel.
   - App icon at top.
   - App name in semibold.
   - `Version x.y.z` below in small grey text.
   - Copyright line, then "Acknowledgements" (static text; a short list of the OSS packages in use is fine for v1).
3. Reuse the project's dialog primitive (shadcn-svelte Dialog if it's available); style to de-emphasise chrome so it reads as an About panel, not a generic alert.

### Step 3 — Wire to menu bridge

1. In [+layout.svelte](frontend/src/routes/+layout.svelte), add `let showAbout = $state(false)` and mount `<About bind:open={showAbout} />` at the end of the template.
2. Bridge handler for `menu:open-about` sets `showAbout = true`.

### Step 4 — Verification

1. `wails dev`. mdnotes → About mdnotes shows the dialog with correct app name, version, copyright.

**PR title:** `feat(menu): About dialog`.

---

## M9 — Preferences window

**Goal.** Modal styled like a native macOS Preferences window. Two sections in a top toolbar: **General**, **Appearance**.

- General: Folder accent color (color picker).
- Appearance: theme (Light / Dark / Follow System).

Font-size and typography are deliberately excluded — TipTap (Phase F) will own typography.

### Step 1 — Preferences store

1. Create `frontend/src/lib/stores/preferences.svelte.ts`:
   - `folderAccentColor = $state<string>('#007aff')` (macOS default blue)
   - `async init(settings: SettingsSnapshot)` — reads `folderAccentColor` from stored settings.
   - `async setFolderAccentColor(color: string)` — updates state + persists via `settingsRepository.save('folderAccentColor', color)`.
2. Register the store's init call in [+layout.svelte](frontend/src/routes/+layout.svelte) right after `settingsRepository.getAll()`.
3. Apply the color by setting a CSS custom property on `document.documentElement` in a `$effect`: `document.documentElement.style.setProperty('--folder-accent', preferencesStore.folderAccentColor)`.
4. Update any CSS that currently uses a hard-coded selected-folder color to use `var(--folder-accent)`.

### Step 2 — Tests first

1. `frontend/tests/unit/preferences.test.ts`:
   - Setting folder accent calls `settingsRepository.save` with the new value.
   - On `init` with a stored value, `folderAccentColor` is restored.
2. `frontend/tests/unit/components/preferences-window.test.ts`:
   - Renders two tab triggers: General, Appearance.
   - Clicking Appearance → Dark calls `themeStore.setTheme('dark')`.
   - Changing the color input calls `preferencesStore.setFolderAccentColor`.
3. **Test gate:** fails.

### Step 3 — Component

1. Create [frontend/src/lib/components/Preferences.svelte](frontend/src/lib/components/Preferences.svelte).
2. Layout:
   - Fixed size ~640×420 px, centered, rounded corners, shadow.
   - Top toolbar: segmented tabs (use `@lucide/svelte` icons).
   - Body switches on the active tab.
   - Close affordance top-left.
3. General tab:
   - Label "Folder accent color".
   - `<input type="color">` bound to `preferencesStore.folderAccentColor` with a short debounce (e.g. 100 ms) before calling `setFolderAccentColor` to avoid save spam.
4. Appearance tab:
   - Three radio-style buttons: Light / Dark / Follow System. Bound to `themeStore.theme`.

### Step 4 — Wire to menu bridge

1. In [+layout.svelte](frontend/src/routes/+layout.svelte), add `let showPreferences = $state(false)` and mount the component.
2. Bridge handler for `menu:open-preferences` sets `showPreferences = true`.

### Step 5 — Verification

1. `wails dev`. ⌘, opens Preferences.
2. Change folder accent → selected-folder highlight updates instantly and persists after restart.
3. Change appearance → theme toggles, menu checkmark follows.

**PR title:** `feat(preferences): native-styled Preferences window`.

---

## M10 — Markdown import / export (zip)

**Goal.**

- **Export current note** → `.md` file via save dialog.
- **Export all notes** → `.zip` of `.md` files preserving folder hierarchy.
- **Import** → `.zip` of `.md` files, creating folders from paths. Never overwrite existing notes; on title collision inside the target folder, append ` (n)` to the imported title.

### Step 1 — Define the zip contract

Document the archive format in the PR description:

```
notes_export_YYYY-MM-DD.zip
├─ notes-manifest.json               (optional, for round-trip path→id mapping)
├─ Folder Name/
│  ├─ Note Title.md
│  └─ Nested Folder/
│     └─ Another Note.md
└─ Another Folder/
   └─ My Note.md
```

Folder / note names are slugified for filesystem safety (max 128 chars, strip `/` `:` `\` etc.). Slugification is lossless-ish — the manifest lets round-trips preserve original titles.

### Step 2 — Go file I/O (tests first)

1. Create `export/export_test.go`. Cases:
   - Given a slice of `NoteDTO{Title, Content, FolderPath}`, `BuildNotesZip(writer, notes)` produces a zip whose entries match the expected paths and contents.
   - Given a fixture zip (`testdata/sample.zip`), `ParseNotesZip(reader)` returns the expected `ImportedNoteDTO` list.
   - Edge cases: empty `FolderPath` → note at zip root; illegal characters are slugified; duplicate sanitised names get numeric suffixes in the output zip.
2. Create `export/export.go`:
   - `type NoteDTO struct { Title, Content, FolderPath string; UpdatedAt string }`
   - `type ImportedNoteDTO struct { Title, Content, FolderPath string }`
   - `BuildNotesZip(w io.Writer, notes []NoteDTO) error`
   - `ParseNotesZip(r io.ReaderAt, size int64) ([]ImportedNoteDTO, error)`

### Step 3 — Go glue on `App`

1. Add to [app.go](app.go):
   - `ExportNoteToFile(title, content string) error` — opens save dialog via `runtime.SaveFileDialog`; writes `.md` via `os.WriteFile`.
   - `ExportNotesZip(notes []export.NoteDTO) error` — save dialog; delegates to `BuildNotesZip`.
   - `ImportNotesZip() ([]export.ImportedNoteDTO, error)` — `runtime.OpenFileDialog`; delegates to `ParseNotesZip`.

### Step 4 — Svelte handlers (tests first)

1. `frontend/tests/unit/menuBridgeMarkdown.test.ts`:
   - `menu:export-note` calls `ExportNoteToFile(selectedNote.title, selectedNote.content)`.
   - `menu:export-all-markdown` collects active (non-deleted) notes, builds DTOs with folder paths from the `folderStore` tree, calls `ExportNotesZip`.
   - `menu:import-markdown` calls `ImportNotesZip` and for each returned DTO: creates / reuses folders for the `FolderPath` segments, then creates the note via `noteService.create` and updates its content via `noteService.update`.
2. Mock the bound methods.

### Step 5 — Implementation

1. Implement the handlers in `menuBridge.svelte.ts`.
2. On error, surface via `uiStore.confirmAppQuit('Export failed', String(err), () => {})` (reusing the existing alert pattern from R3 — consider adding a dedicated `uiStore.showError(title, message)` later).

### Step 6 — Verification

1. `wails dev`. Export the selected note → saved `.md` opens in any editor with correct title (H1) and body.
2. Export all → unzip on disk → folder hierarchy mirrors the app.
3. Import the exported zip into a freshly-cleared install → notes and folders re-created.

**PR title:** `feat(menu): Markdown import / export with folder-preserving zip`.

---

## M11 — IndexedDB JSON backup

**Goal.** Full round-trip export / import of app state for power users.

### Step 1 — Define the backup shape

```json
{
    "schemaVersion": 1,
    "exportedAt": "2026-04-17T12:00:00Z",
    "appVersion": "0.1.0",
    "folders":  [ ... ],
    "notes":    [ ... ],
    "settings": { ... }
}
```

Document this in `frontend/src/lib/backup/README.md` (or a top-of-file comment). Schema version bumps when the shape changes.

### Step 2 — Tests first

`frontend/tests/unit/backup.test.ts`:

1. `exportBackup()` returns a JSON string with `schemaVersion`, all folders, all notes, and settings from the current stores.
2. `importBackup(json)` replaces store contents with the payload.
3. Malformed JSON → throws a typed error; store state is unchanged.
4. Older `schemaVersion` values are accepted for now (version 1 is current — leave migration hooks for the future).

### Step 3 — Implement

1. Create `frontend/src/lib/backup/backup.ts` with:
   - `export function exportBackup(): string`
   - `export async function importBackup(json: string): Promise<void>`
2. In [app.go](app.go), add:
   - `SaveBackupFile(content string) error`
   - `ReadBackupFile() (string, error)`
3. Bridge handlers:
   - `menu:export-backup` → `SaveBackupFile(exportBackup())`.
   - `menu:import-backup` → show a destructive confirmation ("This replaces all local notes and folders. Continue?") using the existing `uiStore` pattern → on confirm, `ReadBackupFile()` + `importBackup(content)` + reload or re-init stores.

### Step 4 — Verification

1. Export → open file on disk → JSON looks right.
2. Import into a fresh install → all folders, notes, and settings are restored.

**PR title:** `feat(menu): IndexedDB JSON backup import / export`.

---

## M12 — Cross-platform extensibility scaffolding (optional)

**Goal.** Make Windows / Linux menu builders a drop-in addition later.

### Steps

1. Split `menu/menu.go` into build-tagged files:
   - `menu/menu_darwin.go` — the current `BuildMacMenu`.
   - `menu/menu_windows.go`, `menu/menu_linux.go` — stub that returns `(nil, nil)` and a TODO comment referencing this plan.
2. Add a platform-agnostic entry point in `menu/menu.go` (no build tag): `func Build(host MenuHost) (*menu.Menu, *MenuRefs)` that picks the right builder using `runtime.GOOS`.
3. Update [main.go](main.go) to call `menuPkg.Build(app)` — no `GOOS` logic leaks into `main`.
4. `go build` succeeds on all three platforms (verify with `GOOS=linux go build ./...` and `GOOS=windows go build ./...` if possible).
5. Add a short note to [CLAUDE.md](CLAUDE.md) under "Architecture": "Menu bar is macOS-only. See [MENU_BAR.md](MENU_BAR.md) M12 for the extension contract."

**PR title:** `chore(menu): scaffold Windows / Linux menu stubs for future work`.

---

## Release gate for the menu-bar feature

Before marking menu-bar integration complete in [CHECKLIST.md](CHECKLIST.md):

1. M1 – M11 are `[x]` (M12 is optional for the first release).
2. `npm run check` and `npm run test` exit 0.
3. `go test ./...` exits 0.
4. Manual smoke test on macOS:
   - All menu items fire correct actions; no "dead" items.
   - Shortcuts: ⌘N, ⌘⇧N, ⌘,, ⌘F, ⌘⌫, ⇧⌘⌫, ⇧⌘E, ⌃⌘S, ⌃⌘L.
   - Greyed-out states correct: no selection → Move to Trash / Export Current Note greyed; empty trash → Empty Trash greyed.
   - Preferences persists across restart.
   - Markdown zip round-trip preserves all notes and folder structure.
   - JSON backup round-trip restores state on a fresh install.
