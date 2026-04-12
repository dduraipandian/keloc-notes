import { folderStore, type FolderID, type FolderItem, type FolderType } from './folders.svelte';
import { notesStore, type NoteID, type NoteItem } from './notes.svelte';
import { trashRepository } from './repositories';
import { selectionStore } from './selection.svelte';

type FolderStoreLike = {
	items: FolderID[];
	findItemById(id: FolderID): FolderItem | null;
	getDefaultFolderId(): FolderID;
	createFolder(parentId?: FolderID | null): FolderID | void;
	startRename(id: FolderID): void;
	cancelRename(): void;
	renameFolder(id: FolderID, newTitle: string): void;
	openFolder(id: FolderID): void;
	deleteFolder(id: FolderID, batchTimestamp?: number): void;
	restoreFolder(id: FolderID, targetBatch?: number): void;
	rootFolderIfParentMissing(id: FolderID): void;
	applyPermanentDeleteState(foldersToDelete: FolderItem[]): void;
	trashItems: FolderID[];
};

type SelectionStoreLike = {
	selectedFolderID: FolderID | null;
	selectFolder(id: FolderID | null): void;
	getSelectedFolder(): FolderItem | null;
	clearFolderIfSelected(id: FolderID): void;
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

function snapshotFolder(folder: FolderItem): FolderItem {
	return {
		...folder,
		items: folder.items ? [...folder.items] : undefined
	};
}

function snapshotNote(note: NoteItem): NoteItem {
	return {
		...note
	};
}

class FolderTreeHelper {
	constructor(
		private readonly folders: FolderStoreLike,
		private readonly notes?: NotesStoreLike
	) {}

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
			snapshotFolder(folder),
			...(folder.items ?? []).flatMap((childId) => this.collectFolderSubtree(childId))
		];
	}

	getFolderSubtreeIds(rootId: FolderID) {
		const ids = new Set<FolderID>([rootId]);
		const folder = this.folders.findItemById(rootId);
		if (!folder?.items) return ids;

		for (const childId of folder.items) {
			const childSubtree = this.getFolderSubtreeIds(childId);
			childSubtree.forEach((id) => ids.add(id));
		}

		return ids;
	}

	getTrashRootIds(): FolderID[] {
		return this.folders.trashItems;
	}

	getActiveFolderIds(): FolderID[] {
		const result: FolderID[] = [];
		for (const rootId of this.folders.items) {
			this.collectActiveFolderIds(rootId, result);
		}
		return result;
	}

	getNotesForFolder(folderId: FolderID | null, folderType?: FolderType) {
		if (!this.notes) return [];

		let resultNotes: NoteItem[] = [];
		const allNotes = this.notes.listNotes();

		if (folderType === 'all') {
			resultNotes = allNotes.filter((note) => note.deletedAt == null);
		} else if (folderId === 'deleted-notes') {
			resultNotes = allNotes.filter((note) => note.deletedAt != null);
		} else {
			const currentFolder = folderId ? this.folders.findItemById(folderId) : null;
			if (folderId != null && currentFolder && currentFolder.deletedAt != null) {
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

	restoreParentPath(parentId: FolderID | null | undefined) {
		if (!parentId) return;

		const parent = this.folders.findItemById(parentId);
		if (!parent || parent.deletedAt == null) return;

		this.folders.restoreFolder(parentId, parent.deletedAt);
		this.restoreParentPath(parent.parentId);
	}

	private collectActiveFolderIds(folderId: FolderID, output: FolderID[]) {
		const folder = this.folders.findItemById(folderId);
		if (!folder || folder.type === 'trash' || folder.deletedAt != null) return;

		output.push(folder.id);

		for (const childId of folder.items ?? []) {
			this.collectActiveFolderIds(childId, output);
		}
	}
}

export class FolderService {
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

	create() {
		const newFolderId = this.folders.createFolder(this.selection.selectedFolderID);
		this.selection.selectFolder(newFolderId ?? null);
	}

	select(folderId: FolderID | null) {
		this.selection.selectFolder(folderId);
		this.syncNoteSelectionForFolder(folderId);
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
		return this.tree.findTopDeletedAncestor(folderId);
	}

	getFolderPath(folderId: FolderID): string {
		return this.tree.getFolderPath(folderId);
	}

	collectFolderSubtree(folderId: FolderID): FolderItem[] {
		return this.tree.collectFolderSubtree(folderId);
	}

	getTrashRootIds(): FolderID[] {
		return this.tree.getTrashRootIds();
	}

	delete(folderId: FolderID, batchTimestamp?: number) {
		const batch = batchTimestamp ?? Date.now();
		const selectedFolderId = this.selection.selectedFolderID;
		const nextFolderId = this.getNextFolderSelectionAfterDelete(folderId);
		const deletedIds = new Set(this.collectFolderSubtree(folderId).map((folder) => folder.id));
		this.deleteFolderTree(folderId, batch);
		if (nextFolderId) {
			this.select(nextFolderId);
		} else if (selectedFolderId && deletedIds.has(selectedFolderId)) {
			this.selection.selectFolder(null);
			this.notes.selectNote(null);
		}
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

	private syncNoteSelectionForFolder(folderId: FolderID | null) {
		if (folderId == null) {
			this.notes.selectNote(null);
			return;
		}

		const folderType = folderId ? this.folders.findItemById(folderId)?.type : undefined;
		const firstNote = this.tree.getNotesForFolder(folderId, folderType)[0] ?? null;
		this.notes.selectNote(firstNote?.id ?? null);
	}

	private getNextFolderSelectionAfterDelete(folderId: FolderID) {
		const selectedFolderId = this.selection.selectedFolderID;
		const deletedIds = new Set(this.collectFolderSubtree(folderId).map((folder) => folder.id));

		if (!selectedFolderId || !deletedIds.has(selectedFolderId)) {
			return null;
		}

		const activeFolderIds = this.tree.getActiveFolderIds();
		const deletedFolderIndex = activeFolderIds.indexOf(folderId);

		if (deletedFolderIndex === -1) return null;

		return activeFolderIds.slice(deletedFolderIndex + 1).find((id) => !deletedIds.has(id)) ?? null;
	}

}

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

		if (!folderId || folder?.type === 'all' || folder?.type === 'trash') {
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

	getNotesForFolder(folderId: FolderID | null, folderType?: FolderType) {
		return this.tree.getNotesForFolder(folderId, folderType);
	}

	getNoteCountForFolder(folderId: FolderID | null, folderType?: FolderType) {
		return this.getNotesForFolder(folderId, folderType).length;
	}
}

export class TrashService {
	private readonly tree: FolderTreeHelper;
	private readonly selection: SelectionStoreLike;

	constructor(
		private readonly folders: FolderStoreLike = folderStore,
		private readonly notes: NotesStoreLike = notesStore,
		private readonly trash = trashRepository,
		selection: SelectionStoreLike = selectionStore
	) {
		this.tree = new FolderTreeHelper(folders, notes);
		this.selection = selection;
	}

	recoverFolder(folderId: FolderID, targetBatch?: number) {
		const folder = this.folders.findItemById(folderId);
		if (!folder || folder.deletedAt == null) return;

		const batch = targetBatch ?? folder.deletedAt;
		this.restoreFolderTree(folderId, batch);

		if (!targetBatch) {
			this.folders.rootFolderIfParentMissing(folderId);
			const currentFolder = this.folders.findItemById(folderId);
			this.tree.restoreParentPath(currentFolder?.parentId);
		}

		const firstNote =
			typeof this.notes.listNotes === 'function'
				? this.notes
						.listNotes()
						.filter((note) => note.folderId === folderId && note.deletedAt == null)
						.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0] ?? null
				: null;

		this.selection.selectFolder(folderId);
		this.notes.selectNote(firstNote?.id ?? null);
	}

	recoverNote(noteId: NoteID) {
		const note = this.notes.getNote(noteId);
		if (!note) return;

		const isHierarchical = !!(note.folderId && this.tree.findTopDeletedAncestor(note.folderId));
		let restoredFolderId: FolderID | null | undefined = undefined;

		if (note.folderId) {
			const parentFolder = this.folders.findItemById(note.folderId);
			if (parentFolder) {
				if (parentFolder.deletedAt != null) {
					if (isHierarchical) {
						const topRoot = this.tree.findTopDeletedAncestor(note.folderId);
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
		const selectedFolderId = restoredFolderId !== undefined ? restoredFolderId : (note.folderId ?? null);
		this.selection.selectFolder(selectedFolderId);
		this.notes.selectNote(noteId);
	}

	async permanentlyDeleteFolder(folderId: FolderID, targetBatch?: number) {
		const folder = this.folders.findItemById(folderId);
		if (!folder || folder.deletedAt == null) return;

		const batch = targetBatch ?? folder.deletedAt;
		const foldersToDelete = this.tree.collectFolderSubtree(folderId);
		const notesToDelete = this.collectFolderNotesWithPaths(foldersToDelete, batch);

		try {
			await this.trash.permanentlyDeleteFolderTree(notesToDelete, foldersToDelete, Date.now());
			notesToDelete.forEach(({ note }) => this.notes.removeNoteLocally(note.id));
			this.folders.applyPermanentDeleteState(foldersToDelete);
			this.selection.clearFolderIfSelected(folderId);
		} catch (error) {
			console.error('Failed to permanently delete folder and children:', error);
			throw error;
		}
	}

	async permanentlyDeleteNote(noteId: NoteID) {
		const note = this.notes.getNote(noteId);
		if (!note) return;

		const folderPath = note.folderId ? this.tree.getFolderPath(note.folderId) : 'root';
		const fullPath = note.folderId ? `${folderPath}/${note.title}:${note.id}` : `${note.title}:${note.id}`;

		try {
			await this.trash.permanentlyDeleteNote(snapshotNote(note), fullPath, Date.now());
			this.notes.removeNoteLocally(noteId);
			this.notes.clearSelectionIfSelected(noteId);
		} catch (error) {
			console.error('Failed to permanently delete note:', error);
			throw error;
		}
	}

	async empty() {
		const foldersToDelete = this.tree.getTrashRootIds().flatMap((id) => this.tree.collectFolderSubtree(id));
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
			deletedFolderIds.forEach((id) => this.selection.clearFolderIfSelected(id));
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
			const folderPath = this.tree.getFolderPath(folder.id);
			const notes =
				batch !== undefined
					? this.notes.getNotesToArchive(folder.id, batch)
					: this.notes.getDeletedNotes().filter((note) => note.folderId === folder.id);

			return notes.map((note) => ({
				note: snapshotNote(note),
				path: `${folderPath}/${note.title}:${note.id}`
			}));
		});
	}

	private collectAllDeletedNotesWithPaths(): { note: NoteItem; path: string }[] {
		return this.notes.getDeletedNotes().map((note) => {
			const folderPath = note.folderId ? this.tree.getFolderPath(note.folderId) : null;
			const path = folderPath ? `${folderPath}/${note.title}:${note.id}` : `${note.title}:${note.id}`;
			return { note: snapshotNote(note), path };
		});
	}
}

export const folderService = new FolderService();
export const noteService = new NoteService();
export const trashService = new TrashService();
