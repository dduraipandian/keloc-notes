<script lang="ts">
	import FolderPlus from '@lucide/svelte/icons/folder-plus';
	import * as SidebarUI from '$lib/components/ui/sidebar/index.js';
	import { folderStore } from '$lib/stores/folders.svelte';
	import { selectionStore } from '$lib/stores/selection.svelte';
	import VirtualViewsList from './sidebar/VirtualViewsList.svelte';
	import FolderNode from './sidebar/FolderNode.svelte';
</script>

<SidebarUI.Root collapsible="none" class="h-full w-64 border-r-0 bg-sidebar/40">
	<SidebarUI.Header>
		<SidebarUI.Menu class="pt-6">
			<VirtualViewsList />
		</SidebarUI.Menu>
	</SidebarUI.Header>

	<SidebarUI.Content class="pt-0">
		<SidebarUI.Group>
			<SidebarUI.GroupLabel
				class="mb-2 px-4 text-[10px] font-bold tracking-[0.15em] text-muted-foreground/40 uppercase"
				>Folders</SidebarUI.GroupLabel
			>
			<SidebarUI.GroupContent>
				<SidebarUI.Menu>
					{#each folderStore.items as folderId (folderId)}
						<FolderNode {folderId} />
					{/each}
				</SidebarUI.Menu>
			</SidebarUI.GroupContent>
		</SidebarUI.Group>
	</SidebarUI.Content>

	<SidebarUI.Footer class="mt-auto border-t-0 pb-6 pl-6">
		<SidebarUI.Menu>
			<SidebarUI.MenuItem>
				<SidebarUI.MenuButton class="px-2 transition-none hover:bg-transparent">
					{#snippet child({ props })}
						<button
							type="button"
							class="group flex items-center gap-2 text-[13px] font-medium text-foreground/80 hover:text-foreground"
							onclick={() => {
								// Create folder under the current selection if it's a real folder
								const src = selectionStore.currentSource;
								const parentId = src?.kind === 'folder' ? src.id : null;
								folderStore.createFolder(parentId);
							}}
						>
							<FolderPlus size={18} class="text-[#f5d04e] transition-transform active:scale-95" />
							<span>New Folder</span>
						</button>
					{/snippet}
				</SidebarUI.MenuButton>
			</SidebarUI.MenuItem>
		</SidebarUI.Menu>
	</SidebarUI.Footer>
</SidebarUI.Root>
