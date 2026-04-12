<script lang="ts">
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import * as SidebarUI from '$lib/components/ui/sidebar/index.js';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as ContextMenu from '$lib/components/ui/context-menu/index.js';
	import { listVirtualViews } from '$lib/stores/sources/registry.svelte';
	import { folderStore } from '$lib/stores/folders.svelte';
	import { selectionStore } from '$lib/stores/selection.svelte';
	import { uiStore } from '$lib/stores/dialog.svelte';
	import FolderNode from './FolderNode.svelte';

	const menuButtonStyle = 'h-8 rounded-sm px-3 pr-10 transition-none';

	// Local open state for virtual view collapsibles.
	let trashOpen = $state(true);
</script>

{#each listVirtualViews() as view (view.id)}
	{@const isSelected = selectionStore.selectedSourceId === view.id}
	{@const deletedFolders = folderStore.trashItems}

	{#if deletedFolders.length > 0}
		<Collapsible.Root class="group/collapsible" bind:open={trashOpen}>
			<ContextMenu.Root>
				<ContextMenu.Trigger>
					<SidebarUI.MenuItem>
						<Collapsible.Trigger>
							{#snippet child({ props })}
								<SidebarUI.MenuButton
									class={[
										menuButtonStyle,
										isSelected
											? 'bg-accent text-foreground shadow-sm'
											: 'text-foreground/70 hover:bg-accent/20 hover:text-foreground'
									]}
									{...props}
									isActive={isSelected}
									onclick={(e) => {
										(props as any).onclick?.(e);
										selectionStore.select(view.id);
									}}
								>
									<ChevronRight
										size={14}
										class={[
											'shrink-0 text-muted-foreground/40 transition-transform duration-200',
											trashOpen ? 'rotate-90' : ''
										]}
									/>
									<Trash2 size={16} class="text-destructive/70" />
									<span class="ml-2 truncate text-left text-[13px] font-medium">{view.title}</span>
								</SidebarUI.MenuButton>
							{/snippet}
						</Collapsible.Trigger>
						<SidebarUI.MenuBadge
							class="text-[11px] font-normal text-muted-foreground/40 tabular-nums"
							>{view.getCount()}</SidebarUI.MenuBadge
						>
						<Collapsible.Content>
							<SidebarUI.MenuSub class="m-0 border-l-0 p-0">
								{#each deletedFolders as trashFolderId (trashFolderId)}
									<FolderNode folderId={trashFolderId} depth={1} mode="trash" />
								{/each}
							</SidebarUI.MenuSub>
						</Collapsible.Content>
					</SidebarUI.MenuItem>
				</ContextMenu.Trigger>
				<ContextMenu.Content class="w-36">
					<ContextMenu.Item
						class="text-[13px] text-destructive focus:text-destructive"
						onSelect={() => uiStore.confirmEmptyTrash(() => folderStore.emptyTrash())}
						>Empty Trash</ContextMenu.Item
					>
				</ContextMenu.Content>
			</ContextMenu.Root>
		</Collapsible.Root>
	{:else}
		<!-- No deleted folders: simple non-collapsible row -->
		<ContextMenu.Root>
			<ContextMenu.Trigger>
				<SidebarUI.MenuItem>
					<SidebarUI.MenuButton
						class={[
							menuButtonStyle,
							isSelected
								? 'bg-accent text-foreground shadow-sm'
								: 'text-foreground/70 hover:bg-accent/20 hover:text-foreground'
						]}
						isActive={isSelected}
						onclick={() => selectionStore.select(view.id)}
					>
						{#snippet child({ props })}
							<div class="flex w-full items-center" {...props}>
								<div class="size-3.5 shrink-0"></div>
								<Trash2 size={16} class="text-destructive/70" />
								<span class="ml-2 truncate text-left text-[13px] font-medium">{view.title}</span>
							</div>
						{/snippet}
					</SidebarUI.MenuButton>
					<SidebarUI.MenuBadge
						class="text-[11px] font-normal text-muted-foreground/40 tabular-nums"
						>{view.getCount()}</SidebarUI.MenuBadge
					>
				</SidebarUI.MenuItem>
			</ContextMenu.Trigger>
			<ContextMenu.Content class="w-36">
				<ContextMenu.Item
					class="text-[13px] text-destructive focus:text-destructive"
					onSelect={() => uiStore.confirmEmptyTrash(() => folderStore.emptyTrash())}
					>Empty Trash</ContextMenu.Item
				>
			</ContextMenu.Content>
		</ContextMenu.Root>
	{/if}
{/each}
