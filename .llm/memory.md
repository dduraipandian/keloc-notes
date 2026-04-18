# Session Memory

## Checklist Execution Pattern

- The user is working through [CHECKLIST.md](/Users/dduraipandian/apps/mdnotes/CHECKLIST.md) item by item and expects status to stay aligned with the actual codebase.
- We have successfully transitioned from Release Blockers (Part A) to MVP Readiness (Part B).

## Testing Expectations

- **TDD for Features**: Every new feature (like Full Text Search) requires a unit test confirming the happy and unhappy paths before implementation.
- **E2E as Final Gate**: Search functionality must pass Playwright tests specifically for content retrieval and folder scoping.
- **Regression Guard**: Full test suite runs are mandatory after architectural refactors (like resolving circular dependencies).

## Full Text Search (Phase 2) Implementation

- **Library**: `MiniSearch` is the standard for high-performance, local-first search in this project.
- **Precision over Recall**: Global fuzzy matching is **disabled** by default to prevent "noisy" results (e.g., "God" matching "good"). The app favors exact/prefix matching for predictability.
- **Scoped Search**: Search is restricted to the active folder and its subtree.
- **Indexing Strategy**: 
  - On-demand indexing: Content is loaded from IndexedDB only when a folder tree becomes active.
  - Incremental updates: Notes are added/replaced in the index during the `persistNote` lifecycle.

## Architectural Stabilization

- **Circular Dependency Resolution**: Avoid top-level singleton imports between `NotesStore` and `SearchService`. 
- **Pattern**: Use **Setter-based Dependency Injection** in `NotesStore`. The `SearchService` is initialized in a registry (like `services.ts`) and injected into the store post-initialization.
- **Wails v2 Alignment**: The project has reverted to **Wails v2** and **Go 1.23.0** for stability. Future backend work (menus/events) must adhere to the v2 API.

## Search and UI UX

- **Debounce**: Search recomputes 150ms after typing stops to keep the UI smooth with large note lists.
- **E2E Scoping**: When testing folder-scoped search, explicitly navigate to "Home" before creating new folders to ensure they are siblings (flat structure) rather than children (nested structure).

## Persistence And Error Handling

- **Lazy Loading**: `notes_meta` (metadata) and `notes_contents` (body) are stored in separate IndexedDB stores.
- **Metadata first**: UI list operations should only ever touch metadata to maintain high performance. Content is fetched only for the active editor or search indexer.

## Deletion Model

- `deletedAt` is a timestamp only.
- `deletedBatchId` (UUID) is used for grouping cascade deletions and restorations.
-耦合警告: `deletedAt` and `deletedBatchId` must be updated together in delete/restore paths.

## Native Menu Reactivity (Wails v2 + Svelte 5)

- **Problem**: `File > Export > Current Note` (and other state-dependent items) stayed disabled after selecting a note because `$effect.root` inside a utility module didn't re-track store getters.
- **Fix**: Place the menu-state effect inside a component (`+layout.svelte`) and **explicitly access the primitive** `notesStore.selectedNoteID` alongside the `selectedNote` derived getter. Reading only the getter is not enough — runes need a direct reactive property read to register the dependency.
- **Pattern**: `const noteId = notesStore.selectedNoteID;` **before** using `notesStore.selectedNote` in the same effect body. Menu state is then pushed via `UpdateMenuState(new menu.MenuState({...}))`.

## macOS Native Text Editing (Undo/Copy/Paste/Select All)

- **Resolution**: Native macOS text editing functionality (Select All, Copy, Paste, Undo) has been restored by using Wails v2 **native roles** in `menu_darwin.go`.
- **Implementation**: 
  - The Edit menu must use `menu.EditMenu()` (Role 2) and the Window menu must use `menu.WindowMenu()` (Role 3).
  - On macOS, when a menu item has these roles, Wails tells the native AppKit layer to handle the menu in a standard way. This allows the OS to route shortcuts directly to the `WKWebView`'s first responder (the focused textarea) without Go-side interception.
- **Limitation**: The native `EditMenuRole` provides a hardcoded list of standard items that cannot be easily extended in Wails v2. Consequently, the **Find** command (Cmd+F) was relocated to the **View** menu to maintain its functionality without breaking the native Edit shortcuts.
- **Stable Platform**: Reconfirmed **Wails v2** and **Go 1.23.0** as the production target for this release.
