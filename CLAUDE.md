# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All frontend commands run from the `frontend/` directory:

```bash
# Development
wails dev                    # Full app (hot-reload Svelte + Go) — run from repo root
npm run dev                  # Frontend only (Vite dev server)

# Type checking
npm run check                # svelte-kit sync + svelte-check
npm run check:watch

# Linting & formatting
npm run lint                 # Prettier check + ESLint
npm run format               # Auto-format

# Testing
npm run test                 # Unit tests (Vitest, run once)
npm run unit-test            # Unit tests (watch mode)
npm run test:coverage        # Unit tests with coverage (80% threshold enforced)
npm run test:e2e             # E2E tests (Playwright)

# Run a single test file
npm run test -- tests/unit/stores/notes.svelte.test.ts
npm run test:e2e -- tests/e2e/folders.e2e.ts

# Go
go test ./...                # All Go tests (from repo root)
wails build                  # Production binary
```

## Architecture

### Stack
- **Desktop shell**: Go + Wails v2 — thin native layer for window management, native menus (macOS), file dialogs, and single-instance lock. Business logic lives in the frontend, not Go.
- **Frontend**: Svelte 5 (Runes mode), SvelteKit, Vite
- **Storage**: IndexedDB (local-first, no sync, no cloud)
- **Search**: MiniSearch (on-demand, folder-scoped)
- **Styling**: Tailwind CSS v4 + CSS variables for theming

### Frontend Layers

The frontend enforces a strict 4-layer separation:

1. **Persistence** (`frontend/src/lib/infrastructure/`) — IndexedDB repositories. Core driver is `idbr.ts` using `switch(oldVersion)` migration skeleton. Separate stores: `notes_meta` (loaded at startup), `notes_contents` (loaded on demand).

2. **Domain Stores** (`frontend/src/lib/stores/*.svelte.ts`) — Svelte 5 rune-based classes. `folderStore` holds a reactive `SvelteMap` of folders; `notesStore` holds note metadata only (never content). Stores are singletons — reset via `.clear()` in tests, **never** replace with `new SvelteMap()` as it breaks reactive bindings.

3. **Service Layer** (`frontend/src/lib/stores/services/`) — All cross-store logic. Components must call services, never mutate stores directly. Circular dependencies resolved via setter injection (see `services.ts` registry). Key services: `FolderService`, `NoteService`, `TrashService`, `SearchService`.

4. **View Models / Projections** (`frontend/src/lib/views/`) — `FolderSidebarView` and `NoteListView` transform domain state into render-ready form. Components import these, not raw stores.

### Key Architectural Decisions

**Soft-delete model**: Notes and folders are never hard-deleted. `deletedAt` + `deletedBatchId` (UUID) enable atomic restoration of entire subtrees — batch UUID ensures all children of a deleted folder can be restored even when parent was deleted first.

**Search correctness**: Search results from MiniSearch are candidate IDs only. Always validate against canonical store state (`deletedAt`, folder scope) before rendering. When debugging search, inspect three layers independently: note query visibility → MiniSearch document lifecycle → final filtering in `NoteListView`/`SearchService`.

**Graceful shutdown**: On quit, Go intercepts `beforeClose`, emits `app:before-close`. Frontend flushes all debounced IndexedDB writes, emits `app:flush-complete`. Go waits for flush before allowing window close.

**Menu bridge**: Go menu items emit Wails events. A `$effect.root` listener in the frontend routes these to services. For new menu shortcuts, check `menu/menu_darwin.go` for conflicts with native roles (Edit role 2, Window role 3 must stay intact for Undo/Redo/Copy/Paste in `WKWebView`).

**`$state.snapshot()`**: Required before sending Svelte reactive state to Go bindings or IndexedDB to strip reactive proxies.

### Go ↔ Frontend Communication

- **Bindings** (request/response): Bound methods on `App` struct, called via generated `frontend/src/lib/wailsjs/` bindings.
- **Events** (one-way OS → frontend only): `runtime.EventsEmit` for menu actions and lifecycle events.

## Testing

### Unit tests (Vitest + JSDOM)

Location: `frontend/tests/unit/` organized by layer: `stores/`, `services/`, `views/`, `infrastructure/`, `components/`

**Store reset pattern** — always use `.clear()`, never reassign:
```typescript
beforeEach(() => {
  vi.clearAllMocks();
  (notesStore as any).notes.clear();
  (folderStore as any).folders.clear();
  // Re-initialize mandatory system items after clearing
  folderStore.folders.set("home", { id: "home", title: "Home", items: [], profile: "home" } as any);
});
```

**Reactivity verification** — use `$derived.by` watchers to confirm signals fire:
```typescript
let signals = 0;
const watcher = $derived.by(() => { signals++; return store.value; });
store.update();
expect(signals).toBe(2);
```

**bits-ui AlertDialog** — add this `afterEach` in every `describe` block that uses AlertDialog, to flush rAF callbacks before jsdom teardown:
```typescript
afterEach(async () => {
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
  await tick();
});
```

### E2E tests (Playwright)

Location: `frontend/tests/e2e/`

Each test gets an isolated IndexedDB instance:
```typescript
async function gotoApp(page: Page) {
  const dbName = `mdnotes-e2e-${Date.now()}`;
  await page.addInitScript((name) => { window.__MDNOTES_DB_NAME__ = name; }, dbName);
  await page.goto("/");
}
```
Always wait for `[data-app-ready="true"]` before interacting.

### Test file naming
- `camelCase.test.ts` — standard
- `camelCase.svelte.test.ts` — uses Svelte 5 runes/effects
- `camelCase.e2e.ts` — Playwright E2E

### Refactoring rule
Refactoring must never reduce total `it()`/`test()` count unless a mapping of every assertion to its replacement is shown first.

## Key Files

| File | Purpose |
|------|---------|
| `app.go` | Wails lifecycle, export/import file dialogs, menu event handlers |
| `menu/menu_darwin.go` | macOS native menu — `MenuHost` interface, keyboard shortcut definitions |
| `frontend/src/routes/+layout.svelte` | App boot, store/service wiring, keyboard handling, menu bridge |
| `frontend/src/lib/infrastructure/idbr.ts` | IndexedDB schema, migrations, transactional ops |
| `frontend/src/lib/stores/folders.svelte.ts` | Folder hierarchy, soft-delete, batch cascade |
| `frontend/src/lib/stores/notes.svelte.ts` | Note metadata CRUD, content lazy-load, selection |
| `frontend/src/lib/stores/services.ts` | DI registry, circular dependency resolution via setters |
