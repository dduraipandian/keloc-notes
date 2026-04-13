import { folderStore, type FolderID, type FolderItem } from '../folders.svelte';
import { notesStore } from '../notes.svelte';
import { selectionStore } from '../selection.svelte';
import type { FolderStoreLike, NotesStoreLike, SelectionStoreLike } from './types';
import { FolderTreeHelper } from '../domain/folderTree';

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
		const selectedFolder = this.selection.getSelectedFolder();
		const parentFolderId =
			selectedFolder && (!selectedFolder.kind || selectedFolder.kind === 'regular')
				? this.selection.selectedFolderID
				: null;
		const newFolderId = this.folders.createFolder(parentFolderId);
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

	getFavoriteFolderIds(): FolderID[] {
		return this.tree.getFavoriteFolderIds();
	}

	getHomeFolderChildIds(): FolderID[] {
		return this.tree.getHomeFolderChildIds();
	}

	setFavorite(folderId: FolderID, isFavorite: boolean) {
		this.folders.setFavorite(folderId, isFavorite);
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

		const folder = this.folders.findItemById(folderId);
		const firstNote = this.tree.getNotesForFolder(folderId, folder?.kind)[0] ?? null;
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
