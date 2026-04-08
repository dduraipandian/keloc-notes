<script lang="ts">
	import Search from '@lucide/svelte/icons/search';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import SquarePen from '@lucide/svelte/icons/square-pen';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Item from '$lib/components/ui/item/index.js';
	import { folderStore } from '$lib/stores/folders.svelte';
	import { notesStore, type NoteItem } from '$lib/stores/notes.svelte';

	let searchQuery = $state('');

	const filteredNotes = $derived(
		notesStore
			.getNotesForFolder(folderStore.selectedItem?.id ?? null)
			.filter(
				(n) =>
					n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
					n.content.toLowerCase().includes(searchQuery.toLowerCase())
			)
	);

	function formatDate(dateStr: string) {
		const date = new Date(dateStr);
		const now = new Date();
		const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 3600 * 24));

		if (diffDays === 0) return 'Today';
		if (diffDays === 1) return 'Yesterday';
		if (diffDays < 7) return date.toLocaleDateString(undefined, { weekday: 'long' });
		return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
	}

	function getTime(dateStr: string) {
		return new Date(dateStr).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
	}

	// Grouping logic
	const sections = $derived(() => {
		const groups: Record<string, NoteItem[]> = {};
		filteredNotes.forEach((note) => {
			const label = formatDate(note.updatedAt);
			if (!groups[label]) groups[label] = [];
			groups[label].push(note);
		});
		return Object.entries(groups);
	});
</script>

<aside class="relative z-0 flex h-full w-[350px] flex-col">
	<!-- Header -->
	<header class="flex h-[52px] shrink-0 items-center justify-between gap-2 px-6">
		<div class="flex min-w-0 items-center gap-2 overflow-hidden">
			<h2 class="truncate text-xs font-bold tracking-wider text-muted-foreground/60 uppercase">
				{folderStore.selectedItem?.title ?? 'Notes'}
			</h2>
		</div>
		<div class="flex shrink-0 items-center gap-1">
			<button
				class="rounded-sm p-1.5 text-muted-foreground transition-colors hover:bg-accent"
				onclick={() => notesStore.createNote(folderStore.selectedItem?.id ?? null)}
				title="New Note"
			>
				<SquarePen size={16} />
			</button>
			<button
				class="rounded-sm p-1.5 text-muted-foreground transition-colors hover:bg-accent"
				title="Trash"
			>
				<Trash2 size={16} />
			</button>
		</div>
	</header>

	<div class="flex flex-1 flex-col overflow-hidden">
		<div class="shrink-0 px-3 pb-4">
			<div class="group relative">
				<Search
					class="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40 transition-colors group-focus-within:text-foreground/80"
				/>
				<Input
					bind:value={searchQuery}
					placeholder="Search notes..."
					class="h-[34px] rounded-sm border-none bg-accent/25 pl-10 text-sm placeholder:text-muted-foreground/40 focus-visible:ring-0"
				/>
			</div>
		</div>
		<div class="custom-scrollbar flex-1 overflow-y-auto px-4 pb-8">
			{#each sections() as [label, notes]}
				<Item.Group>
					<Item.Header class="mt-6 px-3">
						<span
							class="text-[10px] font-bold tracking-[0.15em] text-muted-foreground/40 uppercase"
						>
							{label}
						</span>
					</Item.Header>
					{#each notes as note, i (note.id)}
						{@const isSelected = notesStore.selectedNoteId === note.id}
						<Item.Root
							variant={isSelected ? 'muted' : 'default'}
							class="rounded-md"
							onclick={() => notesStore.selectNote(note.id)}
						>
							<Item.Content>
								<Item.Title class="flex w-full items-center gap-2 overflow-hidden">
									<span class="flex-1 truncate text-sm font-semibold text-foreground/90">
										{note.title || 'Untitled Note'}
									</span>
									<span class="shrink-0 text-[10px] text-muted-foreground/50 tabular-nums">
										{getTime(note.updatedAt)}
									</span>
								</Item.Title>
								<Item.Description>
									{note.content || 'No additional text'}
								</Item.Description>
							</Item.Content>
						</Item.Root>
					{/each}
				</Item.Group>
			{/each}
		</div>
	</div>
</aside>

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 2px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background-color: transparent;
		border-radius: 10px;
	}
	.custom-scrollbar:hover::-webkit-scrollbar-thumb {
		background-color: hsl(var(--muted-foreground) / 0.1);
	}
</style>
