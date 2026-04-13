import { folderStore, type FolderID, type FolderType } from '../folders.svelte';
import { notesStore, type NoteID, type NoteItem } from '../notes.svelte';
import { selectionStore } from '../selection.svelte';
import type { FolderStoreLike, NotesStoreLike, SelectionStoreLike } from './types';
import { FolderTreeHelper } from '../domain/folderTree';

export class NoteService {
	private readonly tree: FolderTreeHelper;
	private readonly selection: SelectionStoreLike;

	constructor(
		private readonly folders: FolderStoreLike = folderStore,
		private readonly notes: NotesStoreLike = notesStore,
		selection: SelectionStoreLike = selectionStore
	) {
		this.tree = new FolderTreeHelper(folders, notes);
		this.selection = selection;
	}

	create(folderId: FolderID | null) {
		let actualFolderId = folderId;
		const folder = folderId ? this.folders.findItemById(folderId) : null;

		if (!folderId || folder?.type === 'all' || folder?.type === 'trash' || folder?.type === 'system') {
			actualFolderId = this.folders.getDefaultFolderId();
		}

		this.selection.selectFolder(actualFolderId);
		this.notes.createNote(actualFolderId);
	}

	update(noteId: NoteID, updates: Partial<Omit<NoteItem, 'id'>>) {
		this.notes.updateNote(noteId, updates);
	}

	select(noteId: NoteID | null) {
		this.notes.selectNote(noteId);
	}

	delete(noteId: NoteID, batchTimestamp?: number) {
		const currentFolder = this.selection.getSelectedFolder();
		const visibleNotes = this.tree.getNotesForFolder(
			this.selection.selectedFolderID ?? null,
			currentFolder?.type
		);
		const currentIndex = visibleNotes.findIndex((note) => note.id === noteId);
		const nextNoteId =
			currentIndex >= 0 ? (visibleNotes[currentIndex + 1]?.id ?? null) : null;

		this.notes.deleteNote(noteId, batchTimestamp);
		this.notes.selectNote(nextNoteId);
	}

	setFavorite(noteId: NoteID, isFavorite: boolean) {
		this.notes.setFavorite(noteId, isFavorite);
	}

	getNotesForFolder(folderId: FolderID | null, folderType?: FolderType) {
		if (folderId === 'favorites') {
			return this.notes
				.listNotes()
				.filter((note) => note.deletedAt == null && note.isFavorite === true)
				.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
		}
		return this.tree.getNotesForFolder(folderId, folderType);
	}

	getNoteCountForFolder(folderId: FolderID | null, folderType?: FolderType) {
		return this.getNotesForFolder(folderId, folderType).length;
	}
}
