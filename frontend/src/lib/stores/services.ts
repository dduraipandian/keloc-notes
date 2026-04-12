import { folderStore, type FolderID, type FolderItem } from './folders.svelte';
import { notesStore, type NoteID, type NoteItem } from './notes.svelte';

type FolderStoreLike = {
	findItemById(id: FolderID): FolderItem | null;
	findTopDeletedAncestor(folderId: FolderID): FolderItem | null;
	getDefaultFolderId(): FolderID;
	createFolder(): void;
	deleteFolder(id: FolderID, batchTimestamp?: number): void;
	recoverFolderAndChildren(id: FolderID, targetBatch?: number): void;
	permanentDeleteFolderAndChildren(id: FolderID, targetBatch?: number): Promise<void>;
	emptyTrash(): Promise<void>;
};

type NotesStoreLike = {
	createNote(folderId: FolderID | null): void;
	getNote(id: NoteID): NoteItem | null;
	recoverNote(id: NoteID, recoverFolder?: boolean): void;
	permanentDeleteNote(id: NoteID): Promise<void>;
};

export class FolderService {
	constructor(private readonly folders: FolderStoreLike = folderStore) {}

	create() {
		this.folders.createFolder();
	}

	delete(folderId: FolderID, batchTimestamp?: number) {
		this.folders.deleteFolder(folderId, batchTimestamp);
	}
}

export class NoteService {
	constructor(
		private readonly folders: FolderStoreLike = folderStore,
		private readonly notes: NotesStoreLike = notesStore
	) {}

	create(folderId: FolderID | null) {
		let actualFolderId = folderId;
		const folder = folderId ? this.folders.findItemById(folderId) : null;

		if (!folderId || folder?.type === 'all' || folder?.type === 'trash') {
			actualFolderId = this.folders.getDefaultFolderId();
		}

		this.notes.createNote(actualFolderId);
	}
}

export class TrashService {
	constructor(
		private readonly folders: FolderStoreLike = folderStore,
		private readonly notes: NotesStoreLike = notesStore
	) {}

	recoverFolder(folderId: FolderID, targetBatch?: number) {
		this.folders.recoverFolderAndChildren(folderId, targetBatch);
	}

	recoverNote(noteId: NoteID) {
		const note = this.notes.getNote(noteId);
		if (!note) return;

		const isHierarchical = !!(note.folderId && this.folders.findTopDeletedAncestor(note.folderId));
		this.notes.recoverNote(noteId, isHierarchical);
	}

	permanentlyDeleteFolder(folderId: FolderID, targetBatch?: number) {
		return this.folders.permanentDeleteFolderAndChildren(folderId, targetBatch);
	}

	permanentlyDeleteNote(noteId: NoteID) {
		return this.notes.permanentDeleteNote(noteId);
	}

	empty() {
		return this.folders.emptyTrash();
	}
}

export const folderService = new FolderService();
export const noteService = new NoteService();
export const trashService = new TrashService();
