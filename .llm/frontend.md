# Frontend Architecture

## Frontend responsibilities

The frontend owns almost all application behavior:

- store initialization
- folder and note state
- selection state
- sidebar and note-list projections
- create, rename, delete, recover, favorite, and permanent-delete flows
- IndexedDB persistence
- confirmation dialog orchestration

The frontend is not just presentation. It contains the domain model and most of the business logic.

## App startup flow

The app shell starts in [frontend/src/routes/+layout.svelte](/Users/dduraipandian/apps/mdnotes/frontend/src/routes/+layout.svelte).

On mount it initializes stores in this order:

1. `folderStore.init()`
2. `selectionStore.init()`
3. `notesStore.init()`

If initialization fails, the UI opens a blocking quit dialog through `uiStore` and calls Wails `Quit`.

This order matters because later stores depend on folder state existing first.

## Main state model

### `folderStore`

Defined in [frontend/src/lib/stores/folders.svelte.ts](/Users/dduraipandian/apps/mdnotes/frontend/src/lib/stores/folders.svelte.ts).

Owns:

- root folder order in `items`
- all folder records in a reactive `SvelteMap`
- rename state
- derived trash-root folder ids

Folder shape currently includes:

- `id`
- `title`
- `url`
- optional `profile`
- optional `isFavorite`
- optional `badge`
- optional child `items`
- optional `isOpen`
- optional `parentId`
- optional `deletedAt`

The store is seeded with system view folders built from `SYSTEM_VIEWS` in `profiles.ts`.

### `notesStore`

Defined in [frontend/src/lib/stores/notes.svelte.ts](/Users/dduraipandian/apps/mdnotes/frontend/src/lib/stores/notes.svelte.ts).

Owns:

- all note records in a reactive `SvelteMap`
- selected note id
- persistence to IndexedDB

Note shape currently includes:

- `id`
- `folderId`
- `title`
- `content`
- `updatedAt`
- optional `isFavorite`
- optional `deletedAt`

### `selectionStore`

Defined in [frontend/src/lib/stores/selection.svelte.ts](/Users/dduraipandian/apps/mdnotes/frontend/src/lib/stores/selection.svelte.ts).

Owns only selected folder state. It persists `selectedFolderID` to settings and resolves invalid folder ids to `null`.

### `uiStore`

Defined in [frontend/src/lib/stores/dialog.svelte.ts](/Users/dduraipandian/apps/mdnotes/frontend/src/lib/stores/dialog.svelte.ts).

Owns confirmation dialog state for:

- note actions
- folder actions
- app startup failure / quit flow

## Services layer

The services layer coordinates behavior across stores. Components usually call services, not stores directly, for mutations.

Defined in:

- [frontend/src/lib/stores/services/folderService.ts](/Users/dduraipandian/apps/mdnotes/frontend/src/lib/stores/services/folderService.ts)
- [frontend/src/lib/stores/services/noteService.ts](/Users/dduraipandian/apps/mdnotes/frontend/src/lib/stores/services/noteService.ts)
- [frontend/src/lib/stores/services/trashService.ts](/Users/dduraipandian/apps/mdnotes/frontend/src/lib/stores/services/trashService.ts)

### `FolderService`

Handles:

- folder creation
- folder selection
- rename and expand/collapse
- favorite toggling
- soft-delete cascades for folder subtrees
- choosing the next selected folder after deletion

### `NoteService`

Handles:

- note creation in the active context
- note updates
- note selection
- note favorite toggling
- note soft-delete
- choosing the next note after deletion
- querying notes for a folder/view

### `TrashService`

Handles:

- recovery of notes and folders
- ejection of restored items to root when parents are missing or deleted
- permanent deletion
- empty trash flow
- archival path calculation for backups

## Domain layer

### Folder profiles

Defined in [frontend/src/lib/stores/domain/profiles.ts](/Users/dduraipandian/apps/mdnotes/frontend/src/lib/stores/domain/profiles.ts).

Profiles control:

- whether an item belongs to the `views` or `folders` section
- whether it can expand children
- which operations are allowed
- how child folders are derived
- how visible notes are derived

Current profiles:

- `home`
- `favorites`
- `trash`
- `regular`
- `deleted`

`SYSTEM_VIEWS` is the canonical list and order of virtual sidebar items:

- `home`
- `favorites`
- `deleted-notes`

### Folder tree helper

Defined in [frontend/src/lib/stores/domain/folderTree.ts](/Users/dduraipandian/apps/mdnotes/frontend/src/lib/stores/domain/folderTree.ts).

Provides shared traversal logic:

- folder paths
- subtree collection
- subtree ids
- trash root ids
- favorite folder ids
- active selectable folder ids
- note resolution for folder or view contexts

This helper is heavily reused by services.

## UI projection layer

The project separates domain/storage state from UI-facing view models.

### Sidebar projection

Defined in [frontend/src/lib/views/folderSidebarView.svelte.ts](/Users/dduraipandian/apps/mdnotes/frontend/src/lib/views/folderSidebarView.svelte.ts).

Responsibilities:

- split sidebar into `views` and `folders` sections
- compute icons, note counts, capabilities, context menu items
- recursively build renderable tree nodes for the sidebar

Rendered by [frontend/src/lib/components/Folders.svelte](/Users/dduraipandian/apps/mdnotes/frontend/src/lib/components/Folders.svelte).

### Note list projection

Defined in [frontend/src/lib/views/noteListView.svelte.ts](/Users/dduraipandian/apps/mdnotes/frontend/src/lib/views/noteListView.svelte.ts).

Responsibilities:

- determine current folder title and profile
- compute whether note creation is allowed
- filter notes by search query
- group notes by date sections
- compute restore context strings

Rendered by [frontend/src/lib/components/NoteItems.svelte](/Users/dduraipandian/apps/mdnotes/frontend/src/lib/components/NoteItems.svelte).

## Persistence model

Persistence is implemented through IndexedDB wrappers:

- [frontend/src/lib/stores/idbr.ts](/Users/dduraipandian/apps/mdnotes/frontend/src/lib/stores/idbr.ts)
- [frontend/src/lib/stores/repositories.ts](/Users/dduraipandian/apps/mdnotes/frontend/src/lib/stores/repositories.ts)

Current object stores:

- `folders`
- `notes`
- `settings`
- `backups`

The frontend uses repository wrappers rather than calling `idb` directly from components.

## Deletion and recovery rules

The app uses soft delete, not immediate removal.

### Soft delete

- active items have `deletedAt == null`
- deleted items are marked with a numeric timestamp
- folders and child folders share a batch timestamp when deleted together
- notes in deleted folders are also soft-deleted

### Recovery

- folders restore by batch
- notes recover to their original folder if that folder is active
- notes recover to root/home if their original folder is missing or still deleted
- folders whose parents are missing or deleted are rooted during recovery

### Permanent delete

- permanent delete removes rows from `folders` and `notes`
- before removal, note data is archived to `backups`
- folder permanent delete is transactional across folders, notes, and backups

## Component boundaries

### Primary app components

- [frontend/src/lib/components/Folders.svelte](/Users/dduraipandian/apps/mdnotes/frontend/src/lib/components/Folders.svelte)
- [frontend/src/lib/components/NoteItems.svelte](/Users/dduraipandian/apps/mdnotes/frontend/src/lib/components/NoteItems.svelte)
- [frontend/src/routes/+page.svelte](/Users/dduraipandian/apps/mdnotes/frontend/src/routes/+page.svelte)

### Important rule of thumb

Components mostly render derived state and invoke services.

For behavior changes:

- update stores or services first
- then update view-model classes
- only then adjust components if the UI contract changes

## Styling

Global styling lives in [frontend/src/routes/layout.css](/Users/dduraipandian/apps/mdnotes/frontend/src/routes/layout.css).

Current styling facts:

- Tailwind CSS v4
- dark theme is hard-applied in `+layout.svelte`
- color tokens are defined as CSS custom properties
- `Inter Variable` is the main UI font
- `JetBrains Mono Variable` is mapped to the mono theme token

## Current frontend commands

Run from `frontend/`:

```bash
npm run dev
npm run build
npm run check
npm run test
npm run test:e2e
```

## Practical navigation advice

If you need to understand a bug or feature:

1. find the relevant component
2. find its view-model in `src/lib/views`
3. trace into the service being called
4. trace into the underlying store
5. verify expected behavior in unit/e2e tests
