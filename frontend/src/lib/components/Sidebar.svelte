<script lang="ts">
	import Folder from '@lucide/svelte/icons/folder';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import FolderPlus from '@lucide/svelte/icons/folder-plus';
	import Trash from '@lucide/svelte/icons/trash';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as ContextMenu from '$lib/components/ui/context-menu/index.js';
	import { folderStore, type FolderItem } from '$lib/stores/folders.svelte';

	const folderColor = 'grey';

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

	let draggedId = $state<string | null>(null);
	let dragOverId = $state<string | null>(null);

	function handleDragStart(e: DragEvent, id: string) {
		if (e.dataTransfer) {
			e.dataTransfer.setData('text/plain', id);
			e.dataTransfer.effectAllowed = 'move';
		}
		draggedId = id;
	}

	function handleDragOver(e: DragEvent, id: string | null) {
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}
		dragOverId = id;
	}

	function handleDragLeave() {
		dragOverId = null;
	}

	function handleDrop(e: DragEvent, targetParentId: string | null) {
		e.preventDefault();
		const id = e.dataTransfer?.getData('text/plain') || draggedId;
		if (id && id !== targetParentId) {
			folderStore.moveFolder(id, targetParentId);
		}
		draggedId = null;
		dragOverId = null;
	}
</script>

<Sidebar.Root collapsible="icon" class="border-r-0">
	<Sidebar.Content>
		<Sidebar.Group>
			<Sidebar.GroupLabel
				class="text-xs font-semibold tracking-wider text-muted-foreground/70 uppercase"
				>Folders</Sidebar.GroupLabel
			>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					{#each folderStore.items as item (item.id)}
						{@render MenuItemSnippet(item, 0)}
					{/each}
					<!-- Root Drop Zone -->
					<div 
						class={[
							"h-8 rounded-md border-2 border-dashed border-transparent transition-colors mt-2",
							dragOverId === 'root' && "border-accent bg-accent/20"
						]}
						ondragover={(e: DragEvent) => handleDragOver(e, 'root')}
						ondragleave={handleDragLeave}
						ondrop={(e: DragEvent) => handleDrop(e, null)}
						role="listitem"
					>
						<span 
							class={[
								"flex h-full items-center justify-center text-[10px] text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100",
								dragOverId === 'root' && "opacity-100"
							]}
						>
							Drop here to move to root
						</span>
					</div>
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>
		<Sidebar.Group>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton class="pr-8">
							{#snippet child({ props })}
								<!-- svelte-ignore a11y_invalid_attribute -->
								<a href="#" {...props}>
									<Trash color="#dc5a5a" /> <span class="truncate text-left">Recently Deleted</span>
								</a>
							{/snippet}
						</Sidebar.MenuButton>
						<Sidebar.MenuBadge class="ml-auto text-[10px] text-muted-foreground/60 tabular-nums"
							>0</Sidebar.MenuBadge
						>
					</Sidebar.MenuItem>
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>
	</Sidebar.Content>

	<Sidebar.Footer class="border-t-0 p-4">
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton>
					{#snippet child({ props })}
						<!-- svelte-ignore a11y_invalid_attribute -->
						<a
							href="#"
							class="flex items-center gap-2 text-sm text-foreground/80 hover:text-foreground"
							onclick={() => folderStore.createFolder()}
						>
							<span>New Folder</span>
							<FolderPlus class="ml-auto size-5" color="#3e9392" />
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
					<Sidebar.MenuItem draggable="true">
						<Collapsible.Trigger class="w-full">
							{#snippet child({ props })}
								<Sidebar.MenuButton
									class={[
										"pr-8 transition-colors",
										dragOverId === item.id && "bg-accent/50",
										draggedId === item.id && "opacity-50"
									]}
									{...props}
									isActive={item.id === folderStore.selectedItem?.id}
									onclick={(e) => {
										(props as any).onclick?.(e);
										folderStore.selectItem(item);
									}}
									ondragstart={(e) => handleDragStart(e as any, item.id)}
									ondragover={(e) => handleDragOver(e as any, item.id)}
									ondragleave={handleDragLeave}
									ondrop={(e) => handleDrop(e as any, item.id)}
								>
									<div style="width: {depth * 0.5}rem" class="shrink-0"></div>
									<ChevronRight
										size={14}
										class={[
											'shrink-0 transition-transform duration-200',
											item.isOpen ? 'rotate-90' : ''
										]}
									/>
									<Folder color={folderColor} />
									{#if folderStore.editingId === item.id}
										<input
											bind:value={item.title}
											class="h-6 w-full rounded-sm bg-background px-1 text-foreground ring-1 ring-ring outline-none"
											use:focusAndSelect
											onkeydown={(e) => handleRenameKeyDown(e, item)}
											onblur={() => folderStore.renameFolder(item.id, item.title)}
											onclick={(e) => e.stopPropagation()}
										/>
									{:else}
										<span class="truncate text-left">{item.title}</span>
									{/if}
								</Sidebar.MenuButton>
								<Sidebar.MenuBadge class="ml-auto text-[10px] text-muted-foreground/60 tabular-nums"
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
				<Sidebar.MenuItem draggable="true">
					<Sidebar.MenuButton
						class={[
							"pr-8 transition-colors",
							dragOverId === item.id && "bg-accent/50",
							draggedId === item.id && "opacity-50"
						]}
						isActive={item.id === folderStore.selectedItem?.id}
						onclick={() => {
							folderStore.selectItem(item);
						}}
						ondragstart={(e) => handleDragStart(e as any, item.id)}
						ondragover={(e) => handleDragOver(e as any, item.id)}
						ondragleave={handleDragLeave}
						ondrop={(e) => handleDrop(e as any, item.id)}
					>
						{#snippet child({ props })}
							<a href={item.url} {...props}>
								<div style="width: {depth * 0.5}rem" class="shrink-0"></div>
								<div class="size-3.5 shrink-0"><!-- Spacer to align with chevron --></div>
								<Folder color={folderColor} />
								{#if folderStore.editingId === item.id}
									<input
										bind:value={item.title}
										class="h-6 w-full rounded-sm bg-background px-1 text-foreground ring-1 ring-ring outline-none"
										use:focusAndSelect
										onkeydown={(e) => handleRenameKeyDown(e, item)}
										onblur={() => folderStore.renameFolder(item.id, item.title)}
										onclick={(e) => e.stopPropagation()}
									/>
								{:else}
									<span class="truncate text-left">{item.title}</span>
								{/if}
							</a>
						{/snippet}
					</Sidebar.MenuButton>
					<Sidebar.MenuBadge class="ml-auto text-[10px] text-muted-foreground/60 tabular-nums"
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
		class="dark rounded-sm bg-card text-xs tracking-wider text-muted-foreground/70"
	>
		<ContextMenu.Item onSelect={() => folderStore.startRename(item.id)}>Rename</ContextMenu.Item>
		<ContextMenu.Item onSelect={() => folderStore.deleteFolder(item.id)}>Delete</ContextMenu.Item>
	</ContextMenu.Content>
{/snippet}
