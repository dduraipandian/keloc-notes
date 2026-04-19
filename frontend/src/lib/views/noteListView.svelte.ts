import { groupNotesByDate } from '$lib/utils/utils';
import { folderStore, type FolderID, type FolderItem } from '$lib/stores/folders.svelte';
import { notesStore, type NoteItem } from '$lib/stores/notes.svelte';
import { folderService, noteService } from '$lib/stores/services';
import { selectionStore } from '$lib/stores/selection.svelte';
import { resolveProfile, getProfileId } from '$lib/stores/domain/profiles';
import { searchService } from '$lib/stores/services';

export class NoteListView {
	searchQuery = $state('');
	debouncedSearchQuery = $state('');
	private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(
		private readonly folders = folderStore,
		private readonly notes = notesStore,
		private readonly folderQueries = folderService,
		private readonly noteQueries = noteService,
		private readonly selection = selectionStore
	) {}

	getSelectedFolderTitle() {
		return this.selection.getSelectedFolder()?.title ?? 'Notes';
	}

	getSelectedFolderProfileId(): string {
		const folder = this.selection.getSelectedFolder();
		return folder ? getProfileId(folder) : 'regular';
	}

	canCreateNote() {
		const selectedFolder = this.selection.getSelectedFolder();
		if (!selectedFolder) return true; // Default to allowing creation at root (Home)
		return resolveProfile(selectedFolder).capabilities.createNote;
	}

	canDeleteSelectedNote() {
		return !!(this.notes.selectedNote && this.notes.selectedNote.deletedAt == null);
	}

	getSelectedNoteDeleteContext() {
		if (!this.canDeleteSelectedNote() || !this.notes.selectedNoteID || !this.notes.selectedNote) {
			return null;
		}

		return {
			id: this.notes.selectedNoteID,
			title: this.notes.selectedNote.title
		};
	}

	isSelectedNote(noteId: string) {
		return this.notes.selectedNoteID === noteId;
	}

	getCreateNoteFolderId() {
		return this.selection.getSelectedFolder()?.id ?? null;
	}

	setSearchQuery(searchQuery: string) {
		this.searchQuery = searchQuery;
		if (this.searchDebounceTimer) {
			clearTimeout(this.searchDebounceTimer);
		}
		this.searchDebounceTimer = setTimeout(() => {
			this.debouncedSearchQuery = this.searchQuery;
			this.searchDebounceTimer = null;
		}, 150);
	}

	getFilteredNotes() {
		const normalizedQuery = this.debouncedSearchQuery.trim().toLowerCase();
		const selectedFolder = this.selection.getSelectedFolder();
		const currentFolderId = this.selection.selectedFolderID ?? null;

		// 1. Fetch visibility-scoped notes (Legacy folder filter)
		const visibleNotes = this.noteQueries.getNotesForFolder(
			currentFolderId,
			selectedFolder?.profile
		);

		if (!normalizedQuery) return visibleNotes;

		// 2. Trigger on-demand indexing for the active hierarchy
		// Note: This is async, results will populate as indexing completes via version reactivity.
		void searchService.ensureFolderIndexed(currentFolderId);

		// 3. Subscription to search service changes
		// This line ensures Svelte re-runs this derived logic when the index updates.
		searchService.version;

		// 4. Perform scoped search
		const searchResultIds = searchService.search(normalizedQuery, currentFolderId);
		
		// 5. Combine results:
		// We prefer search results if found. 
		if (searchResultIds.length > 0) {
			const searchSet = new Set(searchResultIds);
			return this.notes
				.listNotes()
				.filter(note => searchSet.has(note.id));
		}

		// Fallback: Default title search for legacy support and until indexing finishes
		return visibleNotes.filter(
			(note) => note.title.toLowerCase().includes(normalizedQuery)
		);
	}

	getSections() {
		return groupNotesByDate(this.getFilteredNotes());
	}

	getVisibleNoteIds() {
		return this.getSections().flatMap(([, notes]) => notes.map((note) => note.id));
	}

	getRestoreContext(note: NoteItem | null) {
		if (!note?.folderId) {
			return { isHierarchical: false, targetName: 'Home' };
		}

		const parentFolder = this.folders.findItemById(note.folderId);
		const isHomeTarget = !parentFolder || parentFolder.deletedAt != null;

		return {
			isHierarchical: false,
			targetName: isHomeTarget ? 'Home' : parentFolder.title
		};
	}
}


