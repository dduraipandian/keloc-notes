import type { FolderID, FolderItem } from '../folders.svelte';
import type { NoteID, NoteItem } from '../notes.svelte';
import type { FolderStoreLike, NotesStoreLike } from '../services/types';
import { snapshotFolder } from '../services/helpers';
import { resolveProfile } from './profiles';

export class FolderTreeHelper {
	constructor(
		private readonly folders: FolderStoreLike,
		private readonly notes?: NotesStoreLike
	) {}

	getFolderPath(folderId: FolderID): string {
		const folder = this.folders.findItemById(folderId);
		if (!folder) return '';

		const segment = `${folder.title}:${folder.id}`;
		if (!folder.parentId) return segment;

		const parentPath = this.getFolderPath(folder.parentId);
		return parentPath ? `${parentPath}/${segment}` : segment;
	}

	getPlainFolderPath(folderId: FolderID): string {
		const folder = this.folders.findItemById(folderId);
		if (!folder) return '';

		if (!folder.parentId) return folder.title;

		const parentPath = this.getPlainFolderPath(folder.parentId);
		return parentPath ? `${parentPath}/${folder.title}` : folder.title;
	}

	collectFolderSubtree(folderId: FolderID): FolderItem[] {
		const result: FolderItem[] = [];
		const visited = new Set<FolderID>();
		const visit = (id: FolderID) => {
			if (visited.has(id)) return;
			const folder = this.folders.findItemById(id);
			if (!folder) return;
			visited.add(id);
			result.push(snapshotFolder(folder));
			for (const childId of folder.items ?? []) {
				visit(childId);
			}
		};
		visit(folderId);
		return result;
	}

	getFolderSubtreeIds(rootId: FolderID) {
		const ids = new Set<FolderID>();
		const visit = (id: FolderID) => {
			if (ids.has(id)) return;
			const folder = this.folders.findItemById(id);
			if (!folder) return;
			ids.add(id);
			for (const childId of folder.items ?? []) {
				visit(childId);
			}
		};
		visit(rootId);
		return ids;
	}

	getTrashRootIds(): FolderID[] {
		return this.folders.trashItems;
	}

	getHomeFolderChildIds(): FolderID[] {
		// Plan 8: Home has no children in sidebar to avoid duplication with 'folders' section
		return [];
	}

	getFavoriteFolderIds(): FolderID[] {
		const result: FolderID[] = [];
		const allItems = Array.from(this.folders.folders.values());
		for (const folder of allItems) {
			if (folder && folder.deletedAt == null && resolveProfile(folder).capabilities.favorite) {
				if (folder.isFavorite === true) {
					result.push(folder.id);
				}
			}
		}
		return result;
	}

	getActiveFolderIds(): FolderID[] {
		const result: FolderID[] = [];
		for (const rootId of this.folders.items) {
			this.collectActiveFolderIds(rootId, result);
		}
		return result;
	}

	getNotesForFolder(folderId: FolderID | null, folderKind?: string) {
		if (!this.notes) return [];

		// Determine which item to use for profile resolution
		// Default to 'home' if folderId is null
		const targetId = folderId || 'home';
		const item = this.folders.findItemById(targetId);
		if (!item) return [];

		const profile = resolveProfile(item);
		const allNotes = this.notes.listNotes();
		const resultNotes = profile.resolveNotes(item.id, allNotes, {
			folders: this.folders,
			tree: this
		});

		return resultNotes.sort(
			(a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
		);
	}

	restoreParentPath(parentId: FolderID | null | undefined) {
		if (!parentId) return;

		const parent = this.folders.findItemById(parentId);
		if (!parent || parent.deletedAt == null || parent.deletedBatchId == null) return;

		this.folders.restoreFolder(parentId, parent.deletedBatchId);
		this.restoreParentPath(parent.parentId);
	}

	private collectActiveFolderIds(folderId: FolderID, output: FolderID[]) {
		const folder = this.folders.findItemById(folderId);
		if (!folder || folder.deletedAt != null) return;

		const profile = resolveProfile(folder);
		if (!profile.capabilities.selectableAfterDelete) return;

		output.push(folder.id);

		for (const childId of folder.items ?? []) {
			this.collectActiveFolderIds(childId, output);
		}
	}
}
