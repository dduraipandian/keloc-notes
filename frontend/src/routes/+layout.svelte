<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { folderStore } from '$lib/stores/folders.svelte';
	import { notesStore } from '$lib/stores/notes.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import Alert from './alert.svelte';
	import Folders from '$lib/components/Folders.svelte';
	import NoteItems from '$lib/components/NoteItems.svelte';
	import { Quit } from '$lib/wailsjs/runtime/runtime';
	import { uiStore } from '$lib/stores/dialog.svelte';

	let { children } = $props();

	let initError = $state<string | null>(null);

	onMount(async () => {
		try {
			await folderStore.init();
			await notesStore.init();
		} catch (err) {
			initError = err instanceof Error ? err.message : 'An unexpected error occurred.';
			uiStore.confirmAppQuit('Failed to Start', initError, Quit);
		}
	});
</script>

<div class="dark h-screen overflow-hidden bg-background text-foreground">
	<Sidebar.Provider class="h-full">
		<Folders />
		<NoteItems />
		<main class="flex-1 border-l border-sidebar-border/10 bg-card">
			{@render children?.()}
		</main>
	</Sidebar.Provider>
</div>

<Alert dialog={uiStore.appDialog} />
