# MVP Readiness Checklist

---

## Bugs

- [x] **Init race condition** — `folderStore.init()` and `notesStore.init()` run concurrently in `+layout.svelte:12-15`. Notes store calls `folderStore.findItemById()` during load; if notes resolve first, folder lookups return null and notes land incorrectly. Fix: `await folderStore.init()` before `notesStore.init()`.

- [ ] **Note count badges** — `getNoteCountForFolder` is called in `Folders.svelte` without passing `folderType` for typed folders (`all`, `trash`). The trash folder badge always shows 0 unless the special `folderId === 'deleted-notes'` path is hit. Pass `item.type` consistently.

- [x] **`init()` errors are silent** — `folderStore.init()` and `notesStore.init()` can throw (DB failure, corrupt data) but `+layout.svelte` has no try/catch or error boundary. User sees a blank app with no explanation. Show an error state.

---

## Missing Features

- [x] **Empty Trash** — `idbr.ts` already has `deleteNote()` and `deleteFolder()` for hard deletes but nothing calls them. Trash accumulates forever. Add "Empty Trash" to the trash folder context menu.

- [ ] **Keyboard shortcuts** — no shortcuts exist. Minimum set:
  - `Cmd+N` — new note in current folder
  - `Cmd+Delete` / `Cmd+Backspace` — delete selected note
  - `Escape` — cancel rename / deselect note

- [ ] **Light mode / theme toggle** — `+layout.svelte:18` hardcodes `class="dark"`. CSS variables for light mode are fully defined in `layout.css:9-42` but never activated. Wire up a toggle and/or respect `prefers-color-scheme`.

---

## Svelte Reactivity

- [ ] **Redundant `notes.set()` on existing notes causes full-map invalidation** — `deleteNote`, `recoverNote`, `recoverNotesInFolder`, and `deleteNotesInFolder` all call `this.notes.set(id, note)` after mutating the note object directly. Since every note is already a `$state` proxy, the direct mutation (`note.deletedAt = x`) is already fine-grained and only notifies subscribers of that specific field. The subsequent `.set()` call is a lie to `SvelteMap` — it signals structural change, which forces every consumer of `Array.from(notes.values())` (the note list, all badge counts) to re-run. Remove all `.set()` calls on existing notes; only use `.set()` when adding a new note.

- [ ] **Typing re-sorts the note list on every keystroke** — `updateNote` always sets `updatedAt: new Date().toISOString()`. Since `getNotesForFolder` sorts by `updatedAt` and `filteredNotes` is `$derived` from it, the reactive graph is: keystroke → `note.updatedAt` changes → `filteredNotes` re-derives → note list re-renders and the active note jumps to top position. Fix: only update `updatedAt` in memory when the debounce fires (at persist time), not on every mutation.

- [ ] **`sections` derived is wrong — derives a function, not a value** — `NoteItems.svelte:31` writes `$derived(() => groupNotesByDate(filteredNotes))`, which makes `sections` a `() => [...]` function, not the grouped result. The template calls `sections()` on every render, bypassing Svelte's caching entirely. Fix: `const sections = $derived(groupNotesByDate(filteredNotes))`.

- [ ] **`getNoteCountForFolder` re-runs full iteration on every render** — called directly in `Folders.svelte` template markup for each folder badge, which re-runs `Array.from(notes.values()).filter(...)` on every render cycle. Replace with a `$derived.by` folder-count index in the store — a `Map<FolderID, number>` computed once and cached until a note's `folderId` or `deletedAt` actually changes:
  ```ts
  private folderCounts = $derived.by(() => {
      const counts = new Map<string, number>();
      for (const note of this.notes.values()) {
          const key = note.deletedAt != null ? 'deleted-notes' : (note.folderId ?? 'root');
          counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return counts;
  });
  ```
  This becomes O(1) per badge after the redundant `.set()` calls are removed (point 1).

---

## Performance

- [ ] **Debounce `updateNote` on input** — `+page.svelte:71,96` calls `updateNote` on every `oninput` event, firing `putNote` to IndexedDB on every keystroke. Debounce at 300–400ms.

- [ ] **`persist()` always writes `selectedNoteID`** — `notes.svelte.ts:65-72` calls `putSetting('selectedNoteID', ...)` on every note save, even when only the note content changed. Separate note persistence from selection persistence.

- [ ] **Note content in the same object as metadata** — all note content is loaded into memory on startup with `getAllNotes()`. This is already planned as a separate improvement (content → separate object store, lazy-loaded on selection). This also eliminates typing from affecting the metadata reactive graph entirely.

---

## UX

- [ ] **No auto-select on folder switch** — clicking a folder shows an empty content pane until the user manually clicks a note. Apple Notes auto-selects the most recent note. In `folderStore.selectFolder()`, also call `notesStore.selectNote(firstNoteId)`.

- [ ] **No auto-advance after note delete** — after deleting the selected note the content pane goes blank. Select the next note in the current folder list automatically.

- [ ] **No loading state on startup** — while IndexedDB loads, the app shows an empty three-pane shell. Add a brief loading indicator so users don't think the app is broken or their notes are gone.

- [ ] **Rename: no visual feedback on rejection** — if a user clears a folder name and blurs the input, `renameFolder` silently ignores it (title stays the same) but the input was already bound to the empty string. User sees nothing happen. Either revert the input value visually or briefly flash the original name.

- [ ] **No fallback folder after folder delete** — when the selected folder is deleted, `selectedFolderID` becomes null but no folder is auto-selected. The note list goes blank with no active folder. Fall back to the first available folder or the default folder.

- [ ] **Resizable panes** — folder sidebar is fixed at `w-64`, notes list at `w-[350px]`. For a desktop app, users expect drag handles between panes. This is a significant desktop UX expectation.

- [ ] **Window title doesn't reflect context** — always shows "mdnotes". Should update to the current note title (or folder name), matching native desktop app conventions. Use Wails `runtime.WindowSetTitle()` from a `$effect` on `selectedNote`.

- [ ] **No menu bar integration** — desktop apps expose common actions via the OS menu bar (File > New Note, Edit > Delete, etc.). Wails supports custom menus via `options.Menu`. At minimum: New Note, Delete Note, New Folder.

---

## Code Cleanup

- [ ] **`folderNotes` SvelteMap is never used** — `notes.svelte.ts:18` declares `folderNotes = new SvelteMap()` but nothing reads or writes it. Remove.

- [ ] **`initialMockNotes` array is never used** — `notes.svelte.ts:244-274` declares seed data that is never passed to the constructor (`new NotesStore([])`). Remove.

- [ ] **`url` field on `FolderItem`** — `folders.svelte.ts:8` every folder has `url: '#'` but it is never used for navigation. Remove from the type and all construction sites.

- [ ] **`badge` field on `FolderItem`** — declared in the type but never read or written anywhere. Remove.

- [ ] **`Greet()` stub in `app.go`** — leftover from Wails template. Remove before open source release.

---

## Polish / Release

- [ ] **README** — fix Go version (`1.26` does not exist, likely `1.23`), add screenshots, replace the tech-stack features list with actual user-facing features.

---

## Deferred

- [ ] **Rich text editor** (TipTap) — placeholder `<textarea>` at `+page.svelte:89`. Intentionally last.
