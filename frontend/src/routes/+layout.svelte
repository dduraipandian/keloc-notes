<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { folderStore } from '$lib/stores/folders.svelte';
	import { notesStore } from '$lib/stores/notes.svelte';
	import { selectionStore } from '$lib/stores/selection.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import Alert from './alert.svelte';
	import SidebarPanel from '$lib/components/Sidebar.svelte';
	import NoteItems from '$lib/components/NoteItems.svelte';
	import { Quit } from '$lib/wailsjs/runtime/runtime';
	import { uiStore } from '$lib/stores/dialog.svelte';

	let { children } = $props();

	let initError = $state<string | null>(null);

	onMount(async () => {
		try {
			await folderStore.init();
			await notesStore.init();
			// selectionStore reads 'selectedFolderID' from settings; must come after
			// folderStore.init() so the registry can resolve the persisted id.
			await selectionStore.init();
		} catch (err) {
			initError = err instanceof Error ? err.message : 'An unexpected error occurred.';
			uiStore.confirmAppQuit('Failed to Start', initError, Quit);
		}
	});
</script>

<div class="dark h-screen overflow-hidden bg-background text-foreground">
	<Sidebar.Provider class="h-full">
		<SidebarPanel />
		<NoteItems />
		<main class="flex-1 border-l border-sidebar-border/10 bg-card">
			{@render children?.()}
		</main>
	</Sidebar.Provider>
</div>

<Alert dialog={uiStore.appDialog} />
