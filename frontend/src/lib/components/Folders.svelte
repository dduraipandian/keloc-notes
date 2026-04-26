<script lang="ts">
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import FolderPlus from '@lucide/svelte/icons/folder-plus';
	import Sun from '@lucide/svelte/icons/sun';
	import Moon from '@lucide/svelte/icons/moon';
	import Monitor from '@lucide/svelte/icons/monitor';
	import * as Empty from '$lib/components/ui/empty/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as ContextMenu from '$lib/components/ui/context-menu/index.js';
	import { activatePaneOnClick } from '$lib/actions/activatePaneOnClick';
	import { type FolderItem } from '$lib/stores/folders.svelte';
	import { 
		getUIStateStore, 
		getThemeStore, 
		getUIStore, 
		getSelectionStore, 
		getFolderService, 
		getTrashService, 
		getFolderSidebarView,
		getFolderStore
	} from '$lib/stores/context';
	import type { SidebarSourceItem } from '$lib/views/folderSidebarView.svelte';

	const menuButtonStyle =
		'h-8 rounded-sm px-3 pr-10 shadow-none transition-none outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-none';
	const folderStore = getFolderStore();
	const uiStore = getUIStore();
	const selectionStore = getSelectionStore();
	const folderService = getFolderService();
	const trashService = getTrashService();
	const folderSidebarView = getFolderSidebarView();
	const uiStateStore = getUIStateStore();
	const themeStore = getThemeStore();
	const hasUserFolders = $derived(
		folderSidebarView.sections.some(
			(section) => section.id === 'folders' && section.sources.length > 0
		)
	);


	function handleRenameKeyDown(e: KeyboardEvent, item: FolderItem) {
		if (e.key === 'Enter') {
			folderService.rename(item.id, folderStore.editingTitle);
		} else if (e.key === 'Escape') {
			folderService.cancelRename();
		}
	}

	function focusAndSelect(node: HTMLInputElement) {
		node.focus();
		node.select();
	}
</script>

<div
	class="h-full w-full"
	data-testid="folders-pane"
	use:activatePaneOnClick={'folders'}
>
	<Sidebar.Root collapsible="none" class="h-full w-full select-none border-r-0 bg-sidebar">
		{@const sections = folderSidebarView.sections}
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

		<Sidebar.Footer class="mt-auto border-t-0 p-4">
			{#if !hasUserFolders}
				<Empty.Root class="mb-3 min-h-0 border-transparent p-2">
					<Empty.Header class="max-w-none gap-1.5">
						<Empty.Title class="text-[11px] font-medium">Start here</Empty.Title>
						<Empty.Description class="text-[11px] leading-relaxed">
							Create your first folder, then add a note inside it.
						</Empty.Description>
					</Empty.Header>
					<Empty.Content class="items-start">
						<div class="flex items-center gap-1.5 text-[11px] text-muted-foreground/50">
							<kbd
								class="inline-flex h-5 items-center rounded border border-border bg-muted px-1 font-mono text-[10px] font-medium text-foreground/60"
							>⌘⇧N</kbd>
							<span>or use the button below</span>
						</div>
					</Empty.Content>
				</Empty.Root>
			{/if}
			<div class="flex items-center justify-between gap-1 px-2">
				<Sidebar.Menu class="flex-1">
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

				<div class="flex items-center gap-0.5 rounded-md bg-accent/20 p-1">
					<button
						class={[
							'rounded-sm p-1.5 transition-colors',
							themeStore.theme === 'light'
								? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
								: 'text-sidebar-foreground/40 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground/70'
						]}
						onclick={() => themeStore.setTheme('light')}
						title="Light Mode"
					>
						<Sun size={14} />
					</button>
					<button
						class={[
							'rounded-sm p-1.5 transition-colors',
							themeStore.theme === 'dark'
								? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
								: 'text-sidebar-foreground/40 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground/70'
						]}
						onclick={() => themeStore.setTheme('dark')}
						title="Dark Mode"
					>
						<Moon size={14} />
					</button>
					<button
						class={[
							'rounded-sm p-1.5 transition-colors',
							themeStore.theme === 'system'
								? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
								: 'text-sidebar-foreground/40 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground/70'
						]}
						onclick={() => themeStore.setTheme('system')}
						title="System Theme"
					>
						<Monitor size={14} />
					</button>
				</div>
			</div>
		</Sidebar.Footer>
	</Sidebar.Root>
</div>

{#snippet FolderItemSnippet(source: SidebarSourceItem)}
	{@const hasChildren = source.children.length > 0}
	<ContextMenu.Root>
		<ContextMenu.Trigger>
			<Sidebar.MenuItem>
				{#if hasChildren}
					<Collapsible.Root
						class="group/collapsible outline-none"
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
	{@const isRenameRejected = folderStore.rejectedRename?.id === item.id}
	<Sidebar.MenuButton
		class={[
			menuButtonStyle,
			isRenameRejected && 'folder-rename-rejected',
			source.isSelected
				? 'bg-sidebar-accent text-sidebar-accent-foreground'
				: 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
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

		<source.icon size={16} {...source.iconProps} />

		{#if source.isEditing}
			<input
				bind:value={folderStore.editingTitle}
				class={[
					'ml-2 h-6 min-w-0 flex-1 select-text rounded-sm bg-background/50 px-1 text-[13px] font-medium text-foreground ring-1 ring-ring/20 outline-none',
					isRenameRejected && 'ring-destructive/60'
				]}
				use:focusAndSelect
				onkeydown={(e) => handleRenameKeyDown(e, item)}
				onblur={() => folderService.rename(item.id, folderStore.editingTitle)}
				onclick={(e) => e.stopPropagation()}
			/>
		{:else}
			<span
				class={[
					'notes-folder-label ml-2 truncate text-left text-[13px] font-medium',
					isRenameRejected && 'text-destructive'
				]}
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

<style>
	:global([data-testid='folders-pane'] [data-slot='collapsible-trigger']) {
		outline: none;
		box-shadow: none;
	}

	:global([data-testid='folders-pane'] [data-slot='collapsible-trigger']:focus) {
		outline: none;
		box-shadow: none;
	}

	:global([data-testid='folders-pane'] [data-slot='collapsible-trigger']:focus-visible),
	:global([data-testid='folders-pane'] [data-slot='context-menu-trigger']:focus-visible) {
		outline: none !important;
		box-shadow: none !important;
		border-color: transparent !important;
	}

	:global([data-testid='folders-pane'] [data-slot='sidebar-menu-button']) {
		outline: none !important;
	}

	:global([data-testid='folders-pane'] [data-slot='sidebar-menu-button']:focus),
	:global([data-testid='folders-pane'] [data-slot='sidebar-menu-button']:focus-visible) {
		outline: none !important;
		box-shadow: none !important;
		border-color: transparent !important;
	}

	:global(.folder-rename-rejected) {
		animation: folder-rename-rejected 0.42s ease;
		box-shadow: inset 0 0 0 1px hsl(var(--destructive) / 0.45);
	}

	@keyframes folder-rename-rejected {
		0%,
		100% {
			transform: translateX(0);
		}
		20% {
			transform: translateX(-3px);
		}
		40% {
			transform: translateX(4px);
		}
		60% {
			transform: translateX(-2px);
		}
		80% {
			transform: translateX(2px);
		}
	}
</style>
