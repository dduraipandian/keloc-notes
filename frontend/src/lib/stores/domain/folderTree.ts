import type { FolderID, FolderItem, SidebarKind } from '../folders.svelte';
import type { NoteItem } from '../notes.svelte';
import type { FolderStoreLike, NotesStoreLike } from '../services/types';
import { snapshotFolder } from '../services/helpers';

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

	getHomeFolderChildIds(): FolderID[] {
		return this.folders.items.filter((id) => {
			const folder = this.folders.findItemById(id);
			return (
				folder &&
				(!folder.kind || folder.kind === 'regular') &&
				folder.deletedAt == null &&
				folder.parentId == null
			);
		});
	}

	getFavoriteFolderIds(): FolderID[] {
		const result: FolderID[] = [];
		for (const [id, folder] of this.folders.folders.entries()) {
			if (
				folder &&
				folder.isFavorite === true &&
				folder.deletedAt == null &&
				(!folder.kind || folder.kind === 'regular')
			) {
				result.push(id);
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

	getNotesForFolder(folderId: FolderID | null, folderKind?: SidebarKind) {
		if (!this.notes) return [];

		let resultNotes: NoteItem[] = [];
		const allNotes = this.notes.listNotes();

		if (folderKind === 'trash') {
			resultNotes = allNotes.filter((note) => note.deletedAt != null);
		} else if (folderKind === 'home') {
			resultNotes = allNotes.filter((note) => note.folderId == null && note.deletedAt == null);
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
		if (
			!folder ||
			(folder.kind && folder.kind !== 'regular') ||
			folder.deletedAt != null
		)
			return;

		output.push(folder.id);

		for (const childId of folder.items ?? []) {
			this.collectActiveFolderIds(childId, output);
		}
	}
}
