<script lang="ts">
	import { activatePaneOnClick } from '$lib/actions/activatePaneOnClick';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Empty from '$lib/components/ui/empty/index.js';
	import Info from '@lucide/svelte/icons/info';
	import { getUIStore, getSelectionStore, getTrashService, getNotesStore, getFolderStore, getFolderService, getSearchService, getNoteService } from '$lib/stores/context';
	import { NoteListView } from '$lib/views/noteListView.svelte';
	import Editor from '$lib/components/Editor.svelte';
	import Alert from './alert.svelte';

	const notesStore = getNotesStore();
	let selectedNote = $derived(notesStore.selectedNote);
	const uiStore = getUIStore();
	const selectionStore = getSelectionStore();
	const folderStore = getFolderStore();
	const noteService = getNoteService();
	const folderService = getFolderService();
	const trashService = getTrashService();
	const searchService = getSearchService();
	const noteListView = new NoteListView(
		{ selection: selectionStore },
		folderStore,
		notesStore,
		folderService,
		noteService,
		searchService
	);

	let restoreContext = $derived(noteListView.getRestoreContext(selectedNote));
	const visibleNoteIds = $derived(noteListView.getVisibleNoteIds());

	function handleRestoreInit() {
		if (!selectedNote) return;

		uiStore.confirmNoteRestore(selectedNote.title, () => {
			trashService.recoverNote(selectedNote!.id);
		});
	}

	$effect(() => {
		if (selectedNote && !selectedNote.isContentLoaded) {
			notesStore.loadNoteContent(selectedNote.id);
		}
	});
</script>

{#if selectedNote}
	<div
		class="flex h-full animate-in flex-col bg-card duration-500 fade-in"
		data-testid="editor-pane"
		use:activatePaneOnClick={'editor'}
	>
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
			<div class="flex min-h-full w-full flex-col px-12 pb-5">
				<!-- Main Editor Body -->
				{#if selectedNote.isContentLoaded}
					{#key selectedNote.id}
						<Editor note={selectedNote} readonly={selectedNote.deletedAt != null} />
					{/key}
				{:else}
					<div class="editor-loading-skeleton flex-1 animate-pulse bg-muted/50"></div>
				{/if}
			</div>
		</div>
	</div>
{:else}
	<div
		class="flex h-full animate-in flex-col items-center justify-center bg-card/50 duration-1000 zoom-in-95"
		data-testid="editor-pane"
		use:activatePaneOnClick={'editor'}
	>
		<Empty.Root class="min-h-0 border-transparent bg-transparent text-muted-foreground/20">
			<Empty.Header>
				<Empty.Media class="relative mb-2 flex h-20 w-20 items-center justify-center rounded-3xl bg-accent/5" variant="default">
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
				</Empty.Media>
				<Empty.Title class="text-[10px] font-bold tracking-[0.3em] uppercase opacity-40">
					Select a note to view
				</Empty.Title>
				<Empty.Description class="mt-1 max-w-64 text-xs leading-relaxed text-muted-foreground/60">
					{#if visibleNoteIds.length === 0}
						Create a folder, add your first note, and it will open here.
					{:else}
						Choose a note from the list to start editing.
					{/if}
				</Empty.Description>
			</Empty.Header>
		</Empty.Root>
	</div>
{/if}

<Alert dialog={uiStore.noteDialog} />
<Alert dialog={uiStore.folderDialog} />

<style>
</style>
