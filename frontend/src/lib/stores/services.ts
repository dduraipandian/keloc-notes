import { folderStore, type FolderID, type FolderItem, type FolderType } from './folders.svelte';
import { notesStore, type NoteID, type NoteItem } from './notes.svelte';
import { trashRepository } from './repositories';

type FolderStoreLike = {
	findItemById(id: FolderID): FolderItem | null;
	findTopDeletedAncestor(folderId: FolderID): FolderItem | null;
	getDefaultFolderId(): FolderID;
	createFolder(): void;
	selectFolder(id: FolderID | null): void;
	startRename(id: FolderID): void;
	cancelRename(): void;
	renameFolder(id: FolderID, newTitle: string): void;
	openFolder(id: FolderID): void;
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
	listNotes(): NoteItem[];
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

	select(folderId: FolderID | null) {
		this.folders.selectFolder(folderId);
	}

	startRename(folderId: FolderID) {
		this.folders.startRename(folderId);
	}

	cancelRename() {
		this.folders.cancelRename();
	}

	rename(folderId: FolderID, newTitle: string) {
		this.folders.renameFolder(folderId, newTitle);
	}

	toggle(folderId: FolderID) {
		this.folders.openFolder(folderId);
	}

	findTopDeletedAncestor(folderId: FolderID): FolderItem | null {
		const folder = this.folders.findItemById(folderId);
		if (!folder || folder.deletedAt == null) return null;

		if (!folder.parentId) return folder;

		const parent = this.folders.findItemById(folder.parentId);
		if (!parent || parent.deletedAt == null) return folder;

		return this.findTopDeletedAncestor(folder.parentId);
	}

	getFolderPath(folderId: FolderID): string {
		const folder = this.folders.findItemById(folderId);
		if (!folder) return '';

		const segment = `${folder.title}:${folder.id}`;
		if (!folder.parentId) return segment;

		const parentPath = this.getFolderPath(folder.parentId);
		return parentPath ? `${parentPath}/${segment}` : segment;
	}

	collectFolderSubtree(folderId: FolderID): FolderItem[] {
		const folder = this.folders.findItemById(folderId);
		if (!folder) return [];

		return [
			structuredClone(folder),
			...(folder.items ?? []).flatMap((childId) => this.collectFolderSubtree(childId))
		];
	}

	getTrashRootIds(): FolderID[] {
		return this.folders.trashItems;
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

	getNotesForFolder(folderId: FolderID | null, folderType?: FolderType) {
		let resultNotes: NoteItem[] = [];
		const allNotes = this.notes.listNotes();

		if (folderType === 'all') {
			resultNotes = allNotes.filter((note) => note.deletedAt == null);
		} else if (folderId === 'deleted-notes') {
			resultNotes = allNotes.filter((note) => note.deletedAt != null);
		} else {
			const currentFolder = folderId ? this.folders.findItemById(folderId) : null;
			if (currentFolder && currentFolder.deletedAt != null) {
				const subtreeIds = this.getFolderSubtreeIds(folderId);
				resultNotes = allNotes.filter(
					(note) =>
						note.folderId != null &&
						subtreeIds.has(note.folderId) &&
						note.deletedAt === currentFolder.deletedAt
				);
			} else {
				const normalizedFolderId = folderId ?? 'root';
				resultNotes = allNotes.filter(
					(note) => (note.folderId ?? 'root') === normalizedFolderId && note.deletedAt == null
				);
			}
		}

		return resultNotes.sort(
			(a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
		);
	}

	getNoteCountForFolder(folderId: FolderID | null, folderType?: FolderType) {
		return this.getNotesForFolder(folderId, folderType).length;
	}

	private getFolderSubtreeIds(rootId: FolderID) {
		const ids = new Set<FolderID>([rootId]);
		const folder = this.folders.findItemById(rootId);
		if (!folder?.items) return ids;

		for (const childId of folder.items) {
			const childSubtree = this.getFolderSubtreeIds(childId);
			childSubtree.forEach((id) => ids.add(id));
		}

		return ids;
	}
}

export class TrashService {
	constructor(
		private readonly folders: FolderStoreLike = folderStore,
		private readonly notes: NotesStoreLike = notesStore,
		private readonly trash = trashRepository
	) {}

	recoverFolder(folderId: FolderID, targetBatch?: number) {
		const folder = this.folders.findItemById(folderId);
		if (!folder || folder.deletedAt == null) return;

		const batch = targetBatch ?? folder.deletedAt;
		this.restoreFolderTree(folderId, batch);

		if (!targetBatch) {
			this.folders.rootFolderIfParentMissing(folderId);
			const currentFolder = this.folders.findItemById(folderId);
			this.restoreParentPath(currentFolder?.parentId);
		}
	}

	recoverNote(noteId: NoteID) {
		const note = this.notes.getNote(noteId);
		if (!note) return;

		const isHierarchical = !!(note.folderId && this.findTopDeletedAncestor(note.folderId));
		let restoredFolderId: FolderID | null | undefined = undefined;

		if (note.folderId) {
			const parentFolder = this.folders.findItemById(note.folderId);
			if (parentFolder) {
				if (parentFolder.deletedAt != null) {
					if (isHierarchical) {
						const topRoot = this.findTopDeletedAncestor(note.folderId);
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
		const foldersToDelete = this.collectFolderSubtree(folderId);
		const notesToDelete = this.collectFolderNotesWithPaths(foldersToDelete, batch);

		try {
			await this.trash.permanentlyDeleteFolderTree(notesToDelete, foldersToDelete, Date.now());
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

		const folderPath = note.folderId ? this.getFolderPath(note.folderId) : 'root';
		const fullPath = note.folderId ? `${folderPath}/${note.title}:${note.id}` : `${note.title}:${note.id}`;

		try {
			await this.trash.permanentlyDeleteNote(structuredClone(note), fullPath, Date.now());
			this.notes.removeNoteLocally(noteId);
			this.notes.clearSelectionIfSelected(noteId);
		} catch (error) {
			console.error('Failed to permanently delete note:', error);
			throw error;
		}
	}

	async empty() {
		const foldersToDelete = this.getTrashRootIds().flatMap((id) => this.collectFolderSubtree(id));
		const deletedFolderIds = new Set(foldersToDelete.map((f) => f.id));
		const folderNotes = this.collectFolderNotesWithPaths(foldersToDelete);
		const individualNotes = this.collectAllDeletedNotesWithPaths();
		const seenIds = new Set(folderNotes.map((entry) => entry.note.id));
		const notesToDelete = [
			...folderNotes,
			...individualNotes.filter((entry) => !seenIds.has(entry.note.id))
		];

		try {
			await this.trash.permanentlyDeleteFolderTree(notesToDelete, foldersToDelete, Date.now());
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
			const folderPath = this.getFolderPath(folder.id);
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
			const folderPath = note.folderId ? this.getFolderPath(note.folderId) : null;
			const path = folderPath ? `${folderPath}/${note.title}:${note.id}` : `${note.title}:${note.id}`;
			return { note: structuredClone(note), path };
		});
	}

	private findTopDeletedAncestor(folderId: FolderID): FolderItem | null {
		const folder = this.folders.findItemById(folderId);
		if (!folder || folder.deletedAt == null) return null;

		if (!folder.parentId) return folder;

		const parent = this.folders.findItemById(folder.parentId);
		if (!parent || parent.deletedAt == null) return folder;

		return this.findTopDeletedAncestor(folder.parentId);
	}

	private getFolderPath(folderId: FolderID): string {
		const folder = this.folders.findItemById(folderId);
		if (!folder) return '';

		const segment = `${folder.title}:${folder.id}`;
		if (!folder.parentId) return segment;

		const parentPath = this.getFolderPath(folder.parentId);
		return parentPath ? `${parentPath}/${segment}` : segment;
	}

	private collectFolderSubtree(folderId: FolderID): FolderItem[] {
		const folder = this.folders.findItemById(folderId);
		if (!folder) return [];

		return [
			structuredClone(folder),
			...(folder.items ?? []).flatMap((childId) => this.collectFolderSubtree(childId))
		];
	}

	private getTrashRootIds(): FolderID[] {
		return this.folders.trashItems;
	}

	private restoreParentPath(parentId: FolderID | null | undefined) {
		if (!parentId) return;

		const parent = this.folders.findItemById(parentId);
		if (!parent || parent.deletedAt == null) return;

		this.folders.restoreFolder(parentId, parent.deletedAt);
		this.restoreParentPath(parent.parentId);
	}
}

export const folderService = new FolderService();
export const noteService = new NoteService();
export const trashService = new TrashService();
