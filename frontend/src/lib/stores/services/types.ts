import type { FolderID, FolderItem } from '../folders.svelte';
import type { NoteID, NoteItem } from '../notes.svelte';

export type FolderStoreLike = {
	items: FolderID[];
	folders: Map<FolderID, FolderItem>;
	findItemById(id: FolderID): FolderItem | null;
	getDefaultFolderId(): FolderID;
	createFolder(parentId?: FolderID | null): FolderID | void;
	startRename(id: FolderID): void;
	cancelRename(): void;
	renameFolder(id: FolderID, newTitle: string): void;
	openFolder(id: FolderID): void;
	setFavorite(id: FolderID, isFavorite: boolean): void;
	deleteFolder(id: FolderID, batchTimestamp?: number): void;
	restoreFolder(id: FolderID, targetBatch?: number): void;
	rootFolderIfParentMissing(id: FolderID): void;
	applyPermanentDeleteState(foldersToDelete: FolderItem[]): void;
	trashItems: FolderID[];
};

export type SelectionStoreLike = {
	selectedFolderID: FolderID | null;
	selectFolder(id: FolderID | null, persist?: boolean): void;
	getSelectedFolder(): FolderItem | null;
	clearFolderIfSelected(id: FolderID): void;
};

export type NotesStoreLike = {
	createNote(folderId: FolderID | null): void;
	updateNote(id: NoteID, updates: Partial<Omit<NoteItem, 'id'>>): void;
	deleteNote(id: NoteID, batchTimestamp?: number): void;
	selectNote(id: NoteID | null): void;
	setFavorite(id: NoteID, isFavorite: boolean): void;
	getNote(id: NoteID): NoteItem | null;
	listNotes(): NoteItem[];
	restoreNote(id: NoteID, folderId?: FolderID | null): void;
	restoreNotesInFolder(folderId: FolderID, targetBatch?: number): void;
	getNotesToArchive(folderId: FolderID, targetBatch: number): NoteItem[];
	getDeletedNotes(): NoteItem[];
	deleteNotesInFolder(folderId: FolderID, batchTimestamp: number): void;
	removeNoteLocally(id: NoteID): void;
	clearSelectionIfSelected(id: NoteID): void;
	getNoteCount(folderId: FolderID | null, profileId?: string): number;
};
