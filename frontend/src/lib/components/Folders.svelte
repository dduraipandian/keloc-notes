<script lang="ts">
	import Folder from '@lucide/svelte/icons/folder';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import FolderPlus from '@lucide/svelte/icons/folder-plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as ContextMenu from '$lib/components/ui/context-menu/index.js';
	import { folderStore, type FolderItem } from '$lib/stores/folders.svelte';
	import { notesStore } from '$lib/stores/notes.svelte';
	import { uiStore } from '$lib/stores/dialog.svelte';

	const folderColor = '#dcb15a'; // Apple-style gold/folder color
	const menuButtonStyle = 'h-8 rounded-sm px-3 pr-10 transition-none';

	function handleRenameKeyDown(e: KeyboardEvent, item: FolderItem) {
		if (e.key === 'Enter') {
			console.log('Save: ', item);
			folderStore.renameFolder(item.id, item.title);
		} else if (e.key === 'Escape') {
			folderStore.cancelRename();
		}
	}

	function focusAndSelect(node: HTMLInputElement) {
		node.focus();
		node.select();
	}
</script>

<Sidebar.Root collapsible="none" class="h-full w-64 border-r-0 bg-sidebar/40">
	<Sidebar.Header>
		<Sidebar.Menu class="pt-6">
			<Sidebar.MenuItem>
				{@render MenuItemSnippet(folderStore.folders.get('deleted-notes')!, 0, true)}
			</Sidebar.MenuItem>
			<Sidebar.MenuItem>
				{@render MenuItemSnippet(folderStore.folders.get('notes')!, 0, false)}
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Header>
	<Sidebar.Content class="pt-0">
		<Sidebar.Group>
			<Sidebar.GroupLabel
				class="mb-2 px-4 text-[10px] font-bold tracking-[0.15em] text-muted-foreground/40 uppercase"
				>Folders</Sidebar.GroupLabel
			>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					{#each folderStore.items as itemId}
						{@render MenuItemSnippet(folderStore.folders.get(itemId)!, 0)}
					{/each}
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>
	</Sidebar.Content>

	<Sidebar.Footer class="mt-auto border-t-0 pb-6 pl-6">
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton class="px-2 transition-none hover:bg-transparent">
					{#snippet child({ props })}
						<a
							href="#"
							class="group flex items-center gap-2 text-[13px] font-medium text-foreground/80 hover:text-foreground"
							onclick={(e) => {
								e.preventDefault();
								folderStore.createFolder();
							}}
						>
							<FolderPlus size={18} class="text-[#f5d04e] transition-transform active:scale-95" />
							<span>New Folder</span>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Footer>
</Sidebar.Root>

{#snippet MenuItemSnippet(item: FolderItem, depth: number, isTrashTree: boolean = false)}
	{#if item && (isTrashTree || (item.deletedAt == null && item.type !== 'trash'))}
		{@const isTrashRoot = item.type === 'trash'}
		{@const childrenIds_raw = isTrashRoot ? folderStore.trashItems : item.items || []}
		{@const childrenIds = isTrashRoot
			? childrenIds_raw
			: isTrashTree
				? []
				: childrenIds_raw.filter((id) => folderStore.folders.get(id)?.deletedAt == null)}
		{#if childrenIds && childrenIds.length > 0}
			<Collapsible.Root
				class="group/collapsible"
				bind:open={
					() => item.isOpen ?? false,
					(v) => {
						folderStore.openFolder(item.id);
					}
				}
			>
				<ContextMenu.Root>
					<ContextMenu.Trigger>
						<Sidebar.MenuItem>
							<Collapsible.Trigger asChild>
								{#snippet child({ props })}
									<Sidebar.MenuButton
										class={[
											menuButtonStyle,
											item.id === folderStore.selectedFolderID
												? 'bg-accent text-foreground shadow-sm'
												: 'text-foreground/70 hover:bg-accent/20 hover:text-foreground'
										]}
										{...props}
										isActive={item.id === folderStore.selectedFolderID}
										onclick={(e) => {
											(props as any).onclick?.(e);
											folderStore.selectFolder(item.id);
										}}
									>
										<div style="width: {depth * 0.75}rem" class="shrink-0"></div>
										<ChevronRight
											size={14}
											class={[
												'shrink-0 text-muted-foreground/40 transition-transform duration-200',
												item.isOpen ? 'rotate-90' : ''
											]}
										/>
										{#if isTrashRoot}
											<Trash2 size={16} class="text-destructive/70" />
										{:else}
											<Folder size={16} style="color: {folderColor}" class="opacity-80" />
										{/if}
										{#if folderStore.editingId === item.id}
											<input
												bind:value={item.title}
												class="ml-2 h-6 min-w-0 flex-1 rounded-sm bg-background/50 px-1 text-[13px] font-medium text-foreground ring-1 ring-ring/20 outline-none"
												use:focusAndSelect
												onkeydown={(e) => handleRenameKeyDown(e, item)}
												onblur={() => folderStore.renameFolder(item.id, item.title)}
												onclick={(e) => e.stopPropagation()}
											/>
										{:else}
											<span class="ml-2 truncate text-left text-[13px] font-medium"
												>{item.title}</span
											>
										{/if}
									</Sidebar.MenuButton>
								{/snippet}
							</Collapsible.Trigger>
							<Sidebar.MenuBadge
								class="text-[11px] font-normal text-muted-foreground/40 tabular-nums"
								>{notesStore.getNoteCountForFolder(item.id, item.type)}</Sidebar.MenuBadge
							>
							<Collapsible.Content>
								<Sidebar.MenuSub class="m-0 border-l-0 p-0">
									{#each childrenIds as subItemID}
										{@render MenuItemSnippet(
											folderStore.folders.get(subItemID)!,
											depth + 1,
											isTrashTree || isTrashRoot
										)}
									{/each}
								</Sidebar.MenuSub>
							</Collapsible.Content>
						</Sidebar.MenuItem>
					</ContextMenu.Trigger>
					{@render ContextMenuContentSnippet(item, isTrashTree)}
				</ContextMenu.Root>
			</Collapsible.Root>
		{:else}
			<ContextMenu.Root>
				<ContextMenu.Trigger>
					<Sidebar.MenuItem>
						{@render MenuItemNoChildSnippet(item, depth)}
					</Sidebar.MenuItem>
				</ContextMenu.Trigger>
				{@render ContextMenuContentSnippet(item, isTrashTree)}
			</ContextMenu.Root>
		{/if}
	{/if}
{/snippet}

{#snippet ContextMenuContentSnippet(item: FolderItem, isTrashTree: boolean = false)}
	<ContextMenu.Content class="w-36">
		{#if item.deletedAt != null}
			<ContextMenu.Item
				class="text-[13px]"
				onSelect={() => folderStore.recoverFolderAndChildren(item.id)}
				>Recover Folder</ContextMenu.Item
			>
			<ContextMenu.Separator />
			<ContextMenu.Item
				class="text-[13px] text-destructive focus:text-destructive"
				onSelect={() =>
					uiStore.confirmFolderPermanentDelete(item.title, () =>
						folderStore.permanentDeleteFolderAndChildren(item.id)
					)}>Delete Permanently</ContextMenu.Item
			>
		{:else if isTrashTree}
			<ContextMenu.Item
				class="text-[13px] text-destructive focus:text-destructive"
				onSelect={() => uiStore.confirmEmptyTrash(() => folderStore.emptyTrash())}
				>Empty Trash</ContextMenu.Item
			>
		{:else if item.type == 'system'}
			<ContextMenu.Item class="text-[13px]" onSelect={() => folderStore.createFolder()}
				>New Folder</ContextMenu.Item
			>
		{:else}
			<ContextMenu.Item class="text-[13px]" onSelect={() => folderStore.createFolder()}
				>New Folder</ContextMenu.Item
			>
			<ContextMenu.Item class="text-[13px]" onSelect={() => folderStore.startRename(item.id)}
				>Rename</ContextMenu.Item
			>
			<ContextMenu.Separator />
			<ContextMenu.Item
				class="text-[13px] text-destructive focus:text-destructive"
				onSelect={() =>
					uiStore.confirmFolderDelete(item.title, () => folderStore.deleteFolder(item.id))}
				>Delete</ContextMenu.Item
			>
		{/if}
	</ContextMenu.Content>
{/snippet}

{#snippet MenuItemNoChildSnippet(item: FolderItem, depth: number)}
	<Sidebar.MenuButton
		class={[
			menuButtonStyle,
			item.id === folderStore.selectedFolderID
				? 'bg-accent text-foreground shadow-sm'
				: 'text-foreground/70 hover:bg-accent/20 hover:text-foreground'
		]}
		isActive={item.id === folderStore.selectedFolderID}
		onclick={() => {
			folderStore.selectFolder(item.id);
		}}
	>
		{#snippet child({ props })}
			<div class="flex w-full items-center" {...props}>
				<div style="width: {depth * 0.75}rem" class="shrink-0"></div>
				<div class="size-3.5 shrink-0"><!-- Spacer to align with chevron --></div>
				{#if item.type === 'trash'}
					<Trash2 size={16} class="text-destructive/70" />
				{:else}
					<Folder size={16} style="color: {folderColor}" class="opacity-80" />
				{/if}
				{#if folderStore.editingId === item.id}
					<input
						bind:value={item.title}
						class="ml-2 h-6 min-w-0 flex-1 rounded-sm bg-background/50 px-1 text-[13px] font-medium text-foreground ring-1 ring-ring/20 outline-none"
						use:focusAndSelect
						onkeydown={(e) => handleRenameKeyDown(e, item)}
						onblur={() => folderStore.renameFolder(item.id, item.title)}
						onclick={(e) => e.stopPropagation()}
					/>
				{:else}
					<span class="ml-2 truncate text-left text-[13px] font-medium">{item.title}</span>
				{/if}
			</div>
		{/snippet}
	</Sidebar.MenuButton>
	<Sidebar.MenuBadge class="text-[11px] font-normal text-muted-foreground/40 tabular-nums"
		>{notesStore.getNoteCountForFolder(item.id, item.type)}</Sidebar.MenuBadge
	>
{/snippet}
