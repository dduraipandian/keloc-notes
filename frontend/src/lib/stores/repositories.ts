import type { FolderItem } from './folders.svelte';
import type { NoteItem } from './notes.svelte';
import {
	getAllFolders,
	getAllNotes,
	getAllSettings,
	permanentDeleteFolderTransactionally,
	permanentDeleteNoteTransactionally,
	putFolder,
	putNote,
	putSetting
} from './idbr';

export const foldersRepository = {
	list(): Promise<FolderItem[]> {
		return getAllFolders();
	},
	save(folder: FolderItem) {
		return putFolder(folder);
	}
};

export const notesRepository = {
	list(): Promise<NoteItem[]> {
		return getAllNotes();
	},
	save(note: NoteItem) {
		return putNote(note);
	}
};

export const settingsRepository = {
	getAll() {
		return getAllSettings();
	},
	save(property: string, value: unknown) {
		return putSetting(property, value);
	}
};

export const trashRepository = {
	permanentlyDeleteFolderTree(
		notesToDelete: { note: NoteItem; path: string }[],
		foldersToDelete: FolderItem[],
		archivedAt: number
	) {
		return permanentDeleteFolderTransactionally(notesToDelete, foldersToDelete, archivedAt);
	},
	permanentlyDeleteNote(note: NoteItem, path: string, archivedAt: number) {
		return permanentDeleteNoteTransactionally(note, path, archivedAt);
	}
};
