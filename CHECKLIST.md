# mdnotes — Technical Readiness Roadmap

This file is the authoritative roadmap for getting mdnotes to a public release. It is split into two parts:

- **Part A — Release Blockers** (new). Seven items (R1–R7) that must be completed before public release. This section is structured for junior contributors with test-first discipline and step-by-step instructions.
- **Part B — MVP Readiness Backlog** (original). The pre-existing checklist, preserved with all completed `[x]` marks. Work on Part B items only after Part A is complete.

---

## Ground rules for Part A (read before starting any item)

1. **Sequential execution.** Do items in order: R1 → R7. Each item's tests must pass before moving to the next.
2. **Tests first.** Write or update test cases **before** implementation. Run them, confirm they fail, then implement until they pass.
3. **Do not edit existing tests** unless the item explicitly says to. Ask permission if you believe a test must change.
4. **Run full suite after each item.** `cd frontend && npm run test && npm run check`.
5. **Manual verification for UI-visible changes.** Use `wails dev` and exercise the golden path.
6. **No new dependencies, config changes, or package installs** without approval.
7. **Scope discipline.** Change only what each item lists. If you spot something worth fixing, add it to Part B.

Commands:

```bash
cd frontend
npm run test                                   # all tests
npm run test -- <path/to/file.test.ts>         # single file
npm run check                                  # svelte-check + tsc (must exit 0)
npm run lint                                   # prettier + eslint
# From repo root:
wails dev                                      # full-stack dev
```

---

# Part A — Release Blockers

## A.1 Items table

| ID  | Title                                              | Category       | Priority | Effort    | Depends on | Status |
| --- | -------------------------------------------------- | -------------- | -------- | --------- | ---------- | ------ |
| R1  | Fix pre-existing `npm run check` type errors       | Quality gate   | P0       | 30–60 min | —          | `[x]`  |
| R2  | Sanitise `AlertDialog` description (XSS fix)       | Security       | P0       | 30–60 min | R1         | `[x]`  |
| R3  | Surface errors from debounced IndexedDB writes     | Data safety    | P0       | 1 h       | R1         | `[x]`  |
| R4  | Replace `Date.now()` batch key with a unique token | Data safety    | P0       | 1 h       | R1         | `[x]`  |
| R5  | Flush pending writes before window close           | Data safety    | P0       | 2–3 h     | R3, R4     | `[x]`  |
| R6  | IndexedDB `upgrade()` skeleton + blocked handlers  | Forward-compat | P1       | 1 h       | R1         | `[x]`  |
| R7  | Debounce search input in the note list             | UX / perf      | P1       | 45 min    | R1         | `[x]`  |

---

## A.2 Rationale

### R1 — Fix pre-existing `npm run check` type errors

**What is broken:** `npm run check` exits non-zero. Four pre-existing TypeScript errors block the full suite. Junior engineers cannot use `npm run check` as a meaningful gate.

**Why first:** Subsequent items all rely on `npm run check` to detect regressions. Fix the baseline first.

**What "done" delivers:** Green `npm run check`. Unblocks CI/pre-commit hooks.

### R2 — Sanitise `AlertDialog` description (XSS fix)

**What is broken:** [`alert.svelte:11`](frontend/src/routes/alert.svelte#L11) renders `dialog.description` with `{@html}`. Several callers in [`dialog.svelte.ts`](frontend/src/lib/stores/dialog.svelte.ts) interpolate user-controlled strings (note title, folder title) directly into descriptions (L52, L64, L76, L88, L100). A note titled `<img src=x onerror=alert(1)>` triggers script execution on delete.

**Why it matters:** Local-first does not exempt us from XSS. Even data imported from future backends or malicious markdown could exploit this.

**What "done" delivers:** User content rendered as text. Only `confirmAppQuit` (which needs `<br/>` and styled `<span>`) opts into raw HTML via an explicit flag.

### R3 — Surface errors from debounced IndexedDB writes

**What is broken:** [`notes.svelte.ts:101`](frontend/src/lib/stores/notes.svelte.ts#L101) calls `notesRepository.save(...)` fire-and-forget. If IndexedDB throws (quota, version error, transaction abort), the user's keystroke disappears silently.

**Why it matters:** Data-loss bug. Silent failure until the next app restart.

**What "done" delivers:** Every write path either awaits the result or attaches `.catch` routing to a user-visible notification. Failed saves are never silent.

### R4 — Replace `Date.now()` batch key with a unique token

**What is broken:** Folder cascade delete uses `Date.now()` as the batch timestamp ([`folders.svelte.ts:148`](frontend/src/lib/stores/folders.svelte.ts#L148), [`folderService.ts:82`](frontend/src/lib/stores/services/folderService.ts#L82)). If two deletes happen within the same millisecond, batch keys collide, and restore contaminate each other.

**Why it matters:** Silent corruption of trash groups. "Restore what you deleted" invariant breaks.

**What "done" delivers:** Each cascade delete receives a unique token (`crypto.randomUUID()`). Existing local data with numeric `deletedAt` continues to work.

### R5 — Flush pending writes before window close

**What is broken:** 400 ms note debounce ([`notes.svelte.ts:158`](frontend/src/lib/stores/notes.svelte.ts#L158)). No `OnBeforeClose` hook in Wails. User types a word, hits ⌘Q immediately → last keystroke is lost.

**Why it matters:** User-perceivable data loss on normal quit. This is the exact scenario the PM flagged.

**What "done" delivers:** Wails emits `before-quit`, frontend flushes all pending writes, then proceeds. No data lost across ⌘Q during active typing.

### R6 — IndexedDB `upgrade()` skeleton + blocked handlers

**What is broken:** [`idbr.ts:32`](frontend/src/lib/stores/idbr.ts#L32) sets `DB_VERSION = 2` but `upgrade()` only creates missing stores — no `switch(oldVersion)`, no migration hooks, no `blocked`/`blocking` handlers. Future schema changes will hang on multi-tab scenarios.

**Why it matters:** This is the last defensible moment to establish the pattern. Once real users exist, there is no going back.

**What "done" delivers:** `upgrade()` has a `switch(oldVersion)` skeleton. `openDB` receives `blocked`/`blocking` handlers that surface a user dialog.

### R7 — Debounce search input in the note list

**What is broken:** [`NoteItems.svelte:28`](frontend/src/lib/components/NoteItems.svelte#L28) binds `searchQuery` directly, recomputing `getSections(searchQuery)` per keystroke. With 500 notes × 10 KB each, scanning on every keystroke causes noticeable stutter.

**Why it matters:** First-impression performance with a realistic notebook.

**What "done" delivers:** Search filter recomputes at most once per ~150 ms after the user stops typing. Input echoes immediately.

---

## A.3 Step-by-step instructions

Each item is an ordered set of steps. **Do not proceed to step N+1 until step N's tests pass.**

---

### R1 — Fix pre-existing `npm run check` type errors

#### Step 1 — Reproduce and document the failures

1. `cd frontend && npm run check`
2. Copy the full error list into the PR description. Current errors (may drift):
   - `src/lib/stores/services/noteService.ts:36:42` — "Expected 2 arguments, but got 3" on `updateNote`
   - `src/lib/views/folderSidebarView.svelte.ts:124:3` — `id` type widens to `string` instead of `'views' | 'folders'`
   - `tests/unit/idbr.test.ts:101:45` — `NoteItem` fixture missing `folderId` / `updatedAt`
   - `tests/unit/components/NoteItems.test.ts:61:13` — `createdAt` not on `NoteItem`
3. **Test gate:** error list captured. No test code needed for this diagnostic step.

#### Step 2 — Fix type surface in `NotesStoreLike`

1. Open [`frontend/src/lib/stores/services/types.ts`](frontend/src/lib/stores/services/types.ts). Find `NotesStoreLike.updateNote`.
2. Extend its signature to accept the third `opts?: { updatedTimestamp?: boolean }` parameter that the real `updateNote` in [`notes.svelte.ts:144`](frontend/src/lib/stores/notes.svelte.ts#L144) already takes.
3. **Test:** rerun `npm run check`. The `noteService.ts:36` error must be gone. Do not modify the real `updateNote`; only the interface.

#### Step 3 — Fix `sections` literal widening

1. In [`folderSidebarView.svelte.ts:100`](frontend/src/lib/views/folderSidebarView.svelte.ts#L100), the `$derived.by` returns objects with `id: 'views'` and `id: 'folders'`. TypeScript widens to `string`. `getSections()` declares return type `SidebarSourceSection[]` with `id: 'views' | 'folders'`.
2. Pick one fix:
   - Add `as const` on each `id` field, or
   - Annotate the `$derived.by` return type explicitly as `SidebarSourceSection[]`.
3. **Test:** rerun `npm run check`. Verify `folderSidebarView.svelte.ts:124` is gone.

#### Step 4 — Fix test fixtures

1. [`frontend/tests/unit/idbr.test.ts:97`](frontend/tests/unit/idbr.test.ts#L97) — add `folderId: null` and `updatedAt: new Date().toISOString()` to the note literal.
2. [`frontend/tests/unit/components/NoteItems.test.ts:61`](frontend/tests/unit/components/NoteItems.test.ts#L61) — remove the `createdAt: now` line.
3. **Test:** `cd frontend && npm run test -- tests/unit/idbr.test.ts tests/unit/components/NoteItems.test.ts` — both must pass. Then `npm run check` must exit 0.

#### Step 5 — Verification

1. `npm run check` → 0. `npm run test` → all green.
2. PR title: `fix(types): resolve four pre-existing npm run check errors`.

---

### R2 — Sanitise `AlertDialog` description (XSS fix)

#### Step 1 — Write the regression test first

1. Create [`frontend/tests/unit/components/alert.test.ts`](frontend/tests/unit/components/alert.test.ts).
2. Three cases:
   - **(a)** `description: 'Are you sure you want to delete "<img src=x onerror=window.__xss=true>"?'` renders as literal text. Assert `window.__xss` is undefined and the DOM contains the tag as text, not as an element.
   - **(b)** A dialog with `allowHtml: true` and `description: 'oh <br/> no'` renders a `<br>` element.
   - **(c)** A dialog without `allowHtml` and with `'Are you sure?'` renders normally.
3. Use `@testing-library/svelte` `render` and `screen` (see [`NoteItems.test.ts`](frontend/tests/unit/components/NoteItems.test.ts) for the pattern).
4. **Test:** `npm run test -- tests/unit/components/alert.test.ts`. All three cases must fail right now. Confirm the failures match your expectations before proceeding.

#### Step 2 — Extend `ConfirmOptions`

1. In [`dialog.svelte.ts`](frontend/src/lib/stores/dialog.svelte.ts), add optional `allowHtml?: boolean` field to `ConfirmOptions` (default `false`).
2. Set `allowHtml: true` **only** in `confirmAppQuit` (L105). Leave every other method unchanged.
3. **Test:** rerun `npm run check` — still 0 because the field is optional.

#### Step 3 — Use the flag in `alert.svelte`

1. In [`alert.svelte:11`](frontend/src/routes/alert.svelte#L11), replace the single `{@html dialog.description}` with a conditional: if `dialog.allowHtml` is true, render `{@html ...}`; otherwise render as plain text.
2. **Test:** rerun `npm run test -- tests/unit/components/alert.test.ts`. All three cases must pass.

#### Step 4 — Verification

1. `npm run test` → green. `npm run check` → 0.
2. `wails dev`. Create a note titled `<img src=x onerror=alert('pwn')>`. Delete → confirm the title shows as literal text in the dialog, no alert fires.
3. PR title: `fix(security): escape AlertDialog description; opt-in HTML via allowHtml flag`.

---

### R3 — Surface errors from debounced IndexedDB writes

#### Step 1 — Write the error-handling test first

1. Add to [`frontend/tests/unit/notes.test.ts`](frontend/tests/unit/notes.test.ts): `'persistNote error handling'` describe block.
2. Two cases:
   - **(a)** When `notesRepository.save` rejects, the store surfaces the error through a user-visible channel. Write the test against an injected error handler (e.g. expose `notesStore.onPersistError` as a `$state` callback).
   - **(b)** A successful save does not invoke the error handler.
3. Mock `notesRepository.save` with `vi.fn().mockRejectedValueOnce(new Error('quota'))`.
4. **Test:** both cases must fail — the channel does not exist yet.

#### Step 2 — Wire the error channel in `notesStore`

1. Add `onPersistError: ((err: unknown, noteId: string) => void) | null = $state(null)` to `NotesStore`.
2. In `persistNote` ([`notes.svelte.ts:96`](frontend/src/lib/stores/notes.svelte.ts#L96)), attach `.catch((err) => this.onPersistError?.(err, id))` to the `notesRepository.save` call.
3. Do the same for `persistSelection` at L105 (pass `'__selection__'` as the id).
4. Do **not** await — remain non-blocking.
5. **Test:** rerun the notes test file. Both cases must pass.

#### Step 3 — Wire `onPersistError` to a UI dialog

1. In [`+layout.svelte`](frontend/src/routes/+layout.svelte), inside `onMount` after `notesStore.init()`, set `notesStore.onPersistError = (err) => { uiStore.confirmAppQuit('Save failed', String(err), () => {}); }`.
2. **Test:** manual verification — this can be deferred to Step 4.

#### Step 4 — Manual verification

1. `wails dev`.
2. In DevTools console: `notesRepository.save = () => Promise.reject(new Error('simulated'))` then type into a note. After 500 ms, an error dialog appears.
3. PR title: `fix(data): surface IndexedDB write failures via uiStore instead of swallowing them`.

---

### R4 — Replace `Date.now()` batch key with a unique token

#### Step 1 — Write the collision test first

1. Add to [`frontend/tests/unit/folders.test.ts`](frontend/tests/unit/folders.test.ts): `'cascade delete batch uniqueness'`.
2. Scenario:
   - Seed two independent folders A and B, each with one note.
   - Stub `Date.now()` to return the same value for both deletes: `vi.spyOn(Date, 'now').mockReturnValue(1000)`.
   - Delete folder A, then delete folder B.
   - Restore folder A.
   - Assert folder B and its note remain in the trash.
3. **Test:** must fail today — both folders come back because batch keys collide.

#### Step 2 — Change the batch-key type and generator

1. Widen `FolderItem.deletedAt` in [`folders.svelte.ts:13`](frontend/src/lib/stores/folders.svelte.ts#L13) to `number | string | null` (keep `number` for back-compat).
2. Do the same in [`notes.svelte.ts:15`](frontend/src/lib/stores/notes.svelte.ts#L15).
3. In [`folderService.ts:82`](frontend/src/lib/stores/services/folderService.ts#L82), replace `const batch = batchTimestamp ?? Date.now()` with `const batch = batchTimestamp ?? crypto.randomUUID()`.
4. In [`folders.svelte.ts:150`](frontend/src/lib/stores/folders.svelte.ts#L150), replace `Date.now()` with `crypto.randomUUID()`.
5. In [`notes.svelte.ts:213`](frontend/src/lib/stores/notes.svelte.ts#L213) (inside `deleteNote`), replace `Date.now()` with `crypto.randomUUID()`.
6. Audit every other `Date.now()` call in stores/services — decide: batch key (replace with UUID) or real timestamp (leave as is). Document in the PR.
7. **Test:** rerun folders test file. The collision test must pass. `npm run check` — fix any downstream type errors inline.

#### Step 3 — Verify restore-by-batch still works

1. Rerun full notes + folders test suites. Any existing batch-restore tests must still pass unchanged.
2. Do not modify existing test code.

#### Step 4 — Manual verification

1. `wails dev`. Create folders A and B. Delete each quickly in succession. Open trash, restore A. Confirm B stays in trash.
2. PR title: `fix(data): use UUID batch key for cascade deletes to prevent collisions`.

---

### R5 — Flush pending writes before window close

#### Step 1 — Expose a frontend "flush all" entry point and test it

1. Open [`notes.svelte.ts`](frontend/src/lib/stores/notes.svelte.ts). Add public method `flushAllPendingWrites(): Promise<void>`. Inside:
   - Call `this.debouncer.flushAll()`.
   - Await a promise that resolves when all in-flight IndexedDB writes settle. Capture each promise from `notesRepository.save` into a `Set`, remove in `.finally`, and in `flushAllPendingWrites` `await Promise.allSettled(Array.from(set))`.
2. Add test file [`frontend/tests/unit/notes_flush.test.ts`](frontend/tests/unit/notes_flush.test.ts):
   - Case A — pending debounced write is executed and awaited. Call `updateNote`, immediately call `flushAllPendingWrites`, assert `notesRepository.save` was called with the expected snapshot.
   - Case B — no pending writes: `flushAllPendingWrites` resolves immediately.
3. **Test:** both cases must pass before moving on.

#### Step 2 — Register Wails `OnBeforeClose` hook

1. Open [`main.go`](main.go). On the `wails.Run(&options.App{...})` options, add `OnBeforeClose: app.beforeClose`.
2. In [`app.go`](app.go), implement:
   ```go
   func (a *App) beforeClose(ctx context.Context) (prevent bool) {
       runtime.EventsEmit(a.ctx, "app:before-close")
       // Block quit for up to 3 seconds while renderer flushes.
       // Use context.WithTimeout + EventsOnOnce listening for "app:flush-complete".
       return false // proceed with quit
   }
   ```
3. **Test (Go):** no unit test. Manual verification only — see Step 4.

#### Step 3 — Wire the frontend to the event

1. In [`+layout.svelte`](frontend/src/routes/+layout.svelte) `onMount`, subscribe: `EventsOn('app:before-close', async () => { await notesStore.flushAllPendingWrites(); EventsEmit('app:flush-complete'); })`.
2. Import `EventsOn` / `EventsEmit` from `$lib/wailsjs/runtime/runtime`.
3. Return the unsubscribe function so it is cleaned up on HMR.
4. **Test:** manual verification — see Step 4.

#### Step 4 — Manual verification (critical)

1. `wails dev`. Create a note. Start typing a word. Within 200 ms (before the 400 ms debounce fires), press ⌘Q / Ctrl+Q.
2. Reopen the app. The full word is present.
3. Repeat 5 times at different debounce-windows to catch races.
4. PR title: `fix(data): flush pending IndexedDB writes before Wails window close`.

---

### R6 — IndexedDB `upgrade()` skeleton + blocked handlers

#### Step 1 — Write the skeleton test first

1. Add to [`frontend/tests/unit/idbr.test.ts`](frontend/tests/unit/idbr.test.ts): `'upgrade() skeleton'`.
2. Two cases:
   - **(a)** Fresh DB (no version) goes through v1→v2 branch and all four stores exist. (Reuse/extend existing "should initialize" test.)
   - **(b)** Simulate `blocked` firing. Extract the blocked handler from `initDB` into a named export and test it in isolation. Assert it produces a user-visible dialog (can mock `uiStore` or just assert the handler returns/calls a callback).
3. **Test:** case (b) must fail — the handler does not exist.

#### Step 2 — Refactor `upgrade()` into a switch

1. In [`idbr.ts:33`](frontend/src/lib/stores/idbr.ts#L33), restructure:
   ```ts
   upgrade(db, oldVersion, newVersion, tx) {
       switch (oldVersion) {
           case 0: // fresh install
               db.createObjectStore('folders', { keyPath: 'id' });
               db.createObjectStore('notes',   { keyPath: 'id' });
               db.createObjectStore('settings');
               db.createObjectStore('backups', { keyPath: 'id' });
               // fall through
           case 1: // future: v1 → v2 migrations go here
               // (no-op today)
               break;
           default:
               break;
       }
   }
   ```

#### Step 3 — Add `blocked` and `blocking` handlers

1. Extend the `openDB` call in [`idbr.ts:32`](frontend/src/lib/stores/idbr.ts#L32) with:
   ```ts
   blocked(currentVersion, blockedVersion) { /* user dialog */ },
   blocking(currentVersion, blockedVersion) { /* also user dialog */ },
   ```
2. The handlers should call a user-facing alert reusing `uiStore.confirmAppQuit` with a message like "Another mdnotes window is open; please close it and restart."
3. **Test:** rerun `idbr.test.ts`. Case (b) must pass.

#### Step 4 — Verification

1. `npm run test` → green. `npm run check` → 0.
2. PR title: `chore(data): add IndexedDB upgrade switch skeleton and blocked/blocking handlers`.

---

### R7 — Debounce search input in the note list

#### Step 1 — Write the debounce test first

1. Add to [`frontend/tests/unit/views/noteListView.test.ts`](frontend/tests/unit/views/noteListView.test.ts) (create if missing): `'search debounce'`.
2. Case: calling `noteListView.setSearchQuery('a')` followed immediately by `noteListView.setSearchQuery('ab')` results in **one** filter computation after the debounce window, producing the filter for `'ab'`. Use `vi.useFakeTimers()`.
3. **Test:** must fail — the debounced API does not exist.

#### Step 2 — Expose a debounced search setter

1. Add to `NoteListView` in [`noteListView.svelte.ts`](frontend/src/lib/views/noteListView.svelte.ts):
   - `debouncedSearchQuery = $state('')`
   - `setSearchQuery(q: string)` method: stores raw query, schedules a 150 ms timer to copy to `debouncedSearchQuery`.
2. Change `getFilteredNotes` and `getSections` to read `this.debouncedSearchQuery` directly (no parameter).
3. **Test:** run the test file. Must pass.

#### Step 3 — Update the component

1. In [`NoteItems.svelte:16`](frontend/src/lib/components/NoteItems.svelte#L16), keep `let searchQuery = $state('')` bound to `<Input>` (input must be instantly responsive).
2. Add `$effect(() => noteListView.setSearchQuery(searchQuery))`.
3. Change `$derived(noteListView.getFilteredNotes(searchQuery))` and `$derived(noteListView.getSections(searchQuery))` to call without parameters.

#### Step 4 — Verification

1. `npm run test` → green. `npm run check` → 0.
2. `wails dev`. Type a search query — input echoes immediately; list updates after a pause. Rapid typing does not flicker per-keystroke.
3. PR title: `perf(ui): debounce note search filter by 150 ms`.

---

# Part B — MVP Readiness Backlog (original)

This is the original pre-release checklist. **Do not start these items until all of Part A (R1–R7) is complete.**

## 1. Bugs

### [x] 1.1 Note count badge is wrong for system-view folders

- **Start at:** `frontend/src/lib/stores/services/noteService.ts` — find `getNoteCountForFolder`. Then open [`Folders.svelte`](frontend/src/lib/components/Folders.svelte) and follow how `source.noteCount` is computed in [`folderSidebarView.svelte.ts`](frontend/src/lib/views/folderSidebarView.svelte.ts) (`this.noteQueries.getNoteCountForFolder(item.id, item.profile)`).
- **Investigate:**
  - For each system view (`home`, `favorites`, `deleted-notes`), does the returned count actually match what the folder's profile's `resolveNotes` would produce? Compare against `PROFILE_REGISTRY[*].resolveNotes` in [`profiles.ts`](frontend/src/lib/stores/domain/profiles.ts).
  - The trash badge is a known offender — stepping through the code, which branch does it hit and why does it return 0?
  - Is `folderType` (profile id) being threaded through all call sites?
- **Done when:** the three view badges and every regular-folder badge show the same count as the note list that appears when you click into the folder. Add a unit test under `frontend/tests/unit/` that covers all three system views plus a regular folder plus an empty trash.

### [x] 1.2 `selectNote(null)` calls `persist(null!)`

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

### [x] 4.1 Debounce note updates to IndexedDB

- **Files:** [`+page.svelte:65, 89`](frontend/src/routes/+page.svelte#L65) — `oninput` handlers call `noteService.update` synchronously, which persists to IndexedDB on every keystroke.
- **Investigate:**
  - Read `$lib/utils` first to see if a debounce helper already exists.
  - Target 300–400ms debounce. Make sure the debounce is **per-note** — switching to a different note must flush the pending write for the previous note immediately (otherwise you lose data if the app is closed mid-debounce).
  - Coordinate with item 3.2 — `updatedAt` should probably only bump when the debounce fires, not on every in-memory mutation.
  - Think about app-exit: Wails exposes a `beforeClose` hook. Does the pending debounced write get flushed before the DB connection closes?
- **Done when:** typing into a 10-word note produces one IndexedDB write, not ten. Verify with the browser devtools IndexedDB tab. No data is lost when you switch notes mid-type or close the app.

### [x] 4.2 Separate note persistence from selection persistence

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

### [x] 5.2 Loading state on startup

- **File:** [`+layout.svelte`](frontend/src/routes/+layout.svelte) — `onMount` does a sequence of awaits.
- **Investigate:**
  - How long does startup take with a realistic DB? Test with 500+ notes — the current "blank three-pane shell" can look broken.
  - Options: skeleton loaders in each pane, a global spinner, or a splash screen. Match the visual language of the dark theme.
  - Make sure the loading state doesn't block Wails' window from painting — the user should see _something_ within the first frame.
- **Done when:** user always sees a loading indicator until the stores are initialized. There is no visual flash of "empty app" state after stores load.

### [x] 5.3 Rename visual feedback on rejection

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

### [x] 5.5 Window title reflects context

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

- **Superseded by Part A item R1.** The `[x]` mark pre-dates Part A. See Part A § R1 for the live tracker.

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

1. All of **Part A (R1–R7)** is landed on `main`.
2. All items in Part B sections 1–6 are `[x]` or have a linked issue explaining why they're deferred.
3. `npm run check` and `npm run test` are green.
4. `wails build` produces a runnable binary on at least macOS and one of (Linux, Windows).
5. The README renders correctly on GitHub with working image links.
6. Manual smoke test: fresh install → create folder → create note → type → ⌘Q mid-type → reopen → the typed content is intact.
