# Testing & Verification Architecture

## Current Test Stack

### Unit Tests (Vitest)
- **Environment**: JSDOM
- **Focus**: Domain logic, store reactivity, and service-layer orchestration.
- **Location**: `frontend/tests/unit/` (broken down by architectural layer).

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
- **Standard**: Always use `camelCase.test.ts`.
- **Svelte 5 / Runes**: Use `camelCase.svelte.test.ts` if the test utilizes runes or tests reactive effects.
- **E2E**: Use `camelCase.e2e.ts`.

---

## Standard Test Patterns

### 3. Isolation Strategies
To ensure tests are deterministic and don't leak state:

#### **Unit Test Store Reset**
Since Svelte 5 stores are effectively singletons, they must be manually reset in `beforeEach`:
```typescript
beforeEach(() => {
    vi.clearAllMocks();
    (notesStore as any).notes = new SvelteMap(); // Clear reactive map
    (notesStore as any).selectedNoteID = null;
    selectionStore.__resetForTest();            // Use internal reset helper
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
    await page.goto('/');
}
```

### 4. Mocking Patterns

#### **Dependency Injection (Service Tests)**
Services are tested by passing mocked store interfaces into the constructor:
```typescript
it('delegates creation', () => {
    const folders = { createFolder: vi.fn() };
    const service = new FolderService(folders as any);
    service.create();
    expect(folders.createFolder).toHaveBeenCalled();
});
```

#### **Repository Interception**
Use `vi.mock` for low-level persistence layers to avoid hitting IndexedDB in unit tests:
```typescript
vi.mock('$lib/stores/repositories', () => ({
    notesRepository: { saveMeta: vi.fn(), list: vi.fn() }
}));
```

### 5. Reactivity & Signal Testing
To verify Svelte 5 signals are firing (not just checking the value):
```typescript
it('triggers signal on update', () => {
    let signals = 0;
    const watcher = $derived.by(() => {
        signals++;
        return store.value;
    });
    
    expect(watcher).toBe(initial); // Track
    store.update();
    expect(signals).toBe(2);       // Verified!
});
```

### 6. E2E Interaction Helpers
Avoid repeating selectors. Use functional helpers at the top of E2E files:
- `createFolder(page, title)`
- `createNote(page, title, content)`
- `getSideBarFolderByLabel(page, label)`

---

## Critical Gates
1.  **Strict TDD**: Write a failing unit test in `tests/unit/` *before* implementing any service or store logic.
2.  **App Ready Sentinel**: E2E tests must wait for `[data-app-ready="true"]` before interacting.
3.  **Naming Integrity**: Use `camelCase` for all new test files.
4.  **No identity Mismatch**: Prefer `$lib` imports. If using relative paths, ensure they are depth-corrected (e.g., `../../../src`) to avoid duplicate store instances.

## Commands
```bash
cd frontend
npm run test           # Unit tests
npm run test:e2e       # E2E tests
npm run check          # Type checking
```

