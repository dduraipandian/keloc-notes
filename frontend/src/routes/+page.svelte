<script lang="ts">
	import { notesStore } from '$lib/stores/notes.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import Info from '@lucide/svelte/icons/info';
	import { uiStore } from '$lib/stores/dialog.svelte';
	import { noteService, trashService } from '$lib/stores/services';
	import { noteListView } from '$lib/views/noteListView.svelte';
	import Alert from './alert.svelte';

	let selectedNote = $derived(notesStore.selectedNote);

	let restoreContext = $derived(noteListView.getRestoreContext(selectedNote));

	function handleRestoreInit() {
		if (!selectedNote) return;

		uiStore.confirmNoteRestore(selectedNote.title, () => {
			trashService.recoverNote(selectedNote!.id);
		});
	}

	function formatDate(dateStr: string) {
		if (!dateStr) return '';
		return new Date(dateStr).toLocaleDateString(undefined, {
			day: 'numeric',
			month: 'long',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

{#if selectedNote}
	<div class="flex h-full animate-in flex-col bg-card duration-500 fade-in">
		{#if selectedNote.deletedAt != null}
			<div
				class="flex shrink-0 items-center justify-between border-b border-destructive/10 bg-destructive/5 px-12 py-3 text-destructive"
			>
				<div class="flex items-center gap-3">
					<Info class="h-4 w-4" />
					<p class="text-sm font-medium">This note is in the Trash. Restore it to edit.</p>
				</div>
				<Button
					variant="outline"
					size="sm"
					class="h-8 border-destructive/20 bg-transparent text-xs hover:bg-destructive/10 hover:text-destructive"
					onclick={handleRestoreInit}
				>
					Restore Note
				</Button>
			</div>
		{/if}
		<div class="custom-scrollbar flex-1 overflow-x-hidden overflow-y-auto">
			<div class="mx-auto flex min-h-full w-full max-w-4xl flex-col px-12 pb-5">
				<!-- Editor Header/Title -->
				<div class="flex shrink-0 flex-col pt-10 pb-6">
					<div
						class="mb-4 flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] text-muted-foreground/30 uppercase"
					>
						<span>{formatDate(selectedNote.updatedAt)}</span>
					</div>
					<textarea
						bind:value={selectedNote.title}
						oninput={() => noteService.update(selectedNote!.id, { title: selectedNote!.title })}
						placeholder="Note Title"
						readonly={selectedNote.deletedAt != null}
						onclick={() => {
							if (selectedNote.deletedAt != null) handleRestoreInit();
						}}
						rows="1"
						class="w-full resize-none bg-transparent text-4xl font-extrabold tracking-tight text-foreground outline-none placeholder:text-muted-foreground/10"
						spellcheck="false"
						onkeydown={(e) => {
							if (e.key === 'Enter') e.preventDefault();
						}}
					></textarea>
				</div>

				<!-- Main Editor Body -->
				<div class="prose prose-lg flex max-w-none flex-1 flex-col dark:prose-invert">
					<!-- Placeholder for future TipTap editor -->
					<textarea
						bind:value={selectedNote.content}
						readonly={selectedNote.deletedAt != null}
						onclick={() => {
							if (selectedNote.deletedAt != null) handleRestoreInit();
						}}
						oninput={() =>
							noteService.update(selectedNote!.id, { content: selectedNote!.content })}
						placeholder="Start writing..."
						class="w-full flex-1 resize-none bg-transparent leading-relaxed text-foreground/90 outline-none placeholder:text-muted-foreground/10"
						spellcheck="false"
					></textarea>
				</div>
			</div>
		</div>
	</div>
{:else}
	<div
		class="flex h-full animate-in flex-col items-center justify-center bg-card/50 text-muted-foreground/20 duration-1000 zoom-in-95"
	>
		<div class="relative mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-accent/5">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="40"
				height="40"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="opacity-10"
			>
				<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
				<polyline points="14 2 14 8 20 8" />
			</svg>
		</div>
		<p class="text-[10px] font-bold tracking-[0.3em] uppercase opacity-40">Select a note to view</p>
	</div>
{/if}

<Alert dialog={uiStore.noteDialog} />
<Alert dialog={uiStore.folderDialog} />

<style>
	textarea {
		font-family: inherit;
	}
</style>
