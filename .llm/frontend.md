# Frontend Architecture

## Architectural Philosophy
The `mdnotes` frontend is a reactive, domain-driven application built on **Svelte 5**. It prioritizes a clean separation between **Data Persistence**, **Domain State**, **Business Logic**, and **UI Presentation**.

## 1. Domain Layer (Stores)
Stores are the "source of truth" for the application's state. In Svelte 5, these are implemented as classes using runes.

### `folderStore` (`folders.svelte.ts`)
- **State**: Reactive `SvelteMap` of folders.
- **Responsibility**: Manages the hierarchy and raw folder metadata.
- **Reactivity**: Uses `$state` for items and `$derived` for counts (optimized for O(1) where possible via manual bookkeeping).

### `notesStore` (`notes.svelte.ts`)
- **State**: Reactive `SvelteMap` of note metadata.
- **Responsibility**: Manages note metadata and selection.
- **Performance**: Note content is *not* stored here; it is fetched on-demand from IndexedDB to keep the store lightweight.
- **Dependency**: Uses **Setter-based Dependency Injection** to receive the `SearchService` and `NoteService` at runtime, avoiding circular top-level imports.
- **Trash Model**: Notes are soft-deleted via `deletedAt`/`deletedBatchId`, so any derived cache that exposes note visibility must react to soft-delete and restore transitions, not just hard removals.

## 2. Business Logic (Service Layer)
Services coordinate actions across multiple stores. Components should almost never mutate stores directly; they should invoke methods on services.

- **`FolderService`**: Handles complex folder operations like recursive deletions, path resolution for imports, and selection shift logic.
- **`NoteService`**: Manages note creation, soft-deletes, and harvesting data for bulk exports.
- **`TrashService`**: Orchestrates the restoration of items, ensuring they are "re-homed" to root if their original parents are missing.
- **`SearchService`**: Manages the `MiniSearch` index. It handles incremental indexing during note persistence and on-demand indexing for active folder trees.
- **Operational Rule**: Search results should always be treated as candidate IDs, then validated against canonical note state (`deletedAt`, folder scope, profile visibility) before rendering.

## 3. Projection Layer (View Models)
To keep Svelte components thin and focused on rendering, we use **View Model** classes (Projections). These classes subscribe to stores and "project" the data into a format optimized for specific UI components.

- **`FolderSidebarView`**: Prepares the renderable tree structure, icons, and context menu actions for the sidebar.
- **`NoteListView`**: Handles search filtering, date grouping, and status string construction for the middle pane.

## 4. Persistence Layer
We use IndexedDB for local-first storage, wrapped in repository patterns.
- **`idbr.ts`**: The core IndexedDB driver. It uses a `switch(oldVersion)` skeleton in the `upgrade` hook for robust future migrations.
- **Metadata vs. Content**:
    - `notes_meta`: Stores titles, folder IDs, and timestamps. Loaded on startup.
    - `notes_contents`: Stores the full markdown body. Loaded only when a note is opened or indexed.
- **Atomic Operations**: Deletion batches and cascades are grouped by unique UUIDs to ensure data integrity during bulk actions.

## 4.1 Backup & Import Reliability
- **Transactional Restore**: Backup imports restore folders, note metadata, note contents, and settings transactionally into IndexedDB before the app reloads.
- **Authoritative Export Source**: Backups are exported from repositories / IndexedDB-backed state, not from incidental UI-only state like `localStorage`.
- **User-visible Failure Paths**: Import/export flows are expected to surface actionable UI errors rather than console-only failures.
- **New-App Backup Guard**: Backup import is allowed only for a fresh app. If IndexedDB already contains user history or persisted note/folder data, the import must abort instead of replacing the existing library.
- **Markdown ZIP Rooting**: Markdown ZIP export/import is folder-aware. Export scopes to the selected real folder subtree and writes ZIP paths relative to that folder; import applies incoming paths relative to the selected real folder.
- **Markdown Asset Persistence**: Markdown ZIP flows support note images by exporting markdown files plus sidecar asset files, then restoring those files back into the `note_assets` store during import.

## 5. Reactivity Patterns (Svelte 5 Runes)
- **`$state.snapshot()`**: Used heavily before sending data to the Go backend or IndexedDB to strip reactive proxies.
- **`$effect.root`**: Used in utility modules like the **Menu Bridge** to create global observers that don't get destroyed by component unmounts.
- **`$derived.by`**: Utilized for complex computations in View Models to ensure caching and efficient re-evaluations.

## 5.1 Search-Specific Reactivity
- Search input is debounced in `NoteListView` by 150 ms to protect list rendering from per-keystroke recomputation.
- MiniSearch indexing is on-demand per folder subtree via `ensureFolderIndexed`.
- Soft-delete / restore flows must be treated as index mutations. The current implementation protects correctness in two layers: it removes or re-adds notes during trash lifecycle changes, and it filters final search results against canonical `deletedAt` state.

## 6. CSS & Design System
- **Framework**: Tailwind CSS v4.
- **Theming**: A CSS-variable-based system supporting dark/light modes.
- **Typography**: Optimized for a desktop experience using `Inter` for UI and `JetBrains Mono` for the editor.

## Component Contract
1.  **Script**: Component imports a View Model (e.g., `noteListView`) and the necessary services.
2.  **Logic**: Interaction calls a service (e.g., `noteService.createNote()`).
3.  **Markup**: Renders state provided by the View Model's reactive properties.

## Guidance for AI Agents
- **Circular Dependencies**: If you need a store in a service that is already used by that store, use a setter or a registry pattern in `services.ts`.
- **TDD Requirement**: New store/service logic **must** have a corresponding unit test in `tests/unit`.
- **Performance**: Always consider the impact of large note collections. Prefer O(1) or O(log n) lookups over O(n) array scans.
- **Search Bugs**: When debugging search, inspect three layers separately: note query visibility, MiniSearch document lifecycle, and final result filtering in `NoteListView` / `SearchService`. Do not assume the symptom comes from the index alone.
