# MVP Readiness Checklist

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

### Phase T: Testing & Reliability (Current Focus)
- [ ] **Coverage Reporting** — Install and configure `@vitest/coverage-v8`.
- [ ] **Persistence Testing** — Implement `fake-indexeddb` for `idbr.ts` and repository unit tests.
- [ ] **Component Testing** — Unit tests for `Folders.svelte` and `NoteItems.svelte`.
    - [ ] Folder selection & renaming interactions.
    - [ ] Note selection & hover state interactions.
- [ ] **85% Coverage Target** — Achieve 85%+ coverage on all `stores` and `services`.

### Phase C: Desktop Polish & UX
- [ ] **Keyboard shortcuts** — Implementation of `Cmd+N`, `Cmd+Delete`, and `Escape`.
- [ ] **Window title context** — Update OS window title to reflect active note/folder.
- [ ] **Menu bar integration** — Native OS menu bar actions (Wails options).
- [ ] **Resizable panes** — Drag handles between sidebar, list, and editor.
- [ ] **No loading state on startup** — Add brief loading indicator for IndexedDB initialization.

### Phase D: Refinement & Theming
- [ ] **Light mode / theme toggle** — Wire up existing light mode CSS variables.
- [ ] **Rename feedback** — Add visual feedback (flash/revert) for invalid folder renames.
- [ ] **No fallback folder after delete** — Auto-fallback to Home or first folder when active folder is deleted.

### Phase E: Performance & Architecture (Scale)
- [ ] **Lazy-load note content** — Move full text to separate object store to keep metadata operations fast.

### Phase F: Release Readiness
- [ ] **README updates** — Fix tech stack details, add documentation and screenshots.
- [ ] **Rich text editor** — Final replacement of `<textarea>` with TipTap (TipTap/Markdown).

---

## 🛠️ Deferred
- [ ] **Mobile Responsive Mode** — Currently focused on Desktop (Wails).
- [ ] **Cloud Sync** — Multi-device synchronization.
