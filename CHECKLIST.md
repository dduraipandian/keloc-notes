# mdnotes — Technical Readiness Roadmap

This file is the authoritative roadmap for getting mdnotes to a public release. It is split into two parts:

- **Part A — Release Blockers** (new). Seven items (R1–R7) that must be completed before public release. This section is structured for junior contributors with test-first discipline and step-by-step instructions.
- **Part B — MVP Readiness Backlog** (current). The current high-level backlog after the release blockers. This root file is the single source of truth.

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

1. In [`frontend/src/lib/views/folderSidebarView.svelte.ts:100`](frontend/src/lib/views/folderSidebarView.svelte.ts#L100), the `$derived.by` returns objects with `id: 'views'` and `id: 'folders'`. TypeScript widens to `string`. `getSections()` declares return type `SidebarSourceSection[]` with `id: 'views' | 'folders'`.
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

# Part B — MVP Readiness Backlog

This is the current high-level backlog after the Part A release blockers. The repo root checklist is now the single source of truth.

---

## ✅ Phases A & B: Completed

### Core Architecture & Bugs

- [x] **Init race condition** — `folderStore.init()` and `notesStore.init()` now run sequentially.
- [x] **Note count badges** — Robust O(1) bookkeeping system implemented in `NotesStore`.
- [x] **`init()` errors** — Handled with try/catch and error dialogs in `+layout.svelte`.
- [x] **Empty Trash** — Hard delete functionality added to context menus.

### Svelte 5 Reactivity Optimizations

- [x] **Fine-grained updates** — Eliminated redundant `.set()` calls on proxies to prevent full-map invalidations.
- [x] **Typing performance** — `updatedTimestamp` is now updated via debouncer, preventing re-sorts on every keystroke.
- [x] **Derived Logic** — Fixed `sections` and badge counts to use proper Svelte 5 derived patterns.

### Performance & Persistence

- [x] **Input Debouncing** — 400ms debounce on all note edits.
- [x] **Decoupled Persistence** — Selection persistence is now independent of content persistence.

### UX Foundations

- [x] **Auto-select (Folder Switch)** — Automatically selects the first note when switching folders.
- [x] **Selection Shifting (Deletions)** — Automatically selects the neighbor note after deleting the active one.
- [x] **Selection Shifting (Restoration)** — Stays in Trash and selects a neighbor after restoration ("Stay in Trash" behavior).

### Code Cleanup

- [x] **Legacy Removal** — Removed unused `folderNotes`, `initialMockNotes`, and `Greet()` stubs.
- [x] **Schema Cleanup** — Removed unused `url` and `badge` fields from `FolderItem`.

---

## 📋 Future Phases: Pending

### Phase C: Desktop Polish & UX

- [x] **Keyboard shortcuts** — `Cmd+N` (new note), `Cmd+Shift+N` (new folder), `Escape` (close dialogs / cancel rename), arrow-key folder navigation, `Delete`/`Backspace` (trash selected note), and `/` (focus search) are all implemented.
- [x] **Window title context** — Update OS window title to reflect active note/folder.
- [x] M1: Native Menu Bar (HIG-compliant)
- [x] M2: Dynamic Enablement (Enable/disable menu items based on state)
- [x] M3: Shortcut Reconciliation (Move JS shortcuts to native menu)
- [x] M4: About Dialog integration
- [x] M5: Preferences/Settings window integration
- [x] M6: Markdown Import/Export integration
- [x] M7: JSON Backup Import/Export integration
- [x] M8: Menu bar dynamic enablement, extensible for Windows/Linux. Full implementation plan (TDD, M1–M12) in [MENU_BAR.md](MENU_BAR.md).
- [x] **Resizable panes** — Drag handles between sidebar, list, and editor.
- [x] **No loading state on startup** — Add brief loading indicator for IndexedDB initialization.

### Phase D: Refinement & Theming

- [x] **Light mode / theme toggle** — Wire up existing light mode CSS variables.
- [x] **Rename feedback** — Add visual feedback (flash/revert) for invalid folder renames.

### Phase E: Performance & Architecture (Scale)

- [x] **Lazy-load note content** — Move full text to separate object store to keep metadata operations fast.

### Phase F: Release Readiness

- [ ] **Backup import/export trustworthiness** — Fix `frontend/src/lib/backup/backup.ts` so imports persist notes, folders, and settings to IndexedDB before reload. Add automated coverage for backup export/import plus app restart validation.
- [ ] **User-visible import/export failures** — Replace console-only failures in menu-driven import/export flows with actionable dialogs or notifications so users are never left with "nothing happened."
- [ ] **One-click install path** — Publish a real end-user install path for the primary release target, not just `wails build`. Start with a signed/notarized macOS `.app`/DMG and documented install steps.
- [ ] **Platform support positioning** — Either implement Windows/Linux menu parity or explicitly mark those platforms as preview / unsupported in README, releases, and product copy until parity exists.
- [ ] **First-run onboarding** — Add empty-state guidance for a brand-new library: create first folder, create first note, and explain the three-pane workflow without requiring README reading.
- [ ] **Native menu completeness** — Remove or implement placeholder menu items/actions (`Close Window`, `Enter Full Screen`, Help actions) before calling the app release-ready.
- [ ] **Versioning source of truth** — Drive About dialog version, backup metadata, installer metadata, and release tags from one canonical app version instead of mixed fallbacks.
- [ ] **Privacy & storage documentation** — Document exactly where local data is stored, what "local-first" means, whether data is encrypted at rest, and what backup compatibility guarantees exist across versions.
- [ ] **README updates** — Fix tech stack details, add documentation and screenshots. Note: Go version is listed as "1.26+" but `go.mod` specifies 1.23.
- [ ] **Screenshots for the repo** — Add polished app screenshots under `docs/screenshots/` and reference them from `README.md`.
- [ ] **Rich text editor** — Final replacement of `<textarea>` with TipTap (TipTap/Markdown).
- [ ] **Fix LICENSE copyright** — `LICENSE` still has placeholder `[yyyy] [name of copyright owner]` in the appendix boilerplate. Fill in actual values before public release.
- [ ] **Remove local path from `go.mod`** — Line 38 has a commented-out `replace` directive leaking `/Users/dduraipandian/...`. Remove before open-sourcing.
- [ ] **Clean `.gitignore`** — Add `.claude/` to root `.gitignore` (contains local filesystem paths in `settings.local.json`). Add `*.DS_Store` at root level.
- [ ] **Add `CONTRIBUTING.md`** — Dev setup, code style, PR process, test requirements for outside contributors.
- [ ] **Add `SECURITY.md`** — Vulnerability disclosure policy (standard for public repos).
- [ ] **CI/CD workflow** — GitHub Actions for `npm run test`, `npm run check`, `npm run lint`, and `wails build` on macOS.
- [ ] **Issue & PR templates** — Add `.github/ISSUE_TEMPLATE/` and `PULL_REQUEST_TEMPLATE.md`.

---

## 🛠️ Deferred

- [ ] **Phase T: Testing & Reliability** — Mostly covered for MVP; defer deeper coverage and reliability hardening until later.
- [ ] **Phase S: Advanced Search Features** — VS Code style toggles (Match Case, Whole Word, Regex).
- [ ] Coverage Reporting
- [ ] Persistence Testing
- [ ] Component Testing
  - [ ] Folder selection & renaming interactions.
  - [ ] Note selection & hover state interactions.
- [ ] 85% Coverage Target
- [ ] **Mobile Responsive Mode** — Currently focused on Desktop (Wails).
- [ ] **Cloud Sync** — Multi-device synchronization.
- [ ] **Release artifacts & signing** — Document the Wails release process and platform signing/notarization before 1.0.
- [ ] **CHANGELOG** — Add `CHANGELOG.md` (keep-a-changelog format or automated via CI).

---

## Release Gate

Before cutting a public release, confirm:

1. All of **Part A (R1–R7)** is landed on `main`.
2. All Phase F release-readiness items above are `[x]` or have a linked issue explaining why they are intentionally deferred from the public release.
3. `npm run check`, `npm run test`, and `npm run test:e2e` are green under a documented supported Node version.
4. Backup restore smoke test passes: export backup → wipe app data / use fresh DB → import backup → restart app → notes, folders, and settings are still present.
5. Import/export failure paths are user-visible and actionable; no release-critical flows fail with console-only errors.
6. A real installer / release artifact exists for the primary supported platform, with signing/notarization status documented and install steps verified on a clean machine.
7. Platform claims match reality: if Windows/Linux are still partial, the README and release notes say so explicitly.
8. The README renders correctly on GitHub with working image links, screenshots, and a <5 minute quick start for end users.
9. Manual smoke test: fresh install → create folder → create note → type → ⌘Q mid-type → reopen → the typed content is intact.
10. Secret scan: no local filesystem paths, PII, or credentials in tracked files (`go.mod` replace directives, `.claude/` settings, etc.).
11. `.gitignore` covers `.claude/`, `*.DS_Store`, and build artifacts.
12. `LICENSE` copyright boilerplate is filled in with actual year and holder name.
13. About dialog version, backup metadata version, and release tag all match the same canonical application version.
