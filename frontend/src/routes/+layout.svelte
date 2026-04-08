<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { folderStore } from '$lib/stores/folders.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import AppSidebar from '$lib/components/Sidebar.svelte';

	let { children } = $props();

	onMount(() => {
		folderStore.init();
	});
</script>

<div class="dark min-h-screen bg-background text-foreground">
	<Sidebar.Provider>
		<AppSidebar />
		<main class="flex-1 overflow-auto">
			<Sidebar.Trigger />
			{@render children?.()}
		</main>
	</Sidebar.Provider>
</div>