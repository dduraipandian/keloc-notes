import { groupNotesByDate } from '$lib/utils';
import { folderStore, type FolderID, type FolderItem, type FolderType } from '$lib/stores/folders.svelte';
import { notesStore, type NoteItem } from '$lib/stores/notes.svelte';
import { folderService, noteService } from '$lib/stores/services';
import { selectionStore } from '$lib/stores/selection.svelte';
import type { NoteSource } from '$lib/stores/sources/types';

type FolderStoreLike = {
	items: FolderID[];
	editingId?: FolderID | null;
	folders: Map<FolderID, FolderItem>;
};

type NotesStoreLike = {
	selectedNote: NoteItem | null;
	selectedNoteID: string | null;
};

type SelectionStoreLike = {
	selectedFolderID: FolderID | null;
	currentSource?: NoteSource | null;
	getSelectedFolder(): FolderItem | null;
};

type FolderServiceLike = {
	findTopDeletedAncestor(folderId: FolderID): FolderItem | null;
};

type NoteServiceLike = {
	getNotesForFolder(folderId: FolderID | null, folderType?: FolderType): NoteItem[];
	getNoteCountForFolder(folderId: FolderID | null, folderType?: FolderType): number;
};

export class NoteListPresenter {
	constructor(
		private readonly folders: FolderStoreLike = folderStore,
		private readonly notes: NotesStoreLike = notesStore,
		private readonly folderQueries: FolderServiceLike = folderService,
		private readonly noteQueries: NoteServiceLike = noteService,
		private readonly selection: SelectionStoreLike = selectionStore
	) {}

	getSelectedFolderTitle() {
		return this.selection.getSelectedFolder()?.title ?? 'Notes';
	}

	canCreateNote() {
		if (this.selection.currentSource) {
			return this.selection.currentSource.capabilities.canCreateNote;
		}

		const selectedFolder = this.selection.getSelectedFolder();
		return (
			selectedFolder?.type !== 'trash' &&
			selectedFolder?.type !== 'system' &&
			selectedFolder?.type !== 'all'
		);
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
			selectedFolder?.type
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

export const noteListPresenter = new NoteListPresenter();
