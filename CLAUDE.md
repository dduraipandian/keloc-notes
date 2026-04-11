# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**mdnotes** is a local-first desktop notes app (Apple Notes–style three-pane layout) built with Go + Wails v2 as the desktop shell, Svelte 5 in runes mode, and IndexedDB for all persistence. The Go backend is minimal — it only provides the native window. All application logic lives in the frontend.

## Commands

All frontend commands run from `frontend/`:

```bash
# Development
wails dev                  # Full-stack: Go backend + frontend hot-reload (run from root)
npm run dev                # Frontend only (Vite dev server)

# Build
wails build                # Produces native binary (from root)
npm run build              # Frontend production build only

# Type checking
npm run check              # Svelte + TypeScript type check

# Linting & formatting
npm run lint               # Check (Prettier + ESLint, fails if changes needed)
npm run format             # Auto-fix formatting

# Tests
npm run test                                           # All tests
npm run test -- src/lib/stores/notes.test.ts          # Single file
npm run test -- --watch                               # Watch mode
```

## Architecture

Three stores own all state. Components are read-only consumers — they call store methods for mutations and never write state directly.

```
folderStore  (folders.svelte.ts)   — folder tree, selection, rename, soft delete/recover
notesStore   (notes.svelte.ts)     — note CRUD, selection, soft delete/recover
uiStore      (ui.svelte.ts)        — confirmation dialog state (delete/restore prompts)
```

**Data flow on startup**: `+layout.svelte` awaits `folderStore.init()` then `notesStore.init()` sequentially (order matters — notes store calls `folderStore.findItemById` during load). Both read from IndexedDB via `idbr.ts`. On failure an AlertDialog is shown and `Quit()` from the Wails runtime closes the app.

**Persistence**: every mutation calls `store.persist()` immediately — there is no explicit save step. `persist()` in `notesStore` calls `putNote()` + `putSetting('selectedNoteID', ...)`. Do not call `persist()` before `isInitialized` is true (guard is inside `persist()`).

**Wails bindings**: Go methods exposed to the frontend generate TypeScript types at `frontend/src/lib/wailsjs/`. Runtime utilities (e.g. `Quit()`, `WindowSetTitle()`) are imported from `$lib/wailsjs/runtime/runtime`.

## Svelte 5 Runes

The project runs in runes mode for all non-`node_modules` files.

- `$state()` — reactive primitives and class fields
- `$derived` / `$derived.by()` — computed values; prefer these over plain methods for anything read in templates to avoid recomputing on every render cycle
- `SvelteMap` — used in all stores for reactive maps; calling `.set()` on it signals structural change to all iteration-based subscribers (`Array.from(map.values())`), which is expensive — only call `.set()` when adding or removing entries, not when mutating an existing `$state` object already in the map

The stores are singleton class instances. Tests reset them in `beforeEach` by directly assigning new `SvelteMap()` instances to their properties.

## Soft Delete Pattern

Both notes and folders use `deletedAt`:

- `null` / `undefined` = active
- `Date.now()` (number) = in trash

Folder deletes cascade: `folderStore.deleteFolder()` stamps all child folders and calls `notesStore.deleteNotesInFolder()` with the same batch timestamp. Recovery is batch-aware: `recoverFolderAndChildren()` only restores items whose `deletedAt` matches the batch epoch, leaving independently-deleted items alone. `findTopDeletedAncestor()` walks up the tree to find the root of a deleted subtree.

## Testing Conventions

- `*.test.ts` files run in a Node/server environment via Vitest
- Mock `idbr` with `vi.mock('./idbr', () => ({ ... }))` — all methods should be `vi.fn()`
- Reset store state in `beforeEach`: reassign `notes`/`folders` to `new SvelteMap()`, reset primitive `$state` fields directly, set `isInitialized = false`
- Call `vi.restoreAllMocks()` before `vi.clearAllMocks()` in `beforeEach` — spies from one test otherwise leak into the next (`clearAllMocks` resets call counts but not implementations)
- Use `vi.spyOn()` to assert cross-store calls (e.g. `notesStore.deleteNotesInFolder` called from `folderStore.deleteFolder`)
- `addNoteToStore` helpers set notes directly on `notesStore.notes` — do not wrap in `$state()` inside test files (runes are not available in plain `.test.ts` files)

# Instruction

Don't make any changes until you have 95% confidence in what you need to build. Ask me follow-up questions until you reach that confidence level.
