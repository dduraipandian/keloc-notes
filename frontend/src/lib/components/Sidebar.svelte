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
	let dragOverPos = $state<'top' | 'inside' | 'bottom' | null>(null);

	function handleDragStart(e: DragEvent, id: string) {
		const item = folderStore.getItemById(id);
		if (e.dataTransfer && item) {
			e.dataTransfer.setData('text/plain', id);
			e.dataTransfer.effectAllowed = 'move';

			// Create custom drag image to prevent showing the Wails URL/link preview
			const ghost = document.createElement('div');
			ghost.innerHTML = `
				<div style="
					display: flex; 
					align-items: center; 
					gap: 8px; 
					padding: 6px 12px; 
					background: #27272a; 
					color: #fafafa;
					border-radius: 6px; 
					border: 1px solid #3f3f46;
					box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
					font-size: 13px;
					font-family: inherit;
					white-space: nowrap;
				">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: grey;"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
					<span>${item.title}</span>
				</div>
			`;
			ghost.style.position = 'absolute';
			ghost.style.top = '-1000px';
			ghost.style.left = '-1000px';
			document.body.appendChild(ghost);
			
			e.dataTransfer.setDragImage(ghost, 20, 20);
			
			// Small delay to ensure the browser has captured the image before removal
			setTimeout(() => {
				if (document.body.contains(ghost)) {
					document.body.removeChild(ghost);
				}
			}, 0);
		}
		draggedId = id;
	}

	function handleDragOver(e: DragEvent, id: string | null) {
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}
		dragOverId = id;
		
		if (id && id !== 'root') {
			const target = e.currentTarget as HTMLElement;
			const rect = target.getBoundingClientRect();
			const y = e.clientY - rect.top;
			const threshold = rect.height * 0.25;
			
			if (y < threshold) dragOverPos = 'top';
			else if (y > rect.height - threshold) dragOverPos = 'bottom';
			else dragOverPos = 'inside';
		} else {
			dragOverPos = 'inside';
		}
	}

	function handleDragLeave() {
		dragOverId = null;
		dragOverPos = null;
	}

	function handleDrop(e: DragEvent, parentId: string | null, targetIndex: number = -1) {
		e.preventDefault();
		const id = e.dataTransfer?.getData('text/plain') || draggedId;
		
		if (id) {
			if (dragOverPos === 'top') {
				// Move to parent of current target, at target's index
				folderStore.moveFolder(id, parentId, targetIndex);
			} else if (dragOverPos === 'bottom') {
				// Move to parent of current target, after target's index
				folderStore.moveFolder(id, parentId, targetIndex + 1);
			} else {
				// Nest inside current target (id)
				folderStore.moveFolder(id, dragOverId === 'root' ? null : dragOverId);
			}
		}
		
		draggedId = null;
		dragOverId = null;
		dragOverPos = null;
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
					{#each folderStore.items as item, i (item.id)}
						{@render MenuItemSnippet(item, 0, null, i)}
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

{#snippet MenuItemSnippet(item: FolderItem, depth: number, parentId: string | null, index: number)}
	{#if item.items && item.items.length > 0}
		<Collapsible.Root
			class="group/collapsible relative"
			bind:open={
				() => item.isOpen ?? false,
				(v) => {
					folderStore.openFolder(item);
				}
			}
		>
			<ContextMenu.Root>
				<ContextMenu.Trigger>
					<Sidebar.MenuItem 
						draggable="true"
						class="relative"
						ondragstart={(e) => handleDragStart(e as any, item.id)}
						ondragover={(e) => handleDragOver(e as any, item.id)}
						ondragleave={handleDragLeave}
						ondrop={(e) => handleDrop(e as any, parentId, index)}
					>
						<Collapsible.Trigger class="w-full">
							{#snippet child({ props })}
								<Sidebar.MenuButton
									class={[
										"pr-8 transition-colors",
										dragOverId === item.id && dragOverPos === 'inside' && "bg-accent/50",
										draggedId === item.id && "opacity-50"
									]}
									{...props}
									isActive={item.id === folderStore.selectedItem?.id}
									onclick={(e) => {
										(props as any).onclick?.(e);
										folderStore.selectItem(item);
									}}
								>
									<!-- Drop Indicator -->
									{#if dragOverId === item.id && dragOverPos === 'top'}
										<div class="pointer-events-none absolute top-0 left-0 right-0 h-[2px] bg-primary z-50"></div>
									{:else if dragOverId === item.id && dragOverPos === 'bottom'}
										<div class="pointer-events-none absolute bottom-0 left-0 right-0 h-[2px] bg-primary z-50"></div>
									{/if}

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
										<span class="truncate text-left select-none">{item.title}</span>
									{/if}
								</Sidebar.MenuButton>
								<Sidebar.MenuBadge class="ml-auto text-[10px] text-muted-foreground/60 tabular-nums"
									>{item.badge ? item.badge : 0}</Sidebar.MenuBadge
								>
							{/snippet}
						</Collapsible.Trigger>
						<Collapsible.Content>
							<Sidebar.MenuSub class="m-0 border-l-0 p-0">
								{#each item.items as subItem, i (subItem.id)}
									{@render MenuItemSnippet(subItem, depth + 1, item.id, i)}
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
				<Sidebar.MenuItem 
					draggable="true" 
					class="relative"
					ondragstart={(e) => handleDragStart(e as any, item.id)}
					ondragover={(e) => handleDragOver(e as any, item.id)}
					ondragleave={handleDragLeave}
					ondrop={(e) => handleDrop(e as any, parentId, index)}
				>
					<Sidebar.MenuButton
						class={[
							"pr-8 transition-colors",
							dragOverId === item.id && dragOverPos === 'inside' && "bg-accent/50",
							draggedId === item.id && "opacity-50"
						]}
						isActive={item.id === folderStore.selectedItem?.id}
						onclick={() => {
							folderStore.selectItem(item);
						}}
					>
						<!-- Drop Indicator -->
						{#if dragOverId === item.id && dragOverPos === 'top'}
							<div class="pointer-events-none absolute top-0 left-0 right-0 h-[2px] bg-primary z-50"></div>
						{:else if dragOverId === item.id && dragOverPos === 'bottom'}
							<div class="pointer-events-none absolute bottom-0 left-0 right-0 h-[2px] bg-primary z-50"></div>
						{/if}
						{#snippet child({ props })}
							<a href={item.url} {...props} draggable="false" class="select-none flex items-center gap-2">
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
