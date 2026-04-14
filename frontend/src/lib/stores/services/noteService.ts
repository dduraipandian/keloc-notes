import { folderStore, type FolderID } from '../folders.svelte';
import { notesStore, type NoteID, type NoteItem } from '../notes.svelte';
import { selectionStore } from '../selection.svelte';
import type { FolderStoreLike, NotesStoreLike, SelectionStoreLike } from './types';
import { FolderTreeHelper } from '../domain/folderTree';
import { resolveProfile } from '../domain/profiles';

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
		const actualFolderId = (folderId === 'home' || folderId === null) ? null : folderId;
		const folder = actualFolderId ? this.folders.findItemById(actualFolderId) : this.folders.findItemById('home');

		if (!folder || !resolveProfile(folder).capabilities.createNote) {
			const defaultId = this.folders.getDefaultFolderId();
			this.selection.selectFolder(defaultId);
			this.notes.createNote(defaultId);
		} else {
			this.selection.selectFolder(folderId);
			this.notes.createNote(folderId);
		}
	}

	update(noteId: NoteID, updates: Partial<Omit<NoteItem, 'id'>>, opts?: { updatedTimestamp?: boolean }) {
		this.notes.updateNote(noteId, updates, opts);
	}

	select(noteId: NoteID | null) {
		this.notes.selectNote(noteId);
	}

	delete(noteId: NoteID, batchTimestamp?: number) {
		const currentFolder = this.selection.getSelectedFolder();
		const visibleNotes = this.tree.getNotesForFolder(
			this.selection.selectedFolderID ?? null,
			currentFolder?.profile
		);
		const currentIndex = visibleNotes.findIndex((note) => note.id === noteId);
		let nextNoteId: NoteID | null = null;

		if (currentIndex >= 0) {
			if (visibleNotes[currentIndex + 1]) {
				nextNoteId = visibleNotes[currentIndex + 1].id;
			} else if (visibleNotes[currentIndex - 1]) {
				nextNoteId = visibleNotes[currentIndex - 1].id;
			}
		}

		this.notes.deleteNote(noteId, batchTimestamp);
		this.notes.selectNote(nextNoteId);
	}

	setFavorite(noteId: NoteID, isFavorite: boolean) {
		this.notes.setFavorite(noteId, isFavorite);
	}

	getNotesForFolder(folderId: FolderID | null, folderProfile?: string) {
		return this.tree.getNotesForFolder(folderId, folderProfile);
	}

	getNoteCountForFolder(folderId: FolderID | null, folderProfile?: string) {
		return this.notes.getNoteCount(folderId, folderProfile);
	}
}
