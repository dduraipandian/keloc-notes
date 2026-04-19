import {
	getAllFolders,
	getAllNotesMeta,
	getAllSettings,
	getBulkNoteContents,
	getNoteContent,
	permanentDeleteFolderTransactionally,
	permanentDeleteNoteTransactionally,
	putFolder,
	putNoteContent,
	putNoteMeta,
	putSetting
} from './idbr';
import type { FolderItem } from '../stores/folders.svelte';
import type { NoteID, NoteItem, NoteMeta } from '../stores/notes.svelte';

export const foldersRepository = {
	list(): Promise<FolderItem[]> {
		return getAllFolders();
	},
	save(folder: FolderItem) {
		return putFolder(folder);
	}
};

export const notesRepository = {
	list(): Promise<NoteMeta[]> {
		return getAllNotesMeta();
	},
	saveMeta(meta: NoteMeta) {
		return putNoteMeta(meta);
	},
	saveContent(id: NoteID, content: string) {
		return putNoteContent(id, content);
	},
	getContent(id: NoteID): Promise<string> {
		return getNoteContent(id);
	},
	getBulkContents(ids: NoteID[]): Promise<Record<string, string>> {
		return getBulkNoteContents(ids);
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
