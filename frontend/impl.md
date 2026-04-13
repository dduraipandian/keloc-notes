# Architecture Refactoring — Detailed Implementation Plan

> **Audience:** Junior engineers or AI coding assistants (Haiku / Gemini Flash).
> Every step includes exact file paths, before/after code, and test cases.
> Run `cd /Users/dduraipandian/apps/mdnotes/frontend && npm run test` after each phase to verify.

---

## Phase 1: Add `icon` to `SidebarSourceItem`, Remove Redundant Booleans

**Goal:** Replace `isTrashRoot` and `isTrashTree` booleans with `kind` and `type` fields that already carry the same information. Add an `icon` property so the UI doesn't need to compute which icon to render.

**Depends on:** Nothing (can start immediately)

### Task 1.1 — Update `SidebarSourceItem` type

- [ ] **File:** `src/lib/stores/selectors.ts`
- [ ] **Action:** Modify the `SidebarSourceItem` type

**Before** (lines 38–60):

```typescript
export type SidebarSourceItem = {
	id: FolderID;
	item: FolderItem;
	kind: FolderKinds;
	type: FolderTypes;
	title: string;
	depth: number;
	isTrashTree: boolean;
	isTrashRoot: boolean;
	isSelected: boolean;
	isEditing: boolean;
	isOpen: boolean;
	noteCount: number;
	children: SidebarSourceItem[];
	capabilities: {
		create: boolean;
		rename: boolean;
		delete: boolean;
		recover: boolean;
		permanentDelete: boolean;
		emptyTrash: boolean;
	};
};
```

**After:**

```typescript
export type FolderIcon = 'folder' | 'star' | 'trash';

export type SidebarSourceItem = {
	id: FolderID;
	item: FolderItem;
	kind: FolderKinds;
	type: FolderTypes;
	icon: FolderIcon;
	title: string;
	depth: number;
	isSelected: boolean;
	isEditing: boolean;
	isOpen: boolean;
	noteCount: number;
	children: SidebarSourceItem[];
	capabilities: {
		create: boolean;
		rename: boolean;
		delete: boolean;
		recover: boolean;
		permanentDelete: boolean;
		emptyTrash: boolean;
	};
};
```

**Changes:** Added `icon: FolderIcon`. Removed `isTrashTree` and `isTrashRoot`.

---

### Task 1.2 — Update `buildSource()` method

- [ ] **File:** `src/lib/stores/selectors.ts`
- [ ] **Action:** Modify the `buildSource()` method in `FolderSidebarSelector`

**Before** (lines 189–230):

```typescript
private buildSource(item: FolderItem, depth: number, isTrashTree = false): SidebarSourceItem {
    const isTrashRoot = item.type === 'trash';
    const isFavoritesRoot = item.id === 'favorites';
    const childIds = isTrashRoot
        ? this.folderQueries.getTrashRootIds()
        : isFavoritesRoot
            ? this.folderQueries.getFavoriteFolderIds()
            : item.items || [];
    const visibleChildIds =
        isTrashRoot || isFavoritesRoot || !isTrashTree
            ? childIds.filter((id) => isTrashRoot || this.folders.folders.get(id)?.deletedAt == null)
            : [];

    return {
        id: item.id,
        item,
        kind: isTrashRoot ? 'trash' : isFavoritesRoot ? 'favorites' : 'regular',
        type: isTrashRoot ? 'view' : isFavoritesRoot ? 'view' : 'regular',
        title: item.title,
        depth,
        isTrashTree,
        isTrashRoot,
        isSelected: this.selection.selectedFolderID === item.id,
        isEditing: this.folders.editingId === item.id,
        isOpen: item.isOpen ?? false,
        noteCount: this.noteQueries.getNoteCountForFolder(item.id, item.type),
        children: visibleChildIds
            .map((id) => this.folders.folders.get(id))
            .filter((child): child is FolderItem => !!child)
            .map((child) => this.buildSource(child, depth + 1, isTrashTree || isTrashRoot)),
        capabilities: {
            create: item.deletedAt == null && item.type !== 'system',
            rename:
                item.deletedAt == null && !isTrashTree && item.type !== 'system' && item.type !== 'trash',
            delete:
                item.deletedAt == null && !isTrashTree && item.type !== 'system' && item.type !== 'trash',
            recover: item.deletedAt != null,
            permanentDelete: item.deletedAt != null,
            emptyTrash: isTrashTree && item.deletedAt == null
        }
    };
}
```

**After:**

```typescript
private buildSource(item: FolderItem, depth: number, isViewTree = false): SidebarSourceItem {
    const kind: FolderKinds = item.type === 'trash' ? 'trash'
        : item.id === 'favorites' ? 'favorites'
        : 'regular';
    const type: FolderTypes = kind === 'trash' || kind === 'favorites' ? 'view' : 'regular';
    const icon: FolderIcon = kind === 'trash' ? 'trash'
        : kind === 'favorites' ? 'star'
        : 'folder';

    const childIds = kind === 'trash'
        ? this.folderQueries.getTrashRootIds()
        : kind === 'favorites'
            ? this.folderQueries.getFavoriteFolderIds()
            : item.items || [];

    const visibleChildIds =
        kind === 'trash' || kind === 'favorites' || !isViewTree
            ? childIds.filter((id) => kind === 'trash' || this.folders.folders.get(id)?.deletedAt == null)
            : [];

    return {
        id: item.id,
        item,
        kind,
        type,
        icon,
        title: item.title,
        depth,
        isSelected: this.selection.selectedFolderID === item.id,
        isEditing: this.folders.editingId === item.id,
        isOpen: item.isOpen ?? false,
        noteCount: this.noteQueries.getNoteCountForFolder(item.id, item.type),
        children: visibleChildIds
            .map((id) => this.folders.folders.get(id))
            .filter((child): child is FolderItem => !!child)
            .map((child) => this.buildSource(child, depth + 1, isViewTree || type === 'view')),
        capabilities: {
            create: item.deletedAt == null && item.type !== 'system',
            rename:
                item.deletedAt == null && !isViewTree && item.type !== 'system' && item.type !== 'trash',
            delete:
                item.deletedAt == null && !isViewTree && item.type !== 'system' && item.type !== 'trash',
            recover: item.deletedAt != null,
            permanentDelete: item.deletedAt != null,
            emptyTrash: isViewTree && item.deletedAt == null
        }
    };
}
```

**Key changes:**

- Replaced `isTrashRoot` / `isFavoritesRoot` local variables with `kind` derivation
- Renamed parameter `isTrashTree` → `isViewTree`
- Added `icon` field
- Removed `isTrashTree` and `isTrashRoot` from the returned object
- Recursive call uses `isViewTree || type === 'view'` instead of `isTrashTree || isTrashRoot`

---

### Task 1.3 — Update `getSections()` to pass `isViewTree`

- [ ] **File:** `src/lib/stores/selectors.ts`
- [ ] **Action:** Rename the argument in `getSections()`

**Before** (line 185):

```typescript
sources: entry.getRoots(this).map((item) => this.buildSource(item, 0, entry.id === 'views'))
```

**After** (no change needed — the parameter name changed in the method signature but the call site passes the same boolean):

```typescript
sources: entry.getRoots(this).map((item) => this.buildSource(item, 0, entry.id === 'views'))
```

This line stays the same. The `entry.id === 'views'` maps to the renamed `isViewTree` parameter.

---

### Task 1.4 — Update `Folders.svelte` to use `source.icon` and `source.kind`

- [ ] **File:** `src/lib/components/Folders.svelte`
- [ ] **Action:** Replace all `source.isTrashRoot` checks with `source.kind === 'trash'`

**Change 1 — `MenuItemSnippet` icon block** (lines 122–128):

**Before:**

```svelte
{#if source.isTrashRoot}
	<Trash2 size={16} class="text-destructive/70" />
{:else if source.kind === 'favorites'}
	<Star size={16} class="fill-[#e0b64b] text-[#e0b64b]" />
{:else}
	<Folder size={16} style="color: {folderColor}" class="opacity-80" />
{/if}
```

**After:**

```svelte
{#if source.icon === 'trash'}
	<Trash2 size={16} class="text-destructive/70" />
{:else if source.icon === 'star'}
	<Star size={16} class="fill-[#e0b64b] text-[#e0b64b]" />
{:else}
	<Folder size={16} style="color: {folderColor}" class="opacity-80" />
{/if}
```

**Change 2 — `MenuItemNoChildSnippet` icon block** (lines 244–250):

**Before:**

```svelte
{#if source.isTrashRoot}
	<Trash2 size={16} class="text-destructive/70" />
{:else if source.kind === 'favorites'}
	<Star size={16} class="fill-[#e0b64b] text-[#e0b64b]" />
{:else}
	<Folder size={16} style="color: {folderColor}" class="opacity-80" />
{/if}
```

**After:**

```svelte
{#if source.icon === 'trash'}
	<Trash2 size={16} class="text-destructive/70" />
{:else if source.icon === 'star'}
	<Star size={16} class="fill-[#e0b64b] text-[#e0b64b]" />
{:else}
	<Folder size={16} style="color: {folderColor}" class="opacity-80" />
{/if}
```

---

### Task 1.5 — Update existing unit tests

- [ ] **File:** `tests/unit/selectors.test.ts`
- [ ] **Action:** Remove `isTrashRoot` / `isTrashTree` assertions, add `icon` and `type` assertions

**Test 1 — "should expose root folder sources"** (line 88–97):

**Before:**

```typescript
expect(selector.getSections().find((section) => section.id === 'folders')?.sources).toEqual([
    expect.objectContaining({
        id: 'notes',
        kind: 'folder',
        title: 'Notes',
        isSelected: true,
        noteCount: 3,
        capabilities: expect.objectContaining({ create: true, rename: true, delete: true })
    })
]);
```

**After:**

```typescript
expect(selector.getSections().find((section) => section.id === 'folders')?.sources).toEqual([
    expect.objectContaining({
        id: 'notes',
        kind: 'regular',
        type: 'regular',
        icon: 'folder',
        title: 'Notes',
        isSelected: true,
        noteCount: 3,
        capabilities: expect.objectContaining({ create: true, rename: true, delete: true })
    })
]);
```

**Test 2 — "should expose header sources for trash"** (line 117–128):

**Before:**

```typescript
expect(selector.getSections().find((section) => section.id === 'views')?.sources).toEqual(
    expect.arrayContaining([
        expect.objectContaining({
            id: 'deleted-notes',
            kind: 'trash',
            isTrashRoot: true,
            isSelected: true,
            children: [expect.objectContaining({ id: 'deleted-folder', isTrashTree: true })],
            capabilities: expect.objectContaining({ emptyTrash: true })
        })
    ])
);
```

**After:**

```typescript
expect(selector.getSections().find((section) => section.id === 'views')?.sources).toEqual(
    expect.arrayContaining([
        expect.objectContaining({
            id: 'deleted-notes',
            kind: 'trash',
            type: 'view',
            icon: 'trash',
            isSelected: true,
            children: [expect.objectContaining({ id: 'deleted-folder', kind: 'regular', type: 'regular', icon: 'folder' })],
            capabilities: expect.objectContaining({ emptyTrash: true })
        })
    ])
);
```

**Test 3 — "should expose favorites as a virtual view"** (line 250–257):

**Before:**

```typescript
expect(favorites).toEqual(
    expect.objectContaining({
        kind: 'favorites',
        isSelected: true,
        noteCount: 2,
        children: [expect.objectContaining({ id: 'work', kind: 'folder' })]
    })
);
```

**After:**

```typescript
expect(favorites).toEqual(
    expect.objectContaining({
        kind: 'favorites',
        type: 'view',
        icon: 'star',
        isSelected: true,
        noteCount: 2,
        children: [expect.objectContaining({ id: 'work', kind: 'regular', icon: 'folder' })]
    })
);
```

---

### Task 1.6 — Add new unit tests for `icon` property

- [ ] **File:** `tests/unit/selectors.test.ts`
- [ ] **Action:** Add these tests inside the `FolderSidebarSelector` describe block

```typescript
it('should set icon to "folder" for regular folders', () => {
    const selector = new FolderSidebarSelector(
        {
            items: ['work'],
            folders: new Map([['work', { id: 'work', title: 'Work', url: '#' }]])
        } as any,
        { getFavoriteFolderIds: vi.fn().mockReturnValue([]) } as any,
        { getNoteCountForFolder: vi.fn().mockReturnValue(0) } as any,
        { selectedFolderID: null, getSelectedFolder: vi.fn() } as any
    );

    const source = selector.getSections().find((s) => s.id === 'folders')?.sources[0];
    expect(source?.icon).toBe('folder');
    expect(source?.kind).toBe('regular');
    expect(source?.type).toBe('regular');
});

it('should set icon to "trash" for the trash root', () => {
    const selector = new FolderSidebarSelector(
        {
            folders: new Map([
                ['favorites', { id: 'favorites', title: 'Favorites', url: '#', type: 'system' }],
                ['deleted-notes', { id: 'deleted-notes', title: 'Trash', url: '#', type: 'trash' }]
            ])
        } as any,
        {
            getTrashRootIds: vi.fn().mockReturnValue([]),
            getFavoriteFolderIds: vi.fn().mockReturnValue([])
        } as any,
        { getNoteCountForFolder: vi.fn().mockReturnValue(0) } as any,
        { selectedFolderID: null, getSelectedFolder: vi.fn() } as any
    );

    const trashSource = selector
        .getSections()
        .find((s) => s.id === 'views')
        ?.sources.find((s) => s.id === 'deleted-notes');
    expect(trashSource?.icon).toBe('trash');
    expect(trashSource?.kind).toBe('trash');
    expect(trashSource?.type).toBe('view');
});

it('should set icon to "star" for the favorites root', () => {
    const selector = new FolderSidebarSelector(
        {
            folders: new Map([
                ['favorites', { id: 'favorites', title: 'Favorites', url: '#', type: 'system' }],
                ['deleted-notes', { id: 'deleted-notes', title: 'Trash', url: '#', type: 'trash' }]
            ])
        } as any,
        {
            getTrashRootIds: vi.fn().mockReturnValue([]),
            getFavoriteFolderIds: vi.fn().mockReturnValue([])
        } as any,
        { getNoteCountForFolder: vi.fn().mockReturnValue(0) } as any,
        { selectedFolderID: null, getSelectedFolder: vi.fn() } as any
    );

    const favSource = selector
        .getSections()
        .find((s) => s.id === 'views')
        ?.sources.find((s) => s.id === 'favorites');
    expect(favSource?.icon).toBe('star');
    expect(favSource?.kind).toBe('favorites');
    expect(favSource?.type).toBe('view');
});
```

### Task 1.7 — Verify

- [ ] Run: `cd /Users/dduraipandian/apps/mdnotes/frontend && npm run test`
- [ ] All tests pass
- [ ] Run: `cd /Users/dduraipandian/apps/mdnotes/frontend && npm run check`
- [ ] No TypeScript errors

---

## Phase 2: Pre-compute Context Menu Items in the View

**Goal:** Move the context menu decision logic from `Folders.svelte` into `selectors.ts` so the template becomes a flat loop. This eliminates the 3-level nested `if/else` in `ContextMenuContentSnippet`.

**Depends on:** Phase 1

### Task 2.1 — Define `ContextMenuItem` type

- [ ] **File:** `src/lib/stores/selectors.ts`
- [ ] **Action:** Add the type after the existing type definitions (after line ~9)

```typescript
export type ContextMenuItemVariant = 'default' | 'destructive';

export type ContextMenuItem = {
	label: string;
	action: () => void;
	variant: ContextMenuItemVariant;
	separatorAfter: boolean;
};
```

---

### Task 2.2 — Add `contextMenuItems` to `SidebarSourceItem`

- [ ] **File:** `src/lib/stores/selectors.ts`
- [ ] **Action:** Add the field to the `SidebarSourceItem` type

**Add after the `capabilities` field:**

```typescript
export type SidebarSourceItem = {
	// ... existing fields ...
	capabilities: { /* ... */ };
	contextMenuItems: ContextMenuItem[];
};
```

---

### Task 2.3 — Add `buildContextMenuItems()` method and service dependencies

- [ ] **File:** `src/lib/stores/selectors.ts`
- [ ] **Action:** The `FolderSidebarSelector` needs access to `folderService`, `trashService`, and `uiStore` to build action callbacks. Add them as constructor dependencies.

**Update the constructor:**

**Before:**

```typescript
constructor(
    private readonly folders: FolderStoreLike = folderStore,
    private readonly folderQueries: FolderServiceLike = folderService,
    private readonly noteQueries: NoteServiceLike = noteService,
    private readonly selection: SelectionStoreLike = selectionStore
) {}
```

**After:**

```typescript
constructor(
    private readonly folders: FolderStoreLike = folderStore,
    private readonly folderQueries: FolderServiceLike = folderService,
    private readonly noteQueries: NoteServiceLike = noteService,
    private readonly selection: SelectionStoreLike = selectionStore,
    private readonly actions: SidebarActionDeps = defaultSidebarActionDeps
) {}
```

**Add the action dependency type and default (near the top of the file, after imports):**

```typescript
import { uiStore } from '$lib/stores/dialog.svelte';

type SidebarActionDeps = {
	folderCreate: () => void;
	folderStartRename: (id: FolderID) => void;
	folderDelete: (id: FolderID) => void;
	folderSetFavorite: (id: FolderID, isFav: boolean) => void;
	trashRecover: (id: FolderID) => void;
	trashPermanentDelete: (title: string, id: FolderID) => void;
	trashEmpty: () => void;
};

const defaultSidebarActionDeps: SidebarActionDeps = {
	folderCreate: () => folderService.create(),
	folderStartRename: (id) => folderService.startRename(id),
	folderDelete: (id) => uiStore.confirmFolderDelete(
		folderStore.folders.get(id)?.title ?? '',
		() => folderService.delete(id)
	),
	folderSetFavorite: (id, isFav) => folderService.setFavorite(id, isFav),
	trashRecover: (id) => trashService.recoverFolder(id),
	trashPermanentDelete: (title, id) => uiStore.confirmFolderPermanentDelete(
		title,
		() => trashService.permanentlyDeleteFolder(id)
	),
	trashEmpty: () => uiStore.confirmEmptyTrash(() => trashService.empty())
};
```

> [!IMPORTANT]
> Also add `import { trashService } from './services';` at the top if not already imported.

---

### Task 2.4 — Implement `buildContextMenuItems()` method

- [ ] **File:** `src/lib/stores/selectors.ts`
- [ ] **Action:** Add this private method to `FolderSidebarSelector`

```typescript
private buildContextMenuItems(
    item: FolderItem,
    capabilities: SidebarSourceItem['capabilities'],
    kind: FolderKinds
): ContextMenuItem[] {
    const items: ContextMenuItem[] = [];

    if (capabilities.recover) {
        items.push({
            label: 'Recover Folder',
            action: () => this.actions.trashRecover(item.id),
            variant: 'default',
            separatorAfter: true
        });
        items.push({
            label: 'Delete Permanently',
            action: () => this.actions.trashPermanentDelete(item.title, item.id),
            variant: 'destructive',
            separatorAfter: false
        });
        return items;
    }

    if (capabilities.emptyTrash) {
        items.push({
            label: 'Empty Trash',
            action: () => this.actions.trashEmpty(),
            variant: 'destructive',
            separatorAfter: false
        });
        return items;
    }

    if (capabilities.create) {
        items.push({
            label: 'New Folder',
            action: () => this.actions.folderCreate(),
            variant: 'default',
            separatorAfter: false
        });
    }

    if (item.type !== 'system' && item.type !== 'trash') {
        items.push({
            label: item.isFavorite ? 'Remove From Favorites' : 'Add To Favorites',
            action: () => this.actions.folderSetFavorite(item.id, item.isFavorite !== true),
            variant: 'default',
            separatorAfter: false
        });
    }

    if (capabilities.rename) {
        items.push({
            label: 'Rename',
            action: () => this.actions.folderStartRename(item.id),
            variant: 'default',
            separatorAfter: false
        });
    }

    if (capabilities.delete) {
        // The item before "Delete" gets a separator after it
        if (items.length > 0) {
            items[items.length - 1].separatorAfter = true;
        }
        items.push({
            label: 'Delete',
            action: () => this.actions.folderDelete(item.id),
            variant: 'destructive',
            separatorAfter: false
        });
    }

    return items;
}
```

---

### Task 2.5 — Wire `contextMenuItems` into `buildSource()`

- [ ] **File:** `src/lib/stores/selectors.ts`
- [ ] **Action:** In the `buildSource()` method, compute capabilities first, then pass to `buildContextMenuItems()`

In the return statement of `buildSource()`, add after `capabilities`:

```typescript
return {
    // ... existing fields ...
    capabilities: {
        create: item.deletedAt == null && item.type !== 'system',
        rename: item.deletedAt == null && !isViewTree && item.type !== 'system' && item.type !== 'trash',
        delete: item.deletedAt == null && !isViewTree && item.type !== 'system' && item.type !== 'trash',
        recover: item.deletedAt != null,
        permanentDelete: item.deletedAt != null,
        emptyTrash: isViewTree && item.deletedAt == null
    },
    get contextMenuItems() {
        // Note: we use a getter so we can reference `capabilities` from the same object
        // This is a slight workaround; alternatively compute capabilities as a local variable first
        return [];  // Will be replaced below
    }
};
```

**Better approach** — compute capabilities as a local variable:

```typescript
private buildSource(item: FolderItem, depth: number, isViewTree = false): SidebarSourceItem {
    const kind: FolderKinds = /* ... as before ... */;
    const type: FolderTypes = /* ... as before ... */;
    const icon: FolderIcon = /* ... as before ... */;
    // ... childIds, visibleChildIds as before ...

    const capabilities = {
        create: item.deletedAt == null && item.type !== 'system',
        rename: item.deletedAt == null && !isViewTree && item.type !== 'system' && item.type !== 'trash',
        delete: item.deletedAt == null && !isViewTree && item.type !== 'system' && item.type !== 'trash',
        recover: item.deletedAt != null,
        permanentDelete: item.deletedAt != null,
        emptyTrash: isViewTree && item.deletedAt == null
    };

    return {
        id: item.id,
        item,
        kind,
        type,
        icon,
        title: item.title,
        depth,
        isSelected: this.selection.selectedFolderID === item.id,
        isEditing: this.folders.editingId === item.id,
        isOpen: item.isOpen ?? false,
        noteCount: this.noteQueries.getNoteCountForFolder(item.id, item.type),
        children: visibleChildIds
            .map((id) => this.folders.folders.get(id))
            .filter((child): child is FolderItem => !!child)
            .map((child) => this.buildSource(child, depth + 1, isViewTree || type === 'view')),
        capabilities,
        contextMenuItems: this.buildContextMenuItems(item, capabilities, kind)
    };
}
```

---

### Task 2.6 — Simplify `ContextMenuContentSnippet` in `Folders.svelte`

- [ ] **File:** `src/lib/components/Folders.svelte`
- [ ] **Action:** Replace the entire `ContextMenuContentSnippet` snippet

**Before** (lines 173–224):

```svelte
{#snippet ContextMenuContentSnippet(source: SidebarSourceItem)}
	{@const item = source.item}
	<ContextMenu.Content class="w-36">
		{#if source.capabilities.recover}
			<ContextMenu.Item class="text-[13px]" onSelect={() => trashService.recoverFolder(item.id)}
				>Recover Folder</ContextMenu.Item
			>
			<ContextMenu.Separator />
			<ContextMenu.Item
				class="text-[13px] text-destructive focus:text-destructive"
				onSelect={() =>
					uiStore.confirmFolderPermanentDelete(item.title, () =>
						trashService.permanentlyDeleteFolder(item.id)
					)}>Delete Permanently</ContextMenu.Item
			>
		{:else if source.capabilities.emptyTrash}
			<ContextMenu.Item
				class="text-[13px] text-destructive focus:text-destructive"
				onSelect={() => uiStore.confirmEmptyTrash(() => trashService.empty())}
				>Empty Trash</ContextMenu.Item
			>
		{:else}
			{#if source.capabilities.create}
				<ContextMenu.Item class="text-[13px]" onSelect={() => folderService.create()}
					>New Folder</ContextMenu.Item
				>
			{/if}
			{#if item.type !== 'system' && item.type !== 'trash'}
				<ContextMenu.Item
					class="text-[13px]"
					onSelect={() => folderService.setFavorite(item.id, item.isFavorite !== true)}
				>
					{item.isFavorite ? 'Remove From Favorites' : 'Add To Favorites'}
				</ContextMenu.Item>
			{/if}
			{#if source.capabilities.rename}
				<ContextMenu.Item class="text-[13px]" onSelect={() => folderService.startRename(item.id)}
					>Rename</ContextMenu.Item
				>
			{/if}
			{#if source.capabilities.delete}
				<ContextMenu.Separator />
				<ContextMenu.Item
					class="text-[13px] text-destructive focus:text-destructive"
					onSelect={() =>
						uiStore.confirmFolderDelete(item.title, () => folderService.delete(item.id))}
					>Delete</ContextMenu.Item
				>
			{/if}
		{/if}
	</ContextMenu.Content>
{/snippet}
```

**After:**

```svelte
{#snippet ContextMenuContentSnippet(source: SidebarSourceItem)}
	<ContextMenu.Content class="w-36">
		{#each source.contextMenuItems as menuItem}
			<ContextMenu.Item
				class={[
					'text-[13px]',
					menuItem.variant === 'destructive' && 'text-destructive focus:text-destructive'
				]}
				onSelect={menuItem.action}
			>{menuItem.label}</ContextMenu.Item>
			{#if menuItem.separatorAfter}
				<ContextMenu.Separator />
			{/if}
		{/each}
	</ContextMenu.Content>
{/snippet}
```

**Also remove these imports from the `<script>` section if they are no longer used elsewhere in the component:**

- `uiStore` — check if it's still used. In this file, it **is still used** in `ContextMenuContentSnippet` but that code is now removed. Check if any other snippet uses it. Looking at the code: `uiStore` is not used anywhere else in `Folders.svelte`. **Remove the import.**
- `trashService` — same check. `trashService` is no longer used in the template. **Remove the import.**

**Before imports:**

```typescript
import { uiStore } from '$lib/stores/dialog.svelte';
import { folderSidebarSelector, type SidebarSourceItem } from '$lib/stores/selectors';
import { folderService, trashService } from '$lib/stores/services';
```

**After imports:**

```typescript
import { folderSidebarSelector, type SidebarSourceItem } from '$lib/stores/selectors';
import { folderService } from '$lib/stores/services';
```

> [!WARNING]
> `folderService` is still needed for `handleRenameKeyDown`, `folderService.create()` in the footer, `folderService.select()`, `folderService.toggle()`, and `folderService.rename()`. Do NOT remove it.

---

### Task 2.7 — Add unit tests for `buildContextMenuItems`

- [ ] **File:** `tests/unit/selectors.test.ts`
- [ ] **Action:** Add these tests inside the `FolderSidebarSelector` describe block

```typescript
it('should generate recover + permanent delete menu items for deleted folders', () => {
    const mockActions = {
        trashRecover: vi.fn(),
        trashPermanentDelete: vi.fn(),
        trashEmpty: vi.fn(),
        folderCreate: vi.fn(),
        folderStartRename: vi.fn(),
        folderDelete: vi.fn(),
        folderSetFavorite: vi.fn()
    };
    const selector = new FolderSidebarSelector(
        {
            folders: new Map([
                ['favorites', { id: 'favorites', title: 'Favorites', url: '#', type: 'system' }],
                ['deleted-notes', { id: 'deleted-notes', title: 'Trash', url: '#', type: 'trash' }],
                ['deleted-f', { id: 'deleted-f', title: 'Old', url: '#', deletedAt: 100 }]
            ])
        } as any,
        {
            getTrashRootIds: vi.fn().mockReturnValue(['deleted-f']),
            getFavoriteFolderIds: vi.fn().mockReturnValue([])
        } as any,
        { getNoteCountForFolder: vi.fn().mockReturnValue(0) } as any,
        { selectedFolderID: null, getSelectedFolder: vi.fn() } as any,
        mockActions
    );

    const deletedFolder = selector
        .getSections()
        .find((s) => s.id === 'views')
        ?.sources.find((s) => s.id === 'deleted-notes')?.children[0];

    expect(deletedFolder?.contextMenuItems).toHaveLength(2);
    expect(deletedFolder?.contextMenuItems[0].label).toBe('Recover Folder');
    expect(deletedFolder?.contextMenuItems[0].variant).toBe('default');
    expect(deletedFolder?.contextMenuItems[0].separatorAfter).toBe(true);
    expect(deletedFolder?.contextMenuItems[1].label).toBe('Delete Permanently');
    expect(deletedFolder?.contextMenuItems[1].variant).toBe('destructive');

    // Execute actions to verify wiring
    deletedFolder?.contextMenuItems[0].action();
    expect(mockActions.trashRecover).toHaveBeenCalledWith('deleted-f');
});

it('should generate empty trash menu item for the trash root', () => {
    const mockActions = {
        trashRecover: vi.fn(),
        trashPermanentDelete: vi.fn(),
        trashEmpty: vi.fn(),
        folderCreate: vi.fn(),
        folderStartRename: vi.fn(),
        folderDelete: vi.fn(),
        folderSetFavorite: vi.fn()
    };
    const selector = new FolderSidebarSelector(
        {
            folders: new Map([
                ['favorites', { id: 'favorites', title: 'Favorites', url: '#', type: 'system' }],
                ['deleted-notes', { id: 'deleted-notes', title: 'Trash', url: '#', type: 'trash' }]
            ])
        } as any,
        {
            getTrashRootIds: vi.fn().mockReturnValue([]),
            getFavoriteFolderIds: vi.fn().mockReturnValue([])
        } as any,
        { getNoteCountForFolder: vi.fn().mockReturnValue(0) } as any,
        { selectedFolderID: null, getSelectedFolder: vi.fn() } as any,
        mockActions
    );

    const trashRoot = selector
        .getSections()
        .find((s) => s.id === 'views')
        ?.sources.find((s) => s.id === 'deleted-notes');

    expect(trashRoot?.contextMenuItems).toHaveLength(1);
    expect(trashRoot?.contextMenuItems[0].label).toBe('Empty Trash');
    expect(trashRoot?.contextMenuItems[0].variant).toBe('destructive');

    trashRoot?.contextMenuItems[0].action();
    expect(mockActions.trashEmpty).toHaveBeenCalled();
});

it('should generate create, favorite, rename, delete menu items for regular folders', () => {
    const mockActions = {
        trashRecover: vi.fn(),
        trashPermanentDelete: vi.fn(),
        trashEmpty: vi.fn(),
        folderCreate: vi.fn(),
        folderStartRename: vi.fn(),
        folderDelete: vi.fn(),
        folderSetFavorite: vi.fn()
    };
    const selector = new FolderSidebarSelector(
        {
            items: ['work'],
            folders: new Map([
                ['work', { id: 'work', title: 'Work', url: '#', isFavorite: false }]
            ])
        } as any,
        { getFavoriteFolderIds: vi.fn().mockReturnValue([]) } as any,
        { getNoteCountForFolder: vi.fn().mockReturnValue(0) } as any,
        { selectedFolderID: null, getSelectedFolder: vi.fn() } as any,
        mockActions
    );

    const folder = selector
        .getSections()
        .find((s) => s.id === 'folders')?.sources[0];

    const labels = folder?.contextMenuItems.map((m) => m.label);
    expect(labels).toEqual(['New Folder', 'Add To Favorites', 'Rename', 'Delete']);

    // The item before Delete should have separatorAfter = true
    expect(folder?.contextMenuItems[2].separatorAfter).toBe(true);
    expect(folder?.contextMenuItems[3].variant).toBe('destructive');
});
```

### Task 2.8 — Verify

- [ ] Run: `cd /Users/dduraipandian/apps/mdnotes/frontend && npm run test`
- [ ] All tests pass
- [ ] Run: `cd /Users/dduraipandian/apps/mdnotes/frontend && npm run test:e2e`
- [ ] E2E tests pass (context menus still work correctly)

---

## Phase 3: Unify Duplicated Snippets in `Folders.svelte`

**Goal:** Extract shared rendering (icon, title/rename, styles) into a single snippet used by both `MenuItemSnippet` and `MenuItemNoChildSnippet`.

**Depends on:** Phase 1 (uses `source.icon`)

### Task 3.1 — Extract `FolderItemContent` snippet

- [ ] **File:** `src/lib/components/Folders.svelte`
- [ ] **Action:** Add a new snippet after the closing `</Sidebar.Root>` tag (before `MenuItemSnippet`)

```svelte
{#snippet FolderIcon(source: SidebarSourceItem)}
	{#if source.icon === 'trash'}
		<Trash2 size={16} class="text-destructive/70" />
	{:else if source.icon === 'star'}
		<Star size={16} class="fill-[#e0b64b] text-[#e0b64b]" />
	{:else}
		<Folder size={16} style="color: {folderColor}" class="opacity-80" />
	{/if}
{/snippet}

{#snippet FolderLabel(source: SidebarSourceItem)}
	{@const item = source.item}
	{#if source.isEditing}
		<input
			bind:value={item.title}
			class="ml-2 h-6 min-w-0 flex-1 rounded-sm bg-background/50 px-1 text-[13px] font-medium text-foreground ring-1 ring-ring/20 outline-none"
			use:focusAndSelect
			onkeydown={(e) => handleRenameKeyDown(e, item)}
			onblur={() => folderService.rename(item.id, item.title)}
			onclick={(e) => e.stopPropagation()}
		/>
	{:else}
		<span class="notes-folder-label ml-2 truncate text-left text-[13px] font-medium"
			>{item.title}</span
		>
	{/if}
{/snippet}
```

---

### Task 3.2 — Use shared snippets in `MenuItemSnippet`

- [ ] **File:** `src/lib/components/Folders.svelte`
- [ ] **Action:** Replace the icon block and label block inside `MenuItemSnippet`

**Replace lines 122–142** (the icon `#if` block and the editing `#if` block) with:

```svelte
{@render FolderIcon(source)}
{@render FolderLabel(source)}
```

So the `MenuButton` content inside `MenuItemSnippet` becomes:

```svelte
<Sidebar.MenuButton
    class={[/* ... */]}
    {...props}
    isActive={source.isSelected}
    onclick={(e) => {
        (props as any).onclick?.(e);
        folderService.select(item.id);
    }}
>
    <div style="width: {source.depth * 0.75}rem" class="shrink-0"></div>
    <ChevronRight
        size={14}
        class={[
            'shrink-0 text-muted-foreground/40 transition-transform duration-200',
            source.isOpen ? 'rotate-90' : ''
        ]}
    />
    {@render FolderIcon(source)}
    {@render FolderLabel(source)}
</Sidebar.MenuButton>
```

---

### Task 3.3 — Use shared snippets in `MenuItemNoChildSnippet`

- [ ] **File:** `src/lib/components/Folders.svelte`
- [ ] **Action:** Replace the icon and label blocks inside `MenuItemNoChildSnippet`

**Replace lines 244–264** (icon `#if` and editing `#if`) with:

```svelte
{@render FolderIcon(source)}
{@render FolderLabel(source)}
```

So the inner `div` becomes:

```svelte
<div class="flex w-full items-center" {...props}>
	<div style="width: {source.depth * 0.75}rem" class="shrink-0"></div>
	<div class="size-3.5 shrink-0"><!-- Spacer to align with chevron --></div>
	{@render FolderIcon(source)}
	{@render FolderLabel(source)}
</div>
```

---

### Task 3.4 — Verify

- [ ] Run: `cd /Users/dduraipandian/apps/mdnotes/frontend && npm run test:e2e`
- [ ] E2E tests pass (folder rendering is visually identical)
- [ ] Manually verify: folder icons, rename input, expand/collapse all still work

---

## Phase 4: Rename `selectors.ts` → `views/` Directory

**Goal:** Make the View Model pattern explicit with a proper directory structure.

**Depends on:** Phases 1–2

### Task 4.1 — Create view files

- [ ] Create directory: `src/lib/views/`
- [ ] Create file: `src/lib/views/types.ts`
- [ ] Create file: `src/lib/views/folderSidebarView.ts`
- [ ] Create file: `src/lib/views/noteListView.ts`

---

### Task 4.2 — Move types to `src/lib/views/types.ts`

- [ ] **File:** `src/lib/views/types.ts`
- [ ] **Action:** Move these type exports from `selectors.ts`:

```typescript
import type { FolderID, FolderItem } from '$lib/stores/folders.svelte';

export type SystemFolders = 'trash' | 'favorites' | 'notes';
export type FolderKinds = 'regular' | SystemFolders;
export type FolderTypes = 'view' | 'regular';
export type FolderIcon = 'folder' | 'star' | 'trash';
export type ContextMenuItemVariant = 'default' | 'destructive';

export type ContextMenuItem = {
	label: string;
	action: () => void;
	variant: ContextMenuItemVariant;
	separatorAfter: boolean;
};

export type SidebarSourceItem = {
	id: FolderID;
	item: FolderItem;
	kind: FolderKinds;
	type: FolderTypes;
	icon: FolderIcon;
	title: string;
	depth: number;
	isSelected: boolean;
	isEditing: boolean;
	isOpen: boolean;
	noteCount: number;
	children: SidebarSourceItem[];
	capabilities: {
		create: boolean;
		rename: boolean;
		delete: boolean;
		recover: boolean;
		permanentDelete: boolean;
		emptyTrash: boolean;
	};
	contextMenuItems: ContextMenuItem[];
};

export type SidebarSourceSection = {
	id: 'views' | 'folders';
	label: string | null;
	sources: SidebarSourceItem[];
};
```

---

### Task 4.3 — Move `FolderSidebarSelector` to `src/lib/views/folderSidebarView.ts`

- [ ] **File:** `src/lib/views/folderSidebarView.ts`
- [ ] **Action:** Move the `FolderSidebarSelector` class (rename to `FolderSidebarView`), update imports to use types from `./types`

```typescript
import type { FolderID, FolderItem, FolderType } from '$lib/stores/folders.svelte';
import { folderStore } from '$lib/stores/folders.svelte';
import { folderService, noteService, trashService } from '$lib/stores/services';
import { selectionStore } from '$lib/stores/selection.svelte';
import { uiStore } from '$lib/stores/dialog.svelte';
import type {
	SidebarSourceItem, SidebarSourceSection, FolderKinds, FolderTypes, FolderIcon, ContextMenuItem
} from './types';

// ... FolderStoreLike, FolderServiceLike, NoteServiceLike, SelectionStoreLike types ...
// ... SidebarSourceRegistryEntry type ...
// ... SidebarActionDeps type and default ...

export class FolderSidebarView {
	// ... exact same implementation as FolderSidebarSelector, just renamed ...
}

export const folderSidebarView = new FolderSidebarView();
```

---

### Task 4.4 — Move `NoteListSelector` to `src/lib/views/noteListView.ts`

- [ ] **File:** `src/lib/views/noteListView.ts`
- [ ] **Action:** Move the `NoteListSelector` class (rename to `NoteListView`), update imports

```typescript
import { groupNotesByDate } from '$lib/utils';
import type { FolderID, FolderItem, FolderType } from '$lib/stores/folders.svelte';
import { folderStore } from '$lib/stores/folders.svelte';
import { notesStore, type NoteItem } from '$lib/stores/notes.svelte';
import { folderService, noteService } from '$lib/stores/services';
import { selectionStore } from '$lib/stores/selection.svelte';

// ... FolderStoreLike, NotesStoreLike, SelectionStoreLike, FolderServiceLike, NoteServiceLike types ...

export class NoteListView {
	// ... exact same implementation as NoteListSelector, just renamed ...
}

export const noteListView = new NoteListView();
```

---

### Task 4.5 — Delete `src/lib/stores/selectors.ts` and create barrel export

- [ ] **Delete:** `src/lib/stores/selectors.ts`
- [ ] **Create:** `src/lib/views/index.ts`

```typescript
export { FolderSidebarView, folderSidebarView } from './folderSidebarView';
export { NoteListView, noteListView } from './noteListView';
export type {
	SidebarSourceItem,
	SidebarSourceSection,
	ContextMenuItem,
	FolderIcon,
	FolderKinds,
	FolderTypes
} from './types';
```

---

### Task 4.6 — Update all component imports

- [ ] **File:** `src/lib/components/Folders.svelte`

**Before:**

```typescript
import { folderSidebarSelector, type SidebarSourceItem } from '$lib/stores/selectors';
```

**After:**

```typescript
import { folderSidebarView, type SidebarSourceItem } from '$lib/views';
```

Also update the template usage:

```svelte
<!-- Before -->
{@const sections = folderSidebarSelector.getSections()}
<!-- After -->
{@const sections = folderSidebarView.getSections()}
```

- [ ] **File:** `src/lib/components/NoteItems.svelte`

**Before:**

```typescript
import { noteListSelector } from '$lib/stores/selectors';
```

**After:**

```typescript
import { noteListView } from '$lib/views';
```

Replace all `noteListSelector` → `noteListView` in the file (there are 6 occurrences).

- [ ] **File:** `src/routes/+page.svelte`

**Before:**

```typescript
import { noteListSelector } from '$lib/stores/selectors';
```

**After:**

```typescript
import { noteListView } from '$lib/views';
```

Replace all `noteListSelector` → `noteListView` in the file (there are 2 occurrences).

---

### Task 4.7 — Update test imports

- [ ] **File:** `tests/unit/selectors.test.ts`

**Before:**

```typescript
import { FolderSidebarSelector, NoteListSelector } from '../../src/lib/stores/selectors';
```

**After:**

```typescript
import { FolderSidebarView } from '../../src/lib/views/folderSidebarView';
import { NoteListView } from '../../src/lib/views/noteListView';
```

Replace all `NoteListSelector` → `NoteListView` and `FolderSidebarSelector` → `FolderSidebarView` inside the test file. The constructor signatures are identical, so the test code stays the same except for the class names.

Optionally rename the file: `tests/unit/selectors.test.ts` → `tests/unit/views.test.ts`

---

### Task 4.8 — Verify

- [ ] Run: `cd /Users/dduraipandian/apps/mdnotes/frontend && npm run test`
- [ ] Run: `cd /Users/dduraipandian/apps/mdnotes/frontend && npm run check`
- [ ] Run: `cd /Users/dduraipandian/apps/mdnotes/frontend && npm run test:e2e`
- [ ] All pass

---

## Phase 5: Split `services.ts` into Separate Files

**Goal:** Single responsibility per file. The 553-line god file becomes 4 focused files + a barrel.

**Depends on:** Phase 4 (import paths need to be stable first)

### Task 5.1 — Extract `FolderTreeHelper`

- [ ] Create file: `src/lib/stores/folderTree.ts`
- [ ] Move `FolderTreeHelper` class (lines 61–194 of `services.ts`) into it
- [ ] Move the `snapshotFolder` and `snapshotNote` helper functions too
- [ ] Move the `FolderStoreLike` and `NotesStoreLike` type definitions that `FolderTreeHelper` needs

```typescript
// src/lib/stores/folderTree.ts
import type { FolderID, FolderItem, FolderType } from './folders.svelte';
import type { NoteID, NoteItem } from './notes.svelte';

// ... paste FolderStoreLike (subset needed by FolderTreeHelper) ...
// ... paste NotesStoreLike (subset needed by FolderTreeHelper) ...

export function snapshotFolder(folder: FolderItem): FolderItem { /* ... */ }
export function snapshotNote(note: NoteItem): NoteItem { /* ... */ }

export class FolderTreeHelper {
    // ... exact same code as before ...
}
```

---

### Task 5.2 — Extract `FolderService`

- [ ] Create file: `src/lib/stores/folderService.ts`
- [ ] Move `FolderService` class into it
- [ ] Import `FolderTreeHelper` from `./folderTree`

```typescript
// src/lib/stores/folderService.ts
import { folderStore, type FolderID, type FolderItem } from './folders.svelte';
import { notesStore, type NoteItem } from './notes.svelte';
import { selectionStore } from './selection.svelte';
import { FolderTreeHelper } from './folderTree';

// ... paste FolderStoreLike, SelectionStoreLike, NotesStoreLike types ...

export class FolderService {
    // ... exact same code as before ...
}
```

---

### Task 5.3 — Extract `NoteService`

- [ ] Create file: `src/lib/stores/noteService.ts`

```typescript
// src/lib/stores/noteService.ts
import { folderStore, type FolderID, type FolderType } from './folders.svelte';
import { notesStore, type NoteItem } from './notes.svelte';
import { selectionStore } from './selection.svelte';
import { FolderTreeHelper } from './folderTree';

// ... paste relevant type interfaces ...

export class NoteService {
    // ... exact same code as before ...
}
```

---

### Task 5.4 — Extract `TrashService`

- [ ] Create file: `src/lib/stores/trashService.ts`

```typescript
// src/lib/stores/trashService.ts
import { folderStore, type FolderID, type FolderItem } from './folders.svelte';
import { notesStore, type NoteID, type NoteItem } from './notes.svelte';
import { trashRepository } from './repositories';
import { selectionStore } from './selection.svelte';
import { FolderTreeHelper, snapshotFolder, snapshotNote } from './folderTree';

// ... paste relevant type interfaces ...

export class TrashService {
    // ... exact same code as before ...
}
```

---

### Task 5.5 — Convert `services.ts` to barrel export

- [ ] **File:** `src/lib/stores/services.ts`
- [ ] **Action:** Replace entire contents with:

```typescript
import { FolderService } from './folderService';
import { NoteService } from './noteService';
import { TrashService } from './trashService';

export { FolderService } from './folderService';
export { NoteService } from './noteService';
export { TrashService } from './trashService';

export const folderService = new FolderService();
export const noteService = new NoteService();
export const trashService = new TrashService();
```

---

### Task 5.6 — Update test imports

- [ ] **File:** `tests/unit/services.test.ts`

**Before:**

```typescript
import { FolderService, NoteService, TrashService } from '../../src/lib/stores/services';
```

**After:**

```typescript
import { FolderService } from '../../src/lib/stores/folderService';
import { NoteService } from '../../src/lib/stores/noteService';
import { TrashService } from '../../src/lib/stores/trashService';
```

The mock for `trashRepository` stays the same. All test code is unchanged.

---

### Task 5.7 — Verify

- [ ] Run: `cd /Users/dduraipandian/apps/mdnotes/frontend && npm run test`
- [ ] Run: `cd /Users/dduraipandian/apps/mdnotes/frontend && npm run check`
- [ ] All pass

---

## Phase 6: Clean Up `FolderType`

**Goal:** Remove the phantom `'all'` type and clarify terminology.

**Depends on:** Phase 5

### Task 6.1 — Rename `FolderType` and remove `'all'`

- [ ] **File:** `src/lib/stores/folders.svelte.ts`

**Before** (line 1):

```typescript
export type FolderType = 'all' | 'trash' | 'regular' | 'system';
```

**After:**

```typescript
export type FolderCategory = 'trash' | 'regular' | 'system';

/** @deprecated Use FolderCategory instead */
export type FolderType = FolderCategory;
```

The alias ensures existing code compiles while you migrate callsites.

---

### Task 6.2 — Update `getNotesForFolder` in `FolderTreeHelper`

- [ ] **File:** `src/lib/stores/folderTree.ts` (or `services.ts` if Phase 5 not done)

**Before:**

```typescript
getNotesForFolder(folderId: FolderID | null, folderType?: FolderType) {
    if (!this.notes) return [];

    let resultNotes: NoteItem[] = [];
    const allNotes = this.notes.listNotes();

    if (folderType === 'all') {
        resultNotes = allNotes.filter((note) => note.deletedAt == null);
    } else if (folderId === 'deleted-notes') {
        // ...
    }
    // ...
}
```

**After:**

```typescript
getNotesForFolder(folderId: FolderID | null, folderType?: FolderCategory) {
    if (!this.notes) return [];

    let resultNotes: NoteItem[] = [];
    const allNotes = this.notes.listNotes();

    if (folderId == null) {
        // No folder selected — show all active notes
        resultNotes = allNotes.filter((note) => note.deletedAt == null);
    } else if (folderId === 'deleted-notes') {
        // ...rest unchanged
    }
    // ...
}
```

**Reasoning:** `folderType === 'all'` was never stored on any folder. The only callsite that triggers this is when `folderId` is `null` (no folder selected). We replace the phantom type check with a null check.

---

### Task 6.3 — Update the `NoteServiceLike` interface

- [ ] **File:** `src/lib/stores/selectors.ts` (or `src/lib/views/types.ts` after Phase 4)

**Before:**

```typescript
type NoteServiceLike = {
    getNotesForFolder(folderId: FolderID | null, folderType?: FolderType): NoteItem[];
    getNoteCountForFolder(folderId: FolderID | null, folderType?: FolderType): number;
};
```

**After:**

```typescript
type NoteServiceLike = {
    getNotesForFolder(folderId: FolderID | null, folderType?: FolderCategory): NoteItem[];
    getNoteCountForFolder(folderId: FolderID | null, folderType?: FolderCategory): number;
};
```

---

### Task 6.4 — Update test assertions

- [ ] **File:** `tests/unit/services.test.ts`

Search for `'all'` — there are **no** tests that use `folderType: 'all'` directly. The test uses `{ type: 'regular' }` mocks. No changes needed.

Search for `FolderType` — not referenced in tests. No changes needed.

---

### Task 6.5 — Remove dead mock data

- [ ] **File:** `src/lib/stores/notes.svelte.ts`

**Delete** lines 203–233 (the `initialMockNotes` array that is never used):

```typescript
// DELETE THIS BLOCK:
const initialMockNotes: NoteItem[] = [
    { id: '1', folderId: 'notes', title: 'Weekly Goals', /* ... */ },
    { id: '2', folderId: 'notes', title: 'Methodologies', /* ... */ },
    { id: '3', folderId: 'notes', title: 'Tech Blogs', /* ... */ },
    { id: '4', folderId: 'work', title: 'Sprint Planning', /* ... */ }
];
```

---

### Task 6.6 — Verify

- [ ] Run: `cd /Users/dduraipandian/apps/mdnotes/frontend && npm run test`
- [ ] Run: `cd /Users/dduraipandian/apps/mdnotes/frontend && npm run check`
- [ ] Run: `cd /Users/dduraipandian/apps/mdnotes/frontend && npm run test:e2e`
- [ ] All pass

---

## Summary Checklist

| Phase                     | Tasks   | Risk   | Tests Updated                                          |
| ------------------------- | ------- | ------ | ------------------------------------------------------ |
| 1. Icon + remove booleans | 1.1–1.7 | Low    | `selectors.test.ts` — update 3 existing, add 3 new     |
| 2. Context menu items     | 2.1–2.8 | Medium | `selectors.test.ts` — add 3 new                        |
| 3. Unify snippets         | 3.1–3.4 | Medium | E2E only                                               |
| 4. Rename to views        | 4.1–4.8 | Low    | `selectors.test.ts` → `views.test.ts` — update imports |
| 5. Split services         | 5.1–5.7 | Low    | `services.test.ts` — update imports only               |
| 6. Clean up FolderType    | 6.1–6.6 | Medium | No test changes needed                                 |

**Total new test cases:** 6
**Total modified test cases:** 3 (assertion updates)
**Total files created:** 7
**Total files deleted:** 1 (`selectors.ts`)
**Total files modified:** ~10
