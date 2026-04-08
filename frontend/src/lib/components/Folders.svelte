<script lang="ts">
	import Folder from '@lucide/svelte/icons/folder';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import FolderPlus from '@lucide/svelte/icons/folder-plus';
	import Trash from '@lucide/svelte/icons/trash';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as ContextMenu from '$lib/components/ui/context-menu/index.js';
	import { folderStore, type FolderItem } from '$lib/stores/folders.svelte';

	const folderColor = '#dcb15a'; // Apple-style gold/folder color

	function handleRenameKeyDown(e: KeyboardEvent, item: FolderItem) {
		if (e.key === 'Enter') {
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
				<Sidebar.MenuButton class="group rounded-lg px-4 py-2 transition-none hover:bg-accent/20">
					{#snippet child({ props })}
						<a href="#" class="flex items-center gap-2.5" {...props}>
							<Trash size={16} class="text-destructive/70" />
							<span class="text-[13px] font-medium text-foreground/70 group-hover:text-foreground"
								>Recently Deleted</span
							>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
				<Sidebar.MenuBadge
					class="ml-auto text-[11px] font-normal text-muted-foreground/40 tabular-nums"
					>0</Sidebar.MenuBadge
				>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Header>
	<Sidebar.Content class="px-2 pt-0">
		<Sidebar.Group>
			<Sidebar.GroupLabel
				class="mb-2 px-4 text-[10px] font-bold tracking-[0.15em] text-muted-foreground/40 uppercase"
				>Folders</Sidebar.GroupLabel
			>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					{#each folderStore.items as item (item.id)}
						{@render MenuItemSnippet(item, 0)}
					{/each}
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>
	</Sidebar.Content>

	<Sidebar.Footer class="mt-auto border-t-0 p-4 pb-6">
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

{#snippet MenuItemSnippet(item: FolderItem, depth: number)}
	{#if item.items && item.items.length > 0}
		<Collapsible.Root
			class="group/collapsible"
			bind:open={
				() => item.isOpen ?? false,
				(v) => {
					folderStore.openFolder(item);
				}
			}
		>
			<ContextMenu.Root>
				<ContextMenu.Trigger>
					<Sidebar.MenuItem>
						<Collapsible.Trigger class="w-full">
							{#snippet child({ props })}
								<Sidebar.MenuButton
									class={[
										'h-9 rounded-lg px-4 py-2 transition-none',
										item.id === folderStore.selectedItem?.id
											? 'bg-accent text-foreground shadow-sm'
											: 'text-foreground/70 hover:bg-accent/20 hover:text-foreground'
									]}
									{...props}
									isActive={item.id === folderStore.selectedItem?.id}
									onclick={(e) => {
										(props as any).onclick?.(e);
										folderStore.selectItem(item);
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
									<Folder size={16} style="color: {folderColor}" class="opacity-80" />
									{#if folderStore.editingId === item.id}
										<input
											bind:value={item.title}
											class="h-6 w-full rounded-sm bg-background/50 px-1 text-[13px] font-medium text-foreground ring-1 ring-ring/20 outline-none"
											use:focusAndSelect
											onkeydown={(e) => handleRenameKeyDown(e, item)}
											onblur={() => folderStore.renameFolder(item.id, item.title)}
											onclick={(e) => e.stopPropagation()}
										/>
									{:else}
										<span class="truncate text-left text-[13px] font-medium">{item.title}</span>
									{/if}
								</Sidebar.MenuButton>
								<Sidebar.MenuBadge
									class="ml-auto text-[11px] font-normal text-muted-foreground/40 tabular-nums"
									>{item.badge ? item.badge : 0}</Sidebar.MenuBadge
								>
							{/snippet}
						</Collapsible.Trigger>
						<Collapsible.Content>
							<Sidebar.MenuSub class="m-0 border-l-0 p-0">
								{#each item.items as subItem (subItem.id)}
									{@render MenuItemSnippet(subItem, depth + 1)}
								{/each}
							</Sidebar.MenuSub>
						</Collapsible.Content>
					</Sidebar.MenuItem>
				</ContextMenu.Trigger>
				{@render ContextMenuContentSnippet(item)}
			</ContextMenu.Root>
		</Collapsible.Root>
	{:else}
		<ContextMenu.Root>
			<ContextMenu.Trigger>
				<Sidebar.MenuItem>
					<Sidebar.MenuButton
						class={[
							'h-9 rounded-lg px-4 py-2 transition-none',
							item.id === folderStore.selectedItem?.id
								? 'bg-accent text-foreground shadow-sm'
								: 'text-foreground/70 hover:bg-accent/20 hover:text-foreground'
						]}
						isActive={item.id === folderStore.selectedItem?.id}
						onclick={() => {
							folderStore.selectItem(item);
						}}
					>
						{#snippet child({ props })}
							<div class="flex w-full items-center" {...props}>
								<div style="width: {depth * 0.75}rem" class="shrink-0"></div>
								<div class="size-3.5 shrink-0"><!-- Spacer to align with chevron --></div>
								<Folder size={16} style="color: {folderColor}" class="opacity-80" />
								{#if folderStore.editingId === item.id}
									<input
										bind:value={item.title}
										class="h-6 w-full rounded-sm bg-background/50 px-1 text-[13px] font-medium text-foreground ring-1 ring-ring/20 outline-none"
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
					<Sidebar.MenuBadge
						class="ml-auto text-[11px] font-normal text-muted-foreground/40 tabular-nums"
						>{item.badge ? item.badge : 0}</Sidebar.MenuBadge
					>
				</Sidebar.MenuItem>
			</ContextMenu.Trigger>
			{@render ContextMenuContentSnippet(item)}
		</ContextMenu.Root>
	{/if}
{/snippet}

{#snippet ContextMenuContentSnippet(item: FolderItem)}
	<ContextMenu.Content
		class="dark min-w-[160px] rounded-md border-border/10 bg-card/95 p-1 shadow-2xl backdrop-blur-xl"
	>
		<ContextMenu.Item
			class="rounded-sm px-3 py-1 text-[13px]"
			onSelect={() => folderStore.startRename(item.id)}>Rename</ContextMenu.Item
		>
		<ContextMenu.Item
			class="rounded-sm px-3 py-1 text-[13px] text-destructive focus:text-destructive"
			onSelect={() => folderStore.deleteFolder(item.id)}>Delete</ContextMenu.Item
		>
	</ContextMenu.Content>
{/snippet}
