import { folderStore, type FolderID, type FolderItem } from './folders.svelte';
import { notesStore, type NoteID, type NoteItem } from './notes.svelte';
import {
	permanentDeleteFolderTransactionally,
	permanentDeleteNoteTransactionally
} from './idbr';

type FolderStoreLike = {
	findItemById(id: FolderID): FolderItem | null;
	findTopDeletedAncestor(folderId: FolderID): FolderItem | null;
	getDefaultFolderId(): FolderID;
	createFolder(): void;
	deleteFolder(id: FolderID, batchTimestamp?: number): void;
	restoreFolder(id: FolderID, targetBatch?: number): void;
	restoreParentPath(parentId: FolderID | null | undefined): void;
	rootFolderIfParentMissing(id: FolderID): void;
	collectFolderSubtree(id: FolderID): FolderItem[];
	applyPermanentDeleteState(foldersToDelete: FolderItem[]): void;
	getFolderPath(id: FolderID): string;
	clearSelectionIfSelected(id: FolderID): void;
	trashItems: FolderID[];
};

type NotesStoreLike = {
	createNote(folderId: FolderID | null): void;
	updateNote(id: NoteID, updates: Partial<Omit<NoteItem, 'id'>>): void;
	deleteNote(id: NoteID, batchTimestamp?: number): void;
	selectNote(id: NoteID | null): void;
	getNote(id: NoteID): NoteItem | null;
	restoreNote(id: NoteID, folderId?: FolderID | null): void;
	restoreNotesInFolder(folderId: FolderID, targetBatch?: number): void;
	getNotesToArchive(folderId: FolderID, targetBatch: number): NoteItem[];
	getDeletedNotes(): NoteItem[];
	deleteNotesInFolder(folderId: FolderID, batchTimestamp: number): void;
	removeNoteLocally(id: NoteID): void;
	clearSelectionIfSelected(id: NoteID): void;
};

export class FolderService {
	constructor(
		private readonly folders: FolderStoreLike = folderStore,
		private readonly notes: NotesStoreLike = notesStore
	) {}

	create() {
		this.folders.createFolder();
	}

	delete(folderId: FolderID, batchTimestamp?: number) {
		const batch = batchTimestamp ?? Date.now();
		this.deleteFolderTree(folderId, batch);
	}

	private deleteFolderTree(folderId: FolderID, batchTimestamp: number) {
		const folder = this.folders.findItemById(folderId);
		if (!folder) return;

		this.folders.deleteFolder(folderId, batchTimestamp);
		this.notes.deleteNotesInFolder(folderId, batchTimestamp);

		for (const childId of folder.items ?? []) {
			this.deleteFolderTree(childId, batchTimestamp);
		}
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

	update(noteId: NoteID, updates: Partial<Omit<NoteItem, 'id'>>) {
		this.notes.updateNote(noteId, updates);
	}

	select(noteId: NoteID | null) {
		this.notes.selectNote(noteId);
	}

	delete(noteId: NoteID, batchTimestamp?: number) {
		this.notes.deleteNote(noteId, batchTimestamp);
	}
}

export class TrashService {
	constructor(
		private readonly folders: FolderStoreLike = folderStore,
		private readonly notes: NotesStoreLike = notesStore
	) {}

	recoverFolder(folderId: FolderID, targetBatch?: number) {
		const folder = this.folders.findItemById(folderId);
		if (!folder || folder.deletedAt == null) return;

		const batch = targetBatch ?? folder.deletedAt;
		this.restoreFolderTree(folderId, batch);

		if (!targetBatch) {
			this.folders.rootFolderIfParentMissing(folderId);
			const currentFolder = this.folders.findItemById(folderId);
			this.folders.restoreParentPath(currentFolder?.parentId);
		}
	}

	recoverNote(noteId: NoteID) {
		const note = this.notes.getNote(noteId);
		if (!note) return;

		const isHierarchical = !!(note.folderId && this.folders.findTopDeletedAncestor(note.folderId));
		let restoredFolderId: FolderID | null | undefined = undefined;

		if (note.folderId) {
			const parentFolder = this.folders.findItemById(note.folderId);
			if (parentFolder) {
				if (parentFolder.deletedAt != null) {
					if (isHierarchical) {
						const topRoot = this.folders.findTopDeletedAncestor(note.folderId);
						if (topRoot) this.recoverFolder(topRoot.id);
					} else {
						restoredFolderId = null;
					}
				}
			} else {
				restoredFolderId = null;
			}
		}

		this.notes.restoreNote(noteId, restoredFolderId);
	}

	async permanentlyDeleteFolder(folderId: FolderID, targetBatch?: number) {
		const folder = this.folders.findItemById(folderId);
		if (!folder || folder.deletedAt == null) return;

		const batch = targetBatch ?? folder.deletedAt;
		const foldersToDelete = this.folders.collectFolderSubtree(folderId);
		const notesToDelete = this.collectFolderNotesWithPaths(foldersToDelete, batch);

		try {
			await permanentDeleteFolderTransactionally(notesToDelete, foldersToDelete, Date.now());
			notesToDelete.forEach(({ note }) => this.notes.removeNoteLocally(note.id));
			this.folders.applyPermanentDeleteState(foldersToDelete);
			this.folders.clearSelectionIfSelected(folderId);
		} catch (error) {
			console.error('Failed to permanently delete folder and children:', error);
			throw error;
		}
	}

	async permanentlyDeleteNote(noteId: NoteID) {
		const note = this.notes.getNote(noteId);
		if (!note) return;

		const folderPath = note.folderId ? this.folders.getFolderPath(note.folderId) : 'root';
		const fullPath = note.folderId ? `${folderPath}/${note.title}:${note.id}` : `${note.title}:${note.id}`;

		try {
			await permanentDeleteNoteTransactionally(structuredClone(note), fullPath, Date.now());
			this.notes.removeNoteLocally(noteId);
			this.notes.clearSelectionIfSelected(noteId);
		} catch (error) {
			console.error('Failed to permanently delete note:', error);
			throw error;
		}
	}

	async empty() {
		const foldersToDelete = this.folders.trashItems.flatMap((id) => this.folders.collectFolderSubtree(id));
		const deletedFolderIds = new Set(foldersToDelete.map((f) => f.id));
		const folderNotes = this.collectFolderNotesWithPaths(foldersToDelete);
		const individualNotes = this.collectAllDeletedNotesWithPaths();
		const seenIds = new Set(folderNotes.map((entry) => entry.note.id));
		const notesToDelete = [
			...folderNotes,
			...individualNotes.filter((entry) => !seenIds.has(entry.note.id))
		];

		try {
			await permanentDeleteFolderTransactionally(notesToDelete, foldersToDelete, Date.now());
			notesToDelete.forEach(({ note }) => this.notes.removeNoteLocally(note.id));
			this.folders.applyPermanentDeleteState(foldersToDelete);
			deletedFolderIds.forEach((id) => this.folders.clearSelectionIfSelected(id));
		} catch (error) {
			console.error('Failed to empty trash:', error);
			throw error;
		}
	}

	private restoreFolderTree(folderId: FolderID, batch: number) {
		const folder = this.folders.findItemById(folderId);
		if (!folder || folder.deletedAt !== batch) return;

		this.folders.restoreFolder(folderId, batch);
		this.notes.restoreNotesInFolder(folderId, batch);

		for (const childId of folder.items ?? []) {
			this.restoreFolderTree(childId, batch);
		}
	}

	private collectFolderNotesWithPaths(
		folders: FolderItem[],
		batch?: number
	): { note: NoteItem; path: string }[] {
		return folders.flatMap((folder) => {
			const folderPath = this.folders.getFolderPath(folder.id);
			const notes =
				batch !== undefined
					? this.notes.getNotesToArchive(folder.id, batch)
					: this.notes.getDeletedNotes().filter((note) => note.folderId === folder.id);

			return notes.map((note) => ({
				note: structuredClone(note),
				path: `${folderPath}/${note.title}:${note.id}`
			}));
		});
	}

	private collectAllDeletedNotesWithPaths(): { note: NoteItem; path: string }[] {
		return this.notes.getDeletedNotes().map((note) => {
			const folderPath = note.folderId ? this.folders.getFolderPath(note.folderId) : null;
			const path = folderPath ? `${folderPath}/${note.title}:${note.id}` : `${note.title}:${note.id}`;
			return { note: structuredClone(note), path };
		});
	}
}

export const folderService = new FolderService();
export const noteService = new NoteService();
export const trashService = new TrashService();
