<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { folderStore } from '$lib/stores/folders.svelte';
	import { notesStore } from '$lib/stores/notes.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import Folders from '$lib/components/Folders.svelte';
	import NoteItems from '$lib/components/NoteItems.svelte';

	let { children } = $props();

	onMount(() => {
		folderStore.init();
		notesStore.init();
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
