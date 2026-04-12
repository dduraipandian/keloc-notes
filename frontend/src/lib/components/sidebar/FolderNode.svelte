<script lang="ts">
	import Folder from '@lucide/svelte/icons/folder';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import * as SidebarUI from '$lib/components/ui/sidebar/index.js';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as ContextMenu from '$lib/components/ui/context-menu/index.js';
	import { folderStore } from '$lib/stores/folders.svelte';
	import { selectionStore } from '$lib/stores/selection.svelte';
	import { uiStore } from '$lib/stores/dialog.svelte';
	import { getSource } from '$lib/stores/sources/registry.svelte';
	import FolderNode from './FolderNode.svelte';

	interface Props {
		folderId: string;
		depth?: number;
		/** 'trash' when this node is rendered inside the deleted-folders subtree */
		mode?: 'live' | 'trash';
	}

	let { folderId, depth = 0, mode = 'live' }: Props = $props();

	const folderColor = '#dcb15a';
	const menuButtonStyle = 'h-8 rounded-sm px-3 pr-10 transition-none';

	const folder = $derived(folderStore.folders.get(folderId));
	const capabilities = $derived(getSource(folderId)?.capabilities);

	// Live mode: only non-deleted children. Trash mode: all children (whole subtree is deleted).
	const childrenIds = $derived(
		(() => {
			if (!folder?.items) return [];
			if (mode === 'trash') return folder.items;
			return folder.items.filter((id) => folderStore.folders.get(id)?.deletedAt == null);
		})()
	);

	const isSelected = $derived(selectionStore.selectedSourceId === folderId);

	function handleRenameKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			folderStore.renameFolder(folderId, folder?.title ?? '');
		} else if (e.key === 'Escape') {
			folderStore.cancelRename();
		}
	}

	function focusAndSelect(node: HTMLInputElement) {
		node.focus();
		node.select();
	}
</script>

{#if folder && (mode === 'trash' || folder.deletedAt == null)}
	{#if childrenIds.length > 0}
		<Collapsible.Root
			class="group/collapsible"
			bind:open={
				() => folder.isOpen ?? false,
				(v) => {
					folderStore.openFolder(folderId);
				}
			}
		>
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
										selectionStore.select(folderId);
									}}
								>
									<div style="width: {depth * 0.75}rem" class="shrink-0"></div>
									<ChevronRight
										size={14}
										class={[
											'shrink-0 text-muted-foreground/40 transition-transform duration-200',
											folder.isOpen ? 'rotate-90' : ''
										]}
									/>
									<Folder size={16} style="color: {folderColor}" class="opacity-80" />
									{#if folderStore.editingId === folderId}
										<input
											bind:value={folder.title}
											class="ml-2 h-6 min-w-0 flex-1 rounded-sm bg-background/50 px-1 text-[13px] font-medium text-foreground ring-1 ring-ring/20 outline-none"
											use:focusAndSelect
											onkeydown={handleRenameKeyDown}
											onblur={() => folderStore.renameFolder(folderId, folder?.title ?? '')}
											onclick={(e) => e.stopPropagation()}
										/>
									{:else}
										<span class="ml-2 truncate text-left text-[13px] font-medium"
											>{folder.title}</span
										>
									{/if}
								</SidebarUI.MenuButton>
							{/snippet}
						</Collapsible.Trigger>
						<SidebarUI.MenuBadge
							class="text-[11px] font-normal text-muted-foreground/40 tabular-nums"
							>{getSource(folderId)?.getCount() ?? 0}</SidebarUI.MenuBadge
						>
						<Collapsible.Content>
							<SidebarUI.MenuSub class="m-0 border-l-0 p-0">
								{#each childrenIds as childId (childId)}
									<FolderNode folderId={childId} depth={depth + 1} {mode} />
								{/each}
							</SidebarUI.MenuSub>
						</Collapsible.Content>
					</SidebarUI.MenuItem>
				</ContextMenu.Trigger>
				{@render contextMenu()}
			</ContextMenu.Root>
		</Collapsible.Root>
	{:else}
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
						onclick={() => selectionStore.select(folderId)}
					>
						{#snippet child({ props })}
							<div class="flex w-full items-center" {...props}>
								<div style="width: {depth * 0.75}rem" class="shrink-0"></div>
								<div class="size-3.5 shrink-0"></div>
								<Folder size={16} style="color: {folderColor}" class="opacity-80" />
								{#if folderStore.editingId === folderId}
									<input
										bind:value={folder.title}
										class="ml-2 h-6 min-w-0 flex-1 rounded-sm bg-background/50 px-1 text-[13px] font-medium text-foreground ring-1 ring-ring/20 outline-none"
										use:focusAndSelect
										onkeydown={handleRenameKeyDown}
										onblur={() => folderStore.renameFolder(folderId, folder?.title ?? '')}
										onclick={(e) => e.stopPropagation()}
									/>
								{:else}
									<span class="ml-2 truncate text-left text-[13px] font-medium">{folder.title}</span>
								{/if}
							</div>
						{/snippet}
					</SidebarUI.MenuButton>
					<SidebarUI.MenuBadge
						class="text-[11px] font-normal text-muted-foreground/40 tabular-nums"
						>{getSource(folderId)?.getCount() ?? 0}</SidebarUI.MenuBadge
					>
				</SidebarUI.MenuItem>
			</ContextMenu.Trigger>
			{@render contextMenu()}
		</ContextMenu.Root>
	{/if}
{/if}

{#snippet contextMenu()}
	<ContextMenu.Content class="w-36">
		{#if mode === 'trash'}
			<!-- Deleted folder in trash tree -->
			<ContextMenu.Item
				class="text-[13px]"
				onSelect={() => folderStore.recoverFolderAndChildren(folderId)}
				>Recover Folder</ContextMenu.Item
			>
			<ContextMenu.Separator />
			<ContextMenu.Item
				class="text-[13px] text-destructive focus:text-destructive"
				onSelect={() =>
					uiStore.confirmFolderPermanentDelete(folder?.title ?? '', () =>
						folderStore.permanentDeleteFolderAndChildren(folderId)
					)}>Delete Permanently</ContextMenu.Item
			>
		{:else}
			<!-- Live folder -->
			<ContextMenu.Item
				class="text-[13px]"
				onSelect={() => folderStore.createFolder(folderId)}>New Folder</ContextMenu.Item
			>
			{#if capabilities?.canRename}
				<ContextMenu.Item
					class="text-[13px]"
					onSelect={() => folderStore.startRename(folderId)}>Rename</ContextMenu.Item
				>
			{/if}
			{#if capabilities?.canDelete}
				<ContextMenu.Separator />
				<ContextMenu.Item
					class="text-[13px] text-destructive focus:text-destructive"
					onSelect={() =>
						uiStore.confirmFolderDelete(folder?.title ?? '', () =>
							folderStore.deleteFolder(folderId)
						)}>Delete</ContextMenu.Item
				>
			{/if}
		{/if}
	</ContextMenu.Content>
{/snippet}
