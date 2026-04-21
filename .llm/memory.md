# Session Memory

## Checklist Execution Pattern

- The user is working through [CHECKLIST.md](/Users/dduraipandian/apps/keloc-notes/CHECKLIST.md) item by item and expects status to stay aligned with the actual codebase.
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
- **Incident Resolved**: We hit a real bug where soft-deleted notes could remain searchable inside a folder because MiniSearch and store visibility drifted apart. The implemented fix now updates the index during trash/restore flows and filters final search results against canonical `deletedAt` state.

## Architectural Stabilization

- **Circular Dependency Resolution**: Avoid top-level singleton imports between `NotesStore` and `SearchService`.
- **Pattern**: Use **Setter-based Dependency Injection** in `NotesStore`. The `SearchService` is initialized in a registry (like `services.ts`) and injected into the store post-initialization.
- **Wails v2 Alignment**: The project has reverted to **Wails v2** and **Go 1.23.0** for stability. Future backend work (menus/events) must adhere to the v2 API.

## Search and UI UX

- **Debounce**: Search recomputes 150ms after typing stops to keep the UI smooth with large note lists.
- **E2E Scoping**: When testing folder-scoped search, explicitly navigate to "Home" before creating new folders to ensure they are siblings (flat structure) rather than children (nested structure).
- **Debugging Rule**: If a user reports a search miss or ghost result on existing notes, do not assume edit-index lag. First distinguish whether the problem is stale indexing, subtree filtering, deleted-note leakage, or partial content loading.

## Persistence And Error Handling

- **Lazy Loading**: `notes_meta` (metadata) and `notes_contents` (body) are stored in separate IndexedDB stores.
- **Metadata first**: UI list operations should only ever touch metadata to maintain high performance. Content is fetched only for the active editor or search indexer.

## Deletion Model

- `deletedAt` is a timestamp only.
- `deletedBatchId` (UUID) is used for grouping cascade deletions and restorations. -耦合警告: `deletedAt` and `deletedBatchId` must be updated together in delete/restore paths.

## Native Menu Reactivity (Wails v2 + Svelte 5)

- **Problem**: `File > Export > Current Note` stayed disabled because `$effect.root` inside the `menuBridge` utility module failed to re-track dependencies (getters) after the initial run.
- **Fix**: Implemented a nested `$effect` within the `$effect.root` block in `menuBridge.svelte.ts`.
- **Pattern**:
  ```ts
  $effect.root(() => {
    return $effect(() => {
      const noteId = notesStore.selectedNoteID; // Explicit access for tracking
      // update logic...
    });
  });
  ```
- **Lifecycle Management**: Utilities using `$effect.root` (like the `menuBridge`) must **return** the root's cleanup function. This allows the host component (`+layout.svelte`) to properly destroy the observer during unmount, preventing "background leakages" or effect accumulation that can cause stale data processing.
- **Testing Stability**: Always use `$lib` imports in unit tests for stores and services. Using relative paths (e.g., `../../src/lib/stores/...`) alongside `$lib` can cause Vitest to resolve two separate instances of the same singleton, leading to "identity mismatch" bugs where the test updates one copy but the code is watching another.

## Bulk Data Integrity (Import/Export)

- **Export Harvesting**: Implemented chunked harvesting (50 notes per batch) in `NoteService.getExportData`. This prevents memory pressure during large exports and ensures that metadata is correctly merged with content from IndexedDB.
- **Delegated Mapping**: Encapsulated Markdown DTO formatting within `NoteService.getNotesForExport`. This includes clean path resolution (no IDs in paths) via `FolderTreeHelper.getPlainFolderPath`.
- **Recursive Path Resolution**: Implemented `FolderService.ensurePath(path: string)`, which recursively finds or creates a nested folder structure for imports.
- **Import Efficiency**: Implemented a `silent` creation mode in `FolderService` and `NoteService`. During bulk imports, we bypass global selection updates (`selectionStore`) for every note/folder created. This eliminates "UI selection churn" and significantly improves performance.
- **ID Resolution**: Standardized on extracting the `.id` property from newly created Note objects before passing them to `noteService.update`, resolving a common type-mismatch bug where full objects were passed to the backend-style internal services.
- **Markdown ZIP Scope Rule**: Markdown archive export/import is now relative to the currently selected real folder. Export includes only the selected folder subtree, and import roots incoming archive paths under that selected folder. Root export/import still works; virtual views should not be treated as archive roots.
- **Markdown Conflict Resolution**: Archive import no longer writes immediately when filename/path conflicts exist. The menu flow first analyzes conflicts, opens an explicit confirmation dialog, and lets the user choose `overwrite` or `keep both` before any note mutations occur.
- **Markdown Asset Round-Trip**: Markdown ZIP export rewrites editor `asset:<uuid>` image references into note-local sidecar folders like `Note Title.assets/...` and includes the binary image files in the archive. Import reads those referenced files back, persists them into `note_assets`, and rewrites imported content back into editor JSON image nodes.
- **Trustworthiness Work Completed**:
  - Export now reads from repositories / IndexedDB-backed state, not `localStorage`.
  - Import restores notes, folders, note contents, and settings transactionally before reload.
  - Menu-driven import/export failures are surfaced to the user rather than logged silently.
  - Backup import is intentionally restricted to a brand-new app. Existing or previously used libraries must reject backup import rather than overwrite in place.

## macOS Native Text Editing (Undo/Copy/Paste/Select All)

- **Resolution**: Native macOS text editing functionality (Select All, Copy, Paste, Undo) has been restored by using Wails v2 **native roles** in `menu_darwin.go`.
- **Implementation**:
  - The Edit menu must use `menu.EditMenu()` (Role 2) and the Window menu must use `menu.WindowMenu()` (Role 3).
  - On macOS, when a menu item has these roles, Wails tells the native AppKit layer to handle the menu in a standard way. This allows the OS to route shortcuts directly to the `WKWebView`'s first responder (the focused textarea) without Go-side interception.
- **Limitation**: The native `EditMenuRole` provides a hardcoded list of standard items that cannot be easily extended in Wails v2. Consequently, the **Find** command (Cmd+F) was relocated to the **View** menu to maintain its functionality without breaking the native Edit shortcuts.
- **Stable Platform**: Reconfirmed **Wails v2** and **Go 1.23.0** as the production target for this release.

## Native Menu Completion

- `Native menu completeness` is completed in the roadmap and reflected in `CHECKLIST.md`.
- Implemented macOS menu actions now include:
  - `Close Window`
  - `Enter Full Screen`
  - `keloc-notes Help`
  - `Report a Bug`
- When auditing release-readiness items, check the actual menu handlers in Go, not just the checklist state.
