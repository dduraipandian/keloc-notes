<script lang="ts">
	import Folder from '@lucide/svelte/icons/folder';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import FolderPlus from '@lucide/svelte/icons/folder-plus';
	import Star from '@lucide/svelte/icons/star';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as ContextMenu from '$lib/components/ui/context-menu/index.js';
	import type { FolderItem } from '$lib/stores/folders.svelte';
	import { uiStore } from '$lib/stores/dialog.svelte';
	import { folderSidebarSelector, type SidebarSourceItem } from '$lib/stores/selectors';
	import { folderService, trashService } from '$lib/stores/services';

	const folderColor = '#dcb15a'; // Apple-style gold/folder color
	const menuButtonStyle = 'h-8 rounded-sm px-3 pr-10 transition-none';

	function handleRenameKeyDown(e: KeyboardEvent, item: FolderItem) {
		if (e.key === 'Enter') {
			console.log('Save: ', item);
			folderService.rename(item.id, item.title);
		} else if (e.key === 'Escape') {
			folderService.cancelRename();
		}
	}

	function focusAndSelect(node: HTMLInputElement) {
		node.focus();
		node.select();
	}
</script>

<Sidebar.Root collapsible="none" class="h-full w-64 border-r-0 bg-sidebar/40">
	{@const sections = folderSidebarSelector.getSections()}
	<Sidebar.Header>
		{#if sections.find((section) => section.id === 'views')?.sources.length}
			<Sidebar.Menu class="pt-6">
				{#each sections.find((section) => section.id === 'views')!.sources as source}
					<Sidebar.MenuItem>
						{@render MenuItemSnippet(source)}
					</Sidebar.MenuItem>
				{/each}
			</Sidebar.Menu>
		{/if}
	</Sidebar.Header>
	<Sidebar.Content class="pt-0">
		{#each sections.filter((section) => section.id !== 'views') as section}
			<Sidebar.Group>
				{#if section.label}
					<Sidebar.GroupLabel
						class="mb-2 px-4 text-[10px] font-bold tracking-[0.15em] text-muted-foreground/40 uppercase"
						>{section.label}</Sidebar.GroupLabel
					>
				{/if}
				<Sidebar.GroupContent>
					<Sidebar.Menu>
						{#each section.sources as source}
							{@render MenuItemSnippet(source)}
						{/each}
					</Sidebar.Menu>
				</Sidebar.GroupContent>
			</Sidebar.Group>
		{/each}
	</Sidebar.Content>

	<Sidebar.Footer class="mt-auto border-t-0 pb-6 pl-6">
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton
					class="group gap-2 px-2 text-[13px] font-medium text-foreground/80 transition-none hover:bg-transparent hover:text-foreground"
					onclick={() => {
						folderService.create();
					}}
				>
					<FolderPlus size={18} class="text-[#f5d04e] transition-transform active:scale-95" />
					<span>New Folder</span>
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Footer>
</Sidebar.Root>

{#snippet MenuItemSnippet(source: SidebarSourceItem)}
	{@const item = source.item}
	{#if source.children.length > 0}
			<Collapsible.Root
				class="group/collapsible"
				bind:open={
					() => source.isOpen,
					(v) => {
						folderService.toggle(item.id);
					}
				}
			>
				<ContextMenu.Root>
					<ContextMenu.Trigger>
						<Sidebar.MenuItem>
							<Collapsible.Trigger>
								{#snippet child({ props })}
									<Sidebar.MenuButton
										class={[
											menuButtonStyle,
											source.isSelected
												? 'bg-accent text-foreground shadow-sm'
												: 'text-foreground/70 hover:bg-accent/20 hover:text-foreground'
										]}
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
										{#if source.isTrashRoot}
											<Trash2 size={16} class="text-destructive/70" />
										{:else if source.kind === 'favorites'}
											<Star size={16} class="fill-[#e0b64b] text-[#e0b64b]" />
										{:else}
											<Folder size={16} style="color: {folderColor}" class="opacity-80" />
										{/if}
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
											<span
												class="notes-folder-label ml-2 truncate text-left text-[13px] font-medium"
												>{item.title}</span
											>
										{/if}
									</Sidebar.MenuButton>
								{/snippet}
							</Collapsible.Trigger>
							<Sidebar.MenuBadge
								class="text-[11px] font-normal text-muted-foreground/40 tabular-nums"
								>{source.noteCount}</Sidebar.MenuBadge
							>
							<Collapsible.Content>
								<Sidebar.MenuSub class="m-0 border-l-0 p-0">
									{#each source.children as child}
										{@render MenuItemSnippet(child)}
									{/each}
								</Sidebar.MenuSub>
							</Collapsible.Content>
						</Sidebar.MenuItem>
					</ContextMenu.Trigger>
					{@render ContextMenuContentSnippet(source)}
				</ContextMenu.Root>
			</Collapsible.Root>
		{:else}
			<ContextMenu.Root>
				<ContextMenu.Trigger>
					<Sidebar.MenuItem>
						{@render MenuItemNoChildSnippet(source)}
					</Sidebar.MenuItem>
				</ContextMenu.Trigger>
				{@render ContextMenuContentSnippet(source)}
			</ContextMenu.Root>
		{/if}
{/snippet}

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

{#snippet MenuItemNoChildSnippet(source: SidebarSourceItem)}
	{@const item = source.item}
	<Sidebar.MenuButton
		class={[
			menuButtonStyle,
			source.isSelected
				? 'bg-accent text-foreground shadow-sm'
				: 'text-foreground/70 hover:bg-accent/20 hover:text-foreground'
		]}
		isActive={source.isSelected}
		onclick={() => {
			folderService.select(item.id);
		}}
	>
		{#snippet child({ props })}
			<div class="flex w-full items-center" {...props}>
				<div style="width: {source.depth * 0.75}rem" class="shrink-0"></div>
				<div class="size-3.5 shrink-0"><!-- Spacer to align with chevron --></div>
				{#if source.isTrashRoot}
					<Trash2 size={16} class="text-destructive/70" />
				{:else if source.kind === 'favorites'}
					<Star size={16} class="fill-[#e0b64b] text-[#e0b64b]" />
				{:else}
					<Folder size={16} style="color: {folderColor}" class="opacity-80" />
				{/if}
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
			</div>
		{/snippet}
	</Sidebar.MenuButton>
	<Sidebar.MenuBadge class="text-[11px] font-normal text-muted-foreground/40 tabular-nums"
		>{source.noteCount}</Sidebar.MenuBadge
	>
{/snippet}
