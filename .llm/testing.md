# Testing & Verification Architecture

## Current Test Stack

### Unit Tests (Vitest)

- **Environment**: JSDOM
- **Focus**: Domain logic, store reactivity, and service-layer orchestration.
- **Location**: `frontend/tests/unit/` (broken down by architectural layer).
- **Known Harness Quirk**: Bits UI body-scroll-lock cleanup can outlive a test. Alert/dialog tests should flush pending timers and call `cleanup()` explicitly to avoid `document is not defined` unhandled exceptions after JSDOM teardown.

### End-to-End Tests (Playwright)

- **Environment**: Chromium (Local-first, no network mocking required).
- **Focus**: Multi-step user journeys and UI regressions.
- **Location**: `frontend/tests/e2e/`

---

## Organization & Naming Standards

### 1. File Structure

Unit tests are grouped by their corresponding architectural layer:

- `tests/unit/stores/`: Logic for Svelte stores and reactive state.
- `tests/unit/services/`: Coordination logic and cross-store workflows.
- `tests/unit/views/`: View-model projections for UI components.
- `tests/unit/infrastructure/`: Persistence (IndexedDB), repositories, and system-level rules.
- `tests/unit/components/`: Isolation tests for Svelte components.

### 2. Naming Conventions

- **Standard**: Always use `camelCase.test.ts`. This applies to all test files, regardless of the component naming (e.g., `folderSidebarView.svelte.test.ts` for `FolderSidebarView.svelte`).
- **Svelte 5 / Runes**: Use `camelCase.svelte.test.ts` if the test utilizes runes or tests reactive effects.
- **E2E**: Use `camelCase.e2e.ts`.
- **Legacy Migration**: PascalCase test files are deprecated and should be renamed to camelCase during refactoring.

---

## Standard Test Patterns

### 3. Isolation Strategies

To ensure tests are deterministic and don't leak state:

#### **Unit Test Store Reset**

Since Svelte 5 stores are effectively singletons, they must be manually reset in `beforeEach`.
**CRITICAL**: Always use `.clear()` for maps/sets and re-initialize mandatory items. **DO NOT** replace the property with a new `SvelteMap()` as it breaks reactive bindings established during store initialization.

```typescript
beforeEach(() => {
  vi.clearAllMocks();

  // Clear reactive maps without breaking identity
  (notesStore as any).notes.clear();
  (folderStore as any).folders.clear();

  // Re-initialize mandatory system folders/views
  folderStore.folders.set("home", {
    id: "home",
    title: "Home",
    items: [],
    profile: "home",
  } as any);

  (notesStore as any).selectedNoteID = null;
  (notesStore as any).isInitialized = true;
  (folderStore as any).isInitialized = true;

  selectionStore.__resetForTest(); // Use internal reset helper
});
```

#### **E2E Database Isolation**

Every E2E test runs against a unique, ephemeral IndexedDB instance:

```typescript
async function gotoApp(page: Page) {
  const dbName = `mdnotes-e2e-${Date.now()}`;
  await page.addInitScript((name) => {
    window.__MDNOTES_DB_NAME__ = name; // Driver uses this name if present
  }, dbName);
  await page.goto("/");
}
```

### 4. Mocking Patterns

#### **Dependency Injection (Service Tests)**

Services are tested by passing mocked store interfaces into the constructor:

```typescript
it("delegates creation", () => {
  const folders = { createFolder: vi.fn() };
  const service = new FolderService(folders as any);
  service.create();
  expect(folders.createFolder).toHaveBeenCalled();
});
```

#### **Repository Interception**

Use `vi.mock` for low-level persistence layers to avoid hitting IndexedDB in unit tests:

```typescript
vi.mock("$lib/stores/repositories", () => ({
  notesRepository: { saveMeta: vi.fn(), list: vi.fn() },
}));
```

### 5. Reactivity & Signal Testing

To verify Svelte 5 signals are firing (not just checking the value):

```typescript
it("triggers signal on update", () => {
  let signals = 0;
  const watcher = $derived.by(() => {
    signals++;
    return store.value;
  });

  expect(watcher).toBe(initial); // Track
  store.update();
  expect(signals).toBe(2); // Verified!
});
```

### 6. E2E Interaction Helpers

Avoid repeating selectors. Use functional helpers at the top of E2E files:

- `createFolder(page, title)`
- `createNote(page, title, content)`
- `getSideBarFolderByLabel(page, label)`

---

## Critical Gates

1.  **Strict TDD**: Write a failing unit test in `tests/unit/` _before_ implementing any service or store logic.
2.  **App Ready Sentinel**: E2E tests must wait for `[data-app-ready="true"]` before interacting.
3.  **Naming Integrity**: Use `camelCase` for all new test files.
4.  **No identity Mismatch**: Prefer `$lib` imports. If using relative paths, ensure they are depth-corrected (e.g., `../../../src`) to avoid duplicate store instances.
5.  **Derived Cache Invariants**: Any feature backed by a derived cache or index, especially MiniSearch, needs tests for add, update, delete, and restore transitions. Happy-path indexing coverage is not enough.

## Refactoring & Consolidation Protocol

To prevent regressions and loss of test coverage during architectural cleanups:

1.  **Zero-Loss Guarantee**: Refactoring must NEVER reduce the total test count (`it()` / `test()`) unless explicitly approved. If a test is redundant, it must be proved that the exact same assertion exists elsewhere.
2.  **Inventory Audit**: Before deleting any legacy test file, the model must:
    - List every `it()` title in the legacy file.
    - Identify the corresponding `it()` in the new consolidated file.
    - Present the mapping in the implementation plan.
3.  **Atomic Migration**: Consolidate one domain at a time (e.g., Folder Service first). Verify that total project test count remains constant or increases before proceeding to the next domain.
4.  **Transactional Integrity**: Never discard failure-path (rollback) or edge-case tests. These are often the most critical tests that are accidentally omitted during "cleanup".
5.  **Reactive State Preservation**: When migrating tests to Svelte 5 stores, ensure that $derived values and effects are verified using the "watcher" pattern (see Patterns #5).

## Commands

```bash
cd frontend
npm run test           # Unit tests
npm run test:e2e       # E2E tests
npm run check          # Type checking
```

## Recent Regression Areas Worth Guarding

- **Backup persistence**: Export/import tests should verify restart durability, not just DTO generation.
- **Backup import guard**: Keep explicit tests proving backup import fails for pre-populated or previously used libraries and succeeds only for a fresh app.
- **Menu bridge**: Native menu actions need tests for user-visible failure paths and dynamic enablement.
- **Markdown ZIP import/export**: Guard selected-folder-relative path handling, conflict confirmation behavior, and image asset round-tripping.
- **Search**: Folder-scoped search needs explicit coverage for soft-deleted notes, stale index entries, and subtree scoping.
