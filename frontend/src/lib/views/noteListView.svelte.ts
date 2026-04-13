import { groupNotesByDate } from '$lib/utils';
import { folderStore, type FolderID, type FolderItem, type SidebarKind } from '$lib/stores/folders.svelte';
import { notesStore, type NoteItem } from '$lib/stores/notes.svelte';
import { folderService, noteService } from '$lib/stores/services';
import { selectionStore } from '$lib/stores/selection.svelte';

export class NoteListView {
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

	canCreateNote() {
		const selectedFolder = this.selection.getSelectedFolder();
		return selectedFolder?.kind !== 'trash' && selectedFolder?.kind !== 'favorites';
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

	getFilteredNotes(searchQuery: string) {
		const normalizedQuery = searchQuery.trim().toLowerCase();
		const selectedFolder = this.selection.getSelectedFolder();
		const visibleNotes = this.noteQueries.getNotesForFolder(
			this.selection.selectedFolderID ?? null,
			selectedFolder?.kind
		);

		if (!normalizedQuery) return visibleNotes;

		return visibleNotes.filter(
			(note) =>
				note.title.toLowerCase().includes(normalizedQuery) ||
				note.content.toLowerCase().includes(normalizedQuery)
		);
	}

	getSections(searchQuery: string) {
		return groupNotesByDate(this.getFilteredNotes(searchQuery));
	}

	getRestoreContext(note: NoteItem | null) {
		if (!note?.folderId) {
			return { isHierarchical: false, topDeletedAncestor: null };
		}

		const topDeletedAncestor = this.folderQueries.findTopDeletedAncestor(note.folderId);
		return {
			isHierarchical: !!topDeletedAncestor,
			topDeletedAncestor
		};
	}
}

export const noteListView = new NoteListView();
