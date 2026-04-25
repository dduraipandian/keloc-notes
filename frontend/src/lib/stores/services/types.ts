import type { FolderID, FolderItem } from '../folders.svelte';
import type { NoteID, NoteItem } from '../notes.svelte';

export type FolderStoreLike = {
	items: FolderID[];
	folders: Map<FolderID, FolderItem>;
	findItemById(id: FolderID): FolderItem | null;
	getDefaultFolderId(): FolderID;
	createFolder(parentId?: FolderID | null): FolderID;
	startRename(id: FolderID): void;
	cancelRename(): void;
	renameFolder(id: FolderID, newTitle: string): void;
	openFolder(id: FolderID): void;
	setFavorite(id: FolderID, isFavorite: boolean): void;
	deleteFolder(id: FolderID, deletedAt?: number, deletedBatchId?: string): void;
	restoreFolder(id: FolderID, targetBatchId?: string): void;
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
	createNote(folderId: FolderID | null): NoteItem;
	updateNote(
		id: NoteID,
		updates: Partial<Omit<NoteItem, 'id'>>,
		opts?: { updatedTimestamp?: boolean }
	): void;
	deleteNote(id: NoteID, deletedAt?: number, deletedBatchId?: string): void;
	selectNote(id: NoteID | null): void;
	setFavorite(id: NoteID, isFavorite: boolean): void;
	getNote(id: NoteID): NoteItem | null;
	listNotes(): NoteItem[];
	restoreNote(id: NoteID, folderId?: FolderID | null): void;
	restoreNotesInFolder(folderId: FolderID, targetBatchId?: string): void;
	getNotesToArchive(folderId: FolderID, targetBatchId: string): NoteItem[];
	getDeletedNotes(): NoteItem[];
	deleteNotesInFolder(folderId: FolderID, deletedAt: number, deletedBatchId: string): void;
	removeNoteLocally(id: NoteID): void;
	clearSelectionIfSelected(id: NoteID): void;
	getNoteCount(folderId: FolderID | null, profileId?: string): number;
	getBulkNoteContents(ids: NoteID[]): Promise<Record<NoteID, string>>;
	vacuumSearchIndex(): Promise<void>;
};
