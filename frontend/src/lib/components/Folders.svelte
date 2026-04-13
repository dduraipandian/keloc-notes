<script lang="ts">
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import FolderPlus from '@lucide/svelte/icons/folder-plus';
	import Folder from '@lucide/svelte/icons/folder';
	import Star from '@lucide/svelte/icons/star';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as ContextMenu from '$lib/components/ui/context-menu/index.js';
	import type { FolderItem } from '$lib/stores/folders.svelte';
	import { folderSidebarView, type SidebarSourceItem } from '$lib/views/folderSidebarView.svelte';
	import { folderService } from '$lib/stores/services';

	const FOLDER_COLOR = '#dcb15a';
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
	{@const sections = folderSidebarView.getSections()}
	<Sidebar.Header>
		{#if sections.find((section) => section.id === 'views')?.sources.length}
			<Sidebar.Menu class="pt-6">
				{#each sections.find((section) => section.id === 'views')!.sources as source}
					{@render FolderItemSnippet(source)}
				{/each}
			</Sidebar.Menu>
		{/if}
	</Sidebar.Header>
	<Sidebar.Content class="pt-0">
		{#each sections.filter((section) => section.id !== 'views') as section}
			<Sidebar.Group>
				{#if section.label}
					<Sidebar.GroupLabel
						class="mb-2 px-4 text-[10px] font-bold tracking-[0.15em] text-muted-foreground/70 uppercase"
						>{section.label}</Sidebar.GroupLabel
					>
				{/if}
				<Sidebar.GroupContent>
					<Sidebar.Menu>
						{#each section.sources as source}
							{@render FolderItemSnippet(source)}
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

{#snippet FolderItemSnippet(source: SidebarSourceItem)}
	{@const hasChildren = source.children.length > 0}
	<ContextMenu.Root>
		<ContextMenu.Trigger>
			<Sidebar.MenuItem>
				{#if hasChildren}
					<Collapsible.Root
						class="group/collapsible"
						open={source.isOpen}
						onOpenChange={() => folderService.toggle(source.id)}
					>
						<Collapsible.Trigger>
							{#snippet child({ props })}
								{@render FolderButtonSnippet(source, props)}
							{/snippet}
						</Collapsible.Trigger>
						<Sidebar.MenuBadge
							class="text-[11px] font-normal text-muted-foreground/40 tabular-nums"
						>
							{source.noteCount}
						</Sidebar.MenuBadge>
						<Collapsible.Content>
							<Sidebar.MenuSub class="m-0 border-l-0 p-0">
								{#each source.children as child}
									{@render FolderItemSnippet(child)}
								{/each}
							</Sidebar.MenuSub>
						</Collapsible.Content>
					</Collapsible.Root>
				{:else}
					{@render FolderButtonSnippet(source)}
					<Sidebar.MenuBadge class="text-[11px] font-normal text-muted-foreground/40 tabular-nums">
						{source.noteCount}
					</Sidebar.MenuBadge>
				{/if}
			</Sidebar.MenuItem>
		</ContextMenu.Trigger>
		{@render ContextMenuContentSnippet(source)}
	</ContextMenu.Root>
{/snippet}

{#snippet FolderButtonSnippet(source: SidebarSourceItem, props = {})}
	{@const item = source.item}
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

		{#if source.children.length > 0}
			<ChevronRight
				size={14}
				class={[
					'shrink-0 text-muted-foreground/40 transition-transform duration-200',
					source.isOpen ? 'rotate-90' : ''
				]}
			/>
		{:else}
			<div class="size-3.5 shrink-0"><!-- Spacer --></div>
		{/if}

		{#if source.icon === 'trash'}
			<Trash2 size={16} class="text-destructive/70" />
		{:else if source.icon === 'star'}
			<Star size={16} class="fill-[#e0b64b] text-[#e0b64b]" />
		{:else}
			<Folder size={16} style="color: {FOLDER_COLOR}" class="opacity-80" />
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
	</Sidebar.MenuButton>
{/snippet}

{#snippet ContextMenuContentSnippet(source: SidebarSourceItem)}
	<ContextMenu.Content class="w-36">
		{#each source.contextMenuItems as menuItem}
			<ContextMenu.Item
				class={[
					'text-[13px]',
					menuItem.variant === 'destructive' && 'text-destructive focus:text-destructive'
				]}
				onSelect={menuItem.action}
			>
				{menuItem.label}
			</ContextMenu.Item>
			{#if menuItem.separatorAfter}
				<ContextMenu.Separator />
			{/if}
		{/each}
	</ContextMenu.Content>
{/snippet}
