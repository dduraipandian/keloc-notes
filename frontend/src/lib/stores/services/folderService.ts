import type { FolderID, FolderItem } from '../folders.svelte';
import type { FolderStoreLike, NotesStoreLike, SelectionStoreLike } from './types';
import { FolderTreeHelper } from '../domain/folderTree';
import { resolveProfile } from '../domain/profiles';

export class FolderService {
	private readonly tree: FolderTreeHelper;
	private readonly selection: SelectionStoreLike;

	constructor(
		private readonly folders: FolderStoreLike,
		private readonly notes: NotesStoreLike,
		selection: SelectionStoreLike
	) {
		this.tree = new FolderTreeHelper(folders, notes);
		this.selection = selection;
	}

	create(
		parentId?: FolderID | null,
		{
			silent = false,
			suppressLibraryUsageMark = false
		}: { silent?: boolean; suppressLibraryUsageMark?: boolean } = {}
	) {
		let parentFolderId: FolderID | null;

		if (parentId !== undefined) {
			parentFolderId = parentId;
		} else {
			const selectedFolder = this.selection.getSelectedFolder();
			parentFolderId =
				selectedFolder && resolveProfile(selectedFolder).capabilities.createFolder
					? this.selection.selectedFolderID
					: null;
		}

		// Normalize root parent to null
		if (parentFolderId === 'home') parentFolderId = null;

		const newFolderId = suppressLibraryUsageMark
			? this.folders.createFolder(parentFolderId, { suppressLibraryUsageMark })
			: this.folders.createFolder(parentFolderId);
		if (!silent) this.selection.selectFolder(newFolderId ?? null);
		return newFolderId;
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


	getFolderPath(folderId: FolderID): string {
		return this.tree.getFolderPath(folderId);
	}

	getPlainFolderPath(folderId: FolderID): string {
		return this.tree.getPlainFolderPath(folderId);
	}

	ensurePath(path: string): FolderID | null {
		if (!path) return null;

		const parts = path.split('/').filter(Boolean);
		let parentId: FolderID | null = null;

		for (const part of parts) {
			let folderId: FolderID | null = null;
			// Normalizing root to null
			const currentParentId = parentId === 'home' ? null : parentId;

			for (const [id, folder] of this.folders.folders) {
				if (folder.title === part && folder.parentId === currentParentId && !folder.deletedAt) {
					folderId = id;
					break;
				}
			}

			if (!folderId) {
				// Use create with silent: true to avoid selection churn
				folderId = this.create(currentParentId, { silent: true }) as FolderID;
				this.rename(folderId, part);
			}

			parentId = folderId;
		}

		return parentId;
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

	delete(folderId: FolderID, deletedBatchId: string = crypto.randomUUID()) {
		const deletedAt = Date.now();
		const selectedFolderId = this.selection.selectedFolderID;
		const nextFolderId = this.getNextFolderSelectionAfterDelete(folderId);
		const deletedIds = new Set(this.collectFolderSubtree(folderId).map((folder) => folder.id));
		this.deleteFolderTree(folderId, deletedAt, deletedBatchId);
		if (nextFolderId) {
			this.select(nextFolderId);
		} else if (selectedFolderId && deletedIds.has(selectedFolderId)) {
			this.selection.selectFolder(null);
			this.notes.selectNote(null);
		}
	}

	private deleteFolderTree(folderId: FolderID, deletedAt: number, deletedBatchId: string) {
		const folder = this.folders.findItemById(folderId);
		if (!folder) return;

		this.folders.deleteFolder(folderId, deletedAt, deletedBatchId);
		this.notes.deleteNotesInFolder(folderId, deletedAt, deletedBatchId);

		for (const childId of folder.items ?? []) {
			this.deleteFolderTree(childId, deletedAt, deletedBatchId);
		}
	}

	private syncNoteSelectionForFolder(folderId: FolderID | null) {
		// Plan 7/8: Use the profile's resolveNotes logic to find the first note
		// This works for Home, Favorites, and Regular folders alike.
		const firstNote = this.tree.getNotesForFolder(folderId)[0] ?? null;
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
