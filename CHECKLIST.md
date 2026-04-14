# MVP Release Readiness Checklist

This is the pre-public-release audit list. Each item describes **where to look**, **what to investigate**, and **what "done" looks like** — not the fix itself. Junior engineers picking up an item should be able to land a PR without further design input by following the investigation steps.

Conventions:
- File links use repo-relative paths.
- Where a line number is given, it was correct at the time of writing — verify it still points at the right thing before starting.
- Before marking an item complete, run `npm run check`, `npm run test`, and (for UI-visible changes) `wails dev` and exercise the golden path manually.

---

## 1. Bugs

### [x] 1.1 Note count badge is wrong for system-view folders
- **Start at:** `frontend/src/lib/stores/services/noteService.ts` — find `getNoteCountForFolder`. Then open [`Folders.svelte`](frontend/src/lib/components/Folders.svelte) and follow how `source.noteCount` is computed in [`folderSidebarView.svelte.ts`](frontend/src/lib/views/folderSidebarView.svelte.ts) (`this.noteQueries.getNoteCountForFolder(item.id, item.profile)`).
- **Investigate:**
  - For each system view (`home`, `favorites`, `deleted-notes`), does the returned count actually match what the folder's profile's `resolveNotes` would produce? Compare against `PROFILE_REGISTRY[*].resolveNotes` in [`profiles.ts`](frontend/src/lib/stores/domain/profiles.ts).
  - The trash badge is a known offender — stepping through the code, which branch does it hit and why does it return 0?
  - Is `folderType` (profile id) being threaded through all call sites?
- **Done when:** the three view badges and every regular-folder badge show the same count as the note list that appears when you click into the folder. Add a unit test under `frontend/tests/unit/` that covers all three system views plus a regular folder plus an empty trash.

### 1.2 `selectNote(null)` calls `persist(null!)`
- **File:** [`notes.svelte.ts:197-200`](frontend/src/lib/stores/notes.svelte.ts#L197).
- **Investigate:** The non-null assertion `this.persist(id!)` hides that `persist` gets called with `null` when deselecting. Trace what `persist(null!)` actually does — `this.notes.get(null)` returns undefined, so no note is saved, but `settingsRepository.save('selectedNoteID', ...)` still fires. Is that the intended behavior, or should selection-only writes go through a dedicated path?
- **Done when:** the assertion is gone and it's provable from the code whether a null selection writes to the settings store or not. (See also item 4.2 — this overlaps with separating selection persistence from note persistence.)

---

## 2. Missing Features

### 2.1 Keyboard shortcuts
- **Start at:** [`+layout.svelte`](frontend/src/routes/+layout.svelte) — this is the top-level component, good place for global listeners. Also look at the bits-ui primitives in `$lib/components/ui/` — some already handle their own keys; don't double-handle inside context menus or dialogs.
- **Minimum shortcuts:**
  - `Cmd+N` / `Ctrl+N` — new note in the currently selected folder. Must respect `canCreateNote` in [`noteListView`](frontend/src/lib/views/noteListView.svelte.ts).
  - `Cmd+Backspace` / `Ctrl+Backspace` — soft-delete the selected note. Respect `canDeleteSelectedNote`.
  - `Escape` — cancel in-progress rename (`folderStore.editingId`) first; if no rename, deselect the note.
- **Investigate:**
  - Where is focus when a user is typing in a note? Your global handler must not fire when the user hits `Cmd+Backspace` inside the editor textarea (text-edit backspace vs. delete-note).
  - How does macOS delivery of `Cmd` vs Linux/Windows `Ctrl` get normalized — is there a helper, or do you need to check `event.metaKey || event.ctrlKey`?
  - Wails does support native menu bar shortcuts (see item 2.3) — decide whether global JS listeners, native menus, or both are the source of truth.
- **Done when:** the three shortcuts work on Mac and Linux; text editing inside a note is not affected; shortcuts are discoverable (tooltips, menu accelerators, or a help sheet).

### 2.2 Light mode / theme toggle
- **Files:**
  - [`frontend/src/app.html:2`](frontend/src/app.html#L2) — `<html lang="en" class="dark">`.
  - [`+layout.svelte:30`](frontend/src/routes/+layout.svelte#L30) — `<div class="dark ...">`.
  - [`frontend/src/routes/layout.css:9-42`](frontend/src/routes/layout.css) — light-mode CSS variables already defined.
- **Investigate:**
  - Why is `dark` applied in two places? One should be the source of truth.
  - Should we default to `prefers-color-scheme` and let the user override, or force a default and respect user choice? Look at how Apple Notes / Obsidian handle this for desktop apps.
  - Where should the toggle live — settings dialog, sidebar footer, menu bar? Match the existing visual language.
  - Persist the user's choice — `settingsRepository` already exists, use it.
- **Done when:** toggling light/dark updates the entire UI live, the choice survives app restart, and the initial paint does not flash the wrong theme (investigate a pre-hydration script in `app.html` to avoid FOUC).

### 2.3 OS menu bar integration
- **Files:** `main.go` and `app.go` — Wails menus are configured on the `options.App` struct. See Wails v2 docs on `options.Menu` and the `menu` package.
- **Investigate:**
  - Which actions belong in which menu? Minimum: `File > New Note`, `File > New Folder`, `Edit > Delete Note`. Look at Apple Notes / Bear for conventions.
  - Go → JS bridging: how do menu clicks invoke frontend code? Wails supports emitting events; check `runtime.EventsEmit` usage. Decide whether handlers stay in Go or route through an event to the frontend.
  - macOS expects standard menus (`About`, `Hide`, `Quit`, `Edit > Copy/Paste`) — Wails provides helpers for these. Don't reimplement them.
  - Must overlap cleanly with item 2.1 keyboard shortcuts: ideally the menu is the source of truth and accelerators are declared on menu items.
- **Done when:** the app has a native menu bar with at least the three app-specific actions, plus the platform-standard entries. Clicking each menu item performs the same action as the in-app button, and accelerators shown in the menu match what keyboard actually does.

---

## 3. Svelte Reactivity

### [x] 3.1 Redundant `SvelteMap.set()` on existing notes
- **File:** [`notes.svelte.ts`](frontend/src/lib/stores/notes.svelte.ts) — lines `120, 130, 140, 155, 179`.
- **Background for juniors:** In Svelte 5 runes mode, every note object stored in the map is already a `$state` proxy. Mutating a field like `note.deletedAt = x` is fine-grained: only subscribers reading `deletedAt` on that specific note re-run. Calling `map.set(id, sameObject)` on top of that signals a **structural change** to the map, which invalidates every consumer that iterates the map (`Array.from(map.values())`). Our note list and every folder badge do exactly that.
- **Investigate:**
  - For each of the 5 call sites, confirm the note is already in the map before the mutation — if so, the `.set()` is redundant.
  - Are there any code paths where the note might not yet be in the map (e.g. a just-created note)? Those are the legitimate `.set()` sites.
  - Once you've removed redundant `.set()`s, profile with the Svelte devtools or a console instrumented on the view layer — verify the note list and badges no longer re-render when you toggle a note's `isFavorite` or `deletedAt`.
- **Done when:** only adding or removing a note calls `.set()` / `.delete()`; every mutation of an existing field is a direct property assignment. [x] Unit test `mutations_reactivity.test.ts` verifies this.

### [x] 3.2 Typing re-sorts the note list on every keystroke
- **File:** [`notes.svelte.ts:101-111`](frontend/src/lib/stores/notes.svelte.ts#L101) — `updateNote` stamps `updatedAt` on every call.
- **Investigate:**
  - Follow the reactive graph: `updateNote` → `note.updatedAt` → `getNotesForFolder` sort key → `filteredNotes` ($derived in `NoteItems.svelte`) → re-order → the active note jumps to the top position and the list re-renders.
  - Is there a separation between "in-memory update" (don't care about `updatedAt` immediately) and "persistence event" (this is when we care)? Decide when `updatedAt` should bump: on every keystroke, on debounce fire, or only when the note loses focus?
  - Coordinates with item 4.1 (debounce) — probably they should be fixed together.
- **Done when:** typing into a note does not cause the list to re-sort on each keystroke. [x] Unit test `mutations_reactivity.test.ts` verifies this. The `bumpUpdatedAt: false` flag is used during typing in `+page.svelte`.

### [x] 3.3 `getNoteCountForFolder` re-runs full iteration every render
- **Files:**
  - [`noteService.ts`](frontend/src/lib/stores/services/noteService.ts) — `getNoteCountForFolder`.
  - [`folderSidebarView.svelte.ts`](frontend/src/lib/views/folderSidebarView.svelte.ts) — where it's called in `buildSource`.
- **Investigate:**
  - Trace how many times per render-cycle this function runs today (instrument with a counter or a console.log). With N folders visible, it's at least N × full note iteration.
  - The right fix is a `$derived.by` index inside `notesStore` that maps folder-id → count, computed once per note-set change. Think about the key for the index: regular folders use `folderId`, but `home`, `favorites`, and `trash` need different rules — can one index cover all four via special keys (e.g. `__favorites`, `__trash`, `__home`)?
  - Make sure the index only recomputes when the structural set of notes changes, not when unrelated fields (title, content) change. This depends on item 3.1 being fixed first — if redundant `.set()` calls remain, the index will invalidate on every mutation.
- **Done when:** each badge read is O(1). Benchmark before/after with e.g. 500 notes and confirm there's no visible lag when typing.

---

## 4. Performance

### 4.1 Debounce note updates to IndexedDB
- **Files:** [`+page.svelte:65, 89`](frontend/src/routes/+page.svelte#L65) — `oninput` handlers call `noteService.update` synchronously, which persists to IndexedDB on every keystroke.
- **Investigate:**
  - Read `$lib/utils` first to see if a debounce helper already exists.
  - Target 300–400ms debounce. Make sure the debounce is **per-note** — switching to a different note must flush the pending write for the previous note immediately (otherwise you lose data if the app is closed mid-debounce).
  - Coordinate with item 3.2 — `updatedAt` should probably only bump when the debounce fires, not on every in-memory mutation.
  - Think about app-exit: Wails exposes a `beforeClose` hook. Does the pending debounced write get flushed before the DB connection closes?
- **Done when:** typing into a 10-word note produces one IndexedDB write, not ten. Verify with the browser devtools IndexedDB tab. No data is lost when you switch notes mid-type or close the app.

### 4.2 Separate note persistence from selection persistence
- **File:** [`notes.svelte.ts:66-73`](frontend/src/lib/stores/notes.svelte.ts#L66) — `persist()` writes both the note itself and `selectedNoteID` on every save.
- **Investigate:**
  - Count how often `persist(id)` runs during a typing session — each one writes to `settingsRepository` redundantly.
  - Should note persistence and selection persistence live in different methods? Who should own each? Trace every caller of `persist` and see whether they care about selection at all.
  - Selection changes should flush separately when `selectNote()` fires.
- **Done when:** writing note content does not touch `settingsRepository`. Selection changes write exactly one `putSetting('selectedNoteID', …)`. Verify with a breakpoint or counter.

### 4.3 Split note content from note metadata (deferred / design-heavy)
- **File:** [`notes.svelte.ts`](frontend/src/lib/stores/notes.svelte.ts) — `NoteItem` contains both metadata and `content`.
- **Investigate:**
  - What's the startup cost of loading all notes with their full content? Profile with e.g. 500 notes of 10 KB each.
  - The intended shape: a `notes_meta` object store (id, title, folderId, updatedAt, etc.) and a `notes_content` object store loaded lazily when a note is selected. Look at how [`idbr.ts`](frontend/src/lib/stores/idbr.ts) structures its stores today.
  - This is a schema migration — plan for existing users' data. Decide whether to migrate on first run or read-lazily.
  - This also decouples typing from the metadata reactive graph entirely (see items 3.1, 3.2).
- **Done when:** design doc + migration plan reviewed before implementation. Not required for 1.0 if the note count stays small, but blocks growth.

---

## 5. UX

### [x] 5.1 Auto-advance after note delete
- **Start at:** [`noteService.ts`](frontend/src/lib/stores/services/noteService.ts) — find the delete path. Compare with how `folderService.delete` already handles selection via `getNextFolderSelectionAfterDelete`.
- **Investigate:**
  - After deleting the selected note, what's shown? (Currently: empty editor.)
  - Apple Notes selects the next note in the current view. Figure out "next" — previous in list, or next? Match the user's visual expectation (the note just below the deleted one).
  - What if the deleted note was the only note in the folder? Fall back to null selection.
- **Done when:** deleting the active note auto-selects the next note in the list. If the folder empties, the content pane shows the empty state.

### 5.2 Loading state on startup
- **File:** [`+layout.svelte`](frontend/src/routes/+layout.svelte) — `onMount` does a sequence of awaits.
- **Investigate:**
  - How long does startup take with a realistic DB? Test with 500+ notes — the current "blank three-pane shell" can look broken.
  - Options: skeleton loaders in each pane, a global spinner, or a splash screen. Match the visual language of the dark theme.
  - Make sure the loading state doesn't block Wails' window from painting — the user should see *something* within the first frame.
- **Done when:** user always sees a loading indicator until the stores are initialized. There is no visual flash of "empty app" state after stores load.

### 5.3 Rename visual feedback on rejection
- **Files:** [`Folders.svelte:13-20`](frontend/src/lib/components/Folders.svelte#L13) and [`folderService.rename`](frontend/src/lib/stores/services/folderService.ts) → `folderStore.renameFolder`.
- **Investigate:**
  - Reproduce: start renaming a folder, clear the input, blur it. Current behavior: the input was bound to the empty string, so visually the title looks empty for a frame, then resets. User has no feedback that their change was rejected.
  - Options: revert the `bind:value` on blur-with-empty, or flash a red border + shake animation, or allow empty names but show a tooltip explaining they'll be rejected.
  - Same check for notes rename if we add it later.
- **Done when:** rejected renames visibly snap back to the previous title with a cue that something happened (border flash, toast, or similar).

### 5.4 Resizable panes
- **File:** [`+layout.svelte:30-38`](frontend/src/routes/+layout.svelte#L30) — three panes with fixed widths (`w-64`, `w-[350px]`).
- **Investigate:**
  - Is there a Svelte-compatible resizable pane library we should use, or do we hand-roll? bits-ui doesn't provide this today — check.
  - Persist pane widths across restarts via `settingsRepository`.
  - Min/max constraints: the note list pane shouldn't shrink below the width needed for legible note previews. Decide the constraints.
  - Collapse behavior: should the folder sidebar be collapsible entirely? Apple Notes allows this.
- **Done when:** drag handles between panes work, widths persist, min/max are enforced, and the layout doesn't break at extreme widths.

### 5.5 Window title reflects context
- **File:** [`runtime.d.ts`](frontend/src/lib/wailsjs/runtime/runtime.d.ts) — `WindowSetTitle` is available but not called anywhere.
- **Investigate:**
  - What should the title be? Options: current note title, `"{folder} — mdnotes"`, just `"mdnotes"`. Look at macOS Notes (shows "Notes" always; document title is in the editor). Look at VS Code (shows `{file} — {folder} — Code`).
  - Where to wire it: a `$effect` inside `+layout.svelte` or `+page.svelte` watching `notesStore.selectedNote`.
  - Consider unsaved state — if we add a dirty indicator later (typical `•` prefix), this is where it goes.
- **Done when:** the OS window title updates live as the user navigates. Verify on Mac, Linux, Windows.

---

## 6. Code Cleanup

### [x] 6.1 Remove unused `folderNotes` SvelteMap
- **File:** [`notes.svelte.ts:19, 49`](frontend/src/lib/stores/notes.svelte.ts#L19) — declared, cleared on init, never read or written elsewhere.
- **Verify:** `grep` the codebase for `folderNotes` — all hits should be in `notes.svelte.ts` (plus one false-positive local variable in `trashService.ts`, which is unrelated).
- **Done when:** the declaration is gone, `npm run check` passes.

### [x] 6.2 Remove unused `initialMockNotes`
- **File:** [`notes.svelte.ts:203-233`](frontend/src/lib/stores/notes.svelte.ts#L203).
- **Verify:** grep for `initialMockNotes` — the constructor call is `new NotesStore([])`, not `new NotesStore(initialMockNotes)`, so it's dead.
- **Done when:** deleted.

### [x] 6.3 Remove unused `url` field from `FolderItem`
- **File:** [`folders.svelte.ts:8`](frontend/src/lib/stores/folders.svelte.ts#L8) — field declared, set to `'#'` in three places, never read for anything.
- **Investigate:** grep `\.url\b` in `frontend/src` and confirm no read sites. `runtime.d.ts` has an unrelated `BrowserOpenURL` — ignore.
- **Done when:** the field is gone from the type and every construction site. Tests still pass. (Note: some test fixtures in `frontend/tests/unit/` currently fail because they're missing `url` — removing the field fixes that too.)

### [x] 6.4 Remove unused `badge` field from `FolderItem`
- **File:** [`folders.svelte.ts:11`](frontend/src/lib/stores/folders.svelte.ts#L11).
- **Verify:** grep for `\.badge` — no reads.
- **Done when:** deleted.

### [x] 6.5 Remove `let i = $state(...)` redundant assignments
- **File:** [`folders.svelte.ts`](frontend/src/lib/stores/folders.svelte.ts) — `constructor()` and several other methods do `let i = $state([]); this.items = i;` even though `this.items` is already declared `$state<string[]>([])`.
- **Investigate:** audit every `let * = $state(...)` in the stores. The pattern is noise left over from an earlier refactor. `$state(x)` inside a reassignment doesn't add reactivity that wasn't already there via the class-field declaration.
- **Done when:** the stores read linearly without the intermediate `$state()` temp vars. `npm run check` passes and stores still behave correctly (write a quick test that mutates `this.items` and confirms a $derived consumer re-runs).

### [x] 6.6 Remove debug `console.log` statements
- **Files:**
  - [`folders.svelte.ts:64`](frontend/src/lib/stores/folders.svelte.ts#L64) — `console.log('loaded items:', ...)`
  - [`folders.svelte.ts:83`](frontend/src/lib/stores/folders.svelte.ts#L83) — `console.log('isInitialized', ...)`
  - [`Folders.svelte:15`](frontend/src/lib/components/Folders.svelte#L15) — `console.log('Save: ', item)`
- **Investigate:** sweep the whole `frontend/src/` for `console.log` and evaluate each. Some may be intentional error logs — keep those. `console.error` in catch blocks is fine.
- **Done when:** only deliberate, user-facing error logs remain.

### [x] 6.7 Remove `Greet()` stub from Wails backend
- **File:** [`app.go:39-41`](app.go#L39) — leftover from the Wails template.
- **Verify:** it's not called from the frontend (grep `Greet` in `frontend/src`). The binding file in `$lib/wailsjs/go/` will regenerate on next `wails dev`.
- **Done when:** `Greet` is gone from `app.go`, the generated binding updates, frontend still compiles.

### 6.8 Remove stray dev artifacts from `frontend/`
- **Files (repo root of `frontend/`):**
  - `test_empty_folder.js`
  - `test_ui.js`
  - `tests_output.txt`
  - `package.json.md5`
  - `impl.md`
  - the entire `recovery-plan/` directory
- **Investigate:** for each, confirm it's not wired into tooling. `git log -- <file>` will tell you if it was recently in use. Ask in the team channel before deleting anything that looks like someone's scratchpad.
- **Done when:** these files are either deleted or added to `.gitignore` with a reason in the commit message. Root-level `.gitignore` should cover future accidental check-ins.

### 6.9 Resolve uncommitted/stale state on the branch
- **Source:** `git status` at the top of the task.
- **Investigate:**
  - `recovery-plan/implementation_plan.md.resolved.3.md` and `.8` are shown as deleted; a new untracked `implementation_plan.md.resolved.3` (no extension) exists. What happened here — a merge artifact? Rename?
  - Decide: are the recovery plans historical docs worth keeping in-repo (maybe under `/docs/`), or strictly private to the refactor? They shouldn't be published on a public repo.
- **Done when:** working tree is clean. All files are either committed or deleted. `recovery-plan/` is resolved one way or the other.

### [x] 6.10 Fix pre-existing test-suite type errors
- **How to see them:** `cd frontend && npm run check`.
- **Files:**
  - `tests/unit/folders.test.ts`, `notes.test.ts`, `recovery_architecture.test.ts` — fixtures miss `url` on `FolderItem`. Item 6.3 removes `url`, so these will likely pass after that — but double-check.
  - `tests/unit/services.test.ts` — imports a `SidebarKind` that no longer exists from `folders.svelte`. This is stale from an earlier refactor.
- **Investigate:**
  - For each error, decide: does the test need to be updated to the new API, or deleted because the feature is gone? `git blame` the test to see what it was protecting.
  - Until these are green, `npm run check` can't be used as a CI gate.
- **Done when:** `npm run check` exits 0 and `npm run test` is green. Consider turning `npm run check` into a pre-commit hook.

---

## 7. Polish / Release

### 7.1 README rewrite
- **File:** `README.md` (root).
- **Investigate:**
  - Go version: the README says `1.26+` — that version doesn't exist. Check `go.mod` for the actual required version and update.
  - "Features" section currently lists the tech stack. For a public release, list **what the app does for users** (local-first markdown notes, folders, favorites, trash/restore, Apple Notes–style three-pane layout). Tech stack can move to a "Built with" subsection near the bottom.
  - Add screenshots — at minimum one of the main three-pane view. Store under `docs/screenshots/` and reference with relative paths.
  - Build/install instructions: verify the `git clone` → `npm install` → `wails dev` flow actually works on a clean machine. Consider adding a "Troubleshooting" section for common Wails v2 environment gotchas on macOS/Linux.
  - License badge and link to `LICENSE`.
- **Done when:** a first-time reader can (a) understand what the app does without reading code, and (b) build and run it by following the README.

### 7.2 Screenshots for the repo
- **Investigate:**
  - What views showcase the app best? At minimum: main three-pane with a note selected, the trash view, the favorites view, a rename-in-progress, and the empty state.
  - Take on a consistent theme (dark or light once 2.2 is done). Consistent window size.
  - File size — PNG, optimized. Keep under 200 KB each.
- **Done when:** screenshots exist in `docs/screenshots/` and are referenced in `README.md`.

### 7.3 Release artifacts & signing (defer until 1.0)
- **Investigate:** does Wails produce signed binaries for macOS, Windows, Linux? Notarization on macOS is non-trivial. Look at Wails v2 docs on distribution.
- **Done when:** the release process is documented, even if not automated, so the first public release isn't stuck on "how do I ship this."

---

## 8. Deferred (tracked, not required for 1.0)

### 8.1 Rich-text editor
- **Placeholder:** `<textarea>` in [`+page.svelte`](frontend/src/routes/+page.svelte) (editor body).
- **Investigate:** TipTap was the previously-chosen target. Confirm it still fits — look at bundle size, Svelte 5 compatibility, markdown round-trip quality. Alternatives: CodeMirror 6 with a markdown mode, ProseMirror directly, or Lexical.
- **Done when:** a design doc lands proposing the editor choice, migration of existing content, and the serialization format at rest (plain markdown stays the goal for portability).

---

## Release Gate

Before cutting a public release, confirm:

1. All items in sections 1–6 are `[x]` or have a linked issue explaining why they're deferred.
2. `npm run check` and `npm run test` are green.
3. `wails build` produces a runnable binary on at least macOS and one of (Linux, Windows).
4. The README renders correctly on GitHub with working image links.
5. Manual smoke test: fresh install → create folder → create note → type → close app → reopen → everything is still there.
