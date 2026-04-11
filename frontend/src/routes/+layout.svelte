<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { folderStore } from '$lib/stores/folders.svelte';
	import { notesStore } from '$lib/stores/notes.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import Folders from '$lib/components/Folders.svelte';
	import NoteItems from '$lib/components/NoteItems.svelte';
	import { Quit } from '$lib/wailsjs/runtime/runtime';

	let { children } = $props();

	let initError = $state<string | null>(null);

	onMount(async () => {
		try {
			await folderStore.init();
			await notesStore.init();
		} catch (err) {
			initError = err instanceof Error ? err.message : 'An unexpected error occurred.';
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

<AlertDialog.Root open={initError !== null}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Failed to Start</AlertDialog.Title>
			<AlertDialog.Description>
				mdnotes could not load your data. This is usually caused by a corrupted database or
				insufficient storage permissions.
				<br /><br />
				<span class="font-mono text-xs text-destructive">{initError}</span>
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Action class="bg-destructive hover:bg-destructive/90" onclick={() => Quit()}>
				Quit Application
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
