<script lang="ts">
	import Search from '@lucide/svelte/icons/search';
	import Star from '@lucide/svelte/icons/star';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import SquarePen from '@lucide/svelte/icons/square-pen';
	import { Input } from '$lib/components/ui/input/index.js';
	import type { NoteItem } from '$lib/stores/notes.svelte';
	import { noteService, trashService } from '$lib/stores/services';
	import { noteListView } from '$lib/views/noteListView.svelte';
	import * as Item from '$lib/components/ui/item/index.js';
	import * as ContextMenu from '$lib/components/ui/context-menu/index.js';

	import { uiStore } from '$lib/stores/dialog.svelte';

	let searchQuery = $state('');
	const selectedFolderTitle = $derived(noteListView.getSelectedFolderTitle());
	const filteredNotes = $derived(noteListView.getFilteredNotes(searchQuery));
	const canCreateNote = $derived(noteListView.canCreateNote());
	const canDeleteSelectedNote = $derived(noteListView.canDeleteSelectedNote());
	const selectedNoteDeleteContext = $derived(noteListView.getSelectedNoteDeleteContext());

	function getTime(dateStr: string) {
		return new Date(dateStr).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
	}

	const sections = $derived(noteListView.getSections(searchQuery));

	function handleNoteRestore(note: NoteItem) {
		uiStore.confirmNoteRestore(note.title, () => {
			trashService.recoverNote(note.id);
		});
	}

	function handleNotePermanentDelete(note: NoteItem) {
		uiStore.confirmNotePermanentDelete(note.title, () => {
			trashService.permanentlyDeleteNote(note.id);
		});
	}
</script>

<aside class="relative z-0 flex h-full w-[350px] flex-col">
	<!-- Header -->
	<header class="flex h-[52px] shrink-0 items-center justify-between gap-2 px-6">
		<div class="flex min-w-0 items-center gap-2 overflow-hidden">
			{#if noteListView.getSelectedFolderIconConfig()}
				{@const iconConfig = noteListView.getSelectedFolderIconConfig()}
				<svelte:component
					this={iconConfig.component}
					size={14}
					{...iconConfig.props}
					class="shrink-0 {iconConfig.props.class}"
				/>
			{/if}
			<h2 class="truncate text-xs font-bold tracking-wider text-muted-foreground/60 uppercase">
				{selectedFolderTitle}
			</h2>
		</div>
		<div class="flex shrink-0 items-center gap-1">
			{#if canCreateNote}
				<button
					class="rounded-sm p-1.5 text-muted-foreground transition-colors hover:bg-accent"
					onclick={() => noteService.create(noteListView.getCreateNoteFolderId())}
					title="New Note"
				>
					<SquarePen size={16} />
				</button>
			{/if}
			{#if canDeleteSelectedNote}
				<button
					class="rounded-sm p-1.5 text-muted-foreground transition-colors hover:bg-accent"
					title="Trash"
					onclick={() =>
						uiStore.confirmNoteDelete(selectedNoteDeleteContext!.title, () =>
							noteService.delete(selectedNoteDeleteContext!.id)
						)}
				>
					<Trash2 size={16} />
				</button>
			{/if}
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
			{#each sections as [label, notes]}
				<Item.Group>
					<Item.Header class="mt-6 px-3">
						<span
							class="text-[10px] font-bold tracking-[0.15em] text-muted-foreground/40 uppercase"
						>
							{label}
						</span>
					</Item.Header>
					{#each notes as note, i (note.id)}
						{@const isSelected = noteListView.isSelectedNote(note.id)}
						<ContextMenu.Root>
							<ContextMenu.Trigger>
								<Item.Root
									variant={isSelected ? 'muted' : 'default'}
									onclick={() => noteService.select(note.id)}
								>
									<Item.Content>
										<Item.Title class="flex w-full items-center gap-2 overflow-hidden">
											{#if note.isFavorite}
												<Star size={12} class="shrink-0 fill-[#e0b64b] text-[#e0b64b]" />
											{/if}
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
							</ContextMenu.Trigger>
							{@render ContextMenuContentSnippet(note)}
						</ContextMenu.Root>
					{/each}
				</Item.Group>
			{/each}
		</div>
	</div>
</aside>

{#snippet ContextMenuContentSnippet(note: NoteItem)}
	<ContextMenu.Content class="w-48">
		{#if note.deletedAt != null}
			<ContextMenu.Item class="text-[13px]" onSelect={() => handleNoteRestore(note)}
				>Restore</ContextMenu.Item
			>
			<ContextMenu.Item class="text-[13px]" onSelect={() => handleNotePermanentDelete(note)}
				>Delete Permanently</ContextMenu.Item
			>
		{:else}
			<ContextMenu.Item
				class="text-[13px]"
				onSelect={() => noteService.setFavorite(note.id, note.isFavorite !== true)}
			>
				{note.isFavorite ? 'Remove From Favorites' : 'Add To Favorites'}
			</ContextMenu.Item>
			<ContextMenu.Separator />
			<ContextMenu.Item
				class="text-[13px] text-destructive focus:text-destructive"
				onSelect={() => uiStore.confirmNoteDelete(note.title, () => noteService.delete(note.id))}
				>Delete</ContextMenu.Item
			>
		{/if}
	</ContextMenu.Content>
{/snippet}

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
