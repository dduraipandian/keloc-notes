import { folderStore } from '../folders.svelte';
import { notesStore, type NoteItem } from '../notes.svelte';
import { PROTECTED_NOTES_FOLDER_ID } from './constants';
import type { NoteSource, SidebarSectionID, SourceCapabilities } from './types';

export type FolderSourceOptions = {
	section?: SidebarSectionID;
	capabilities?: Partial<SourceCapabilities>;
};

export function createFolderSource(folderId: string, options: FolderSourceOptions = {}): NoteSource {
	return {
		get id() {
			return folderId;
		},
		kind: 'folder',
		section: options.section ?? 'folders',
		get title() {
			return folderStore.folders.get(folderId)?.title ?? '';
		},
		get iconKey() {
			return folderId === PROTECTED_NOTES_FOLDER_ID ? 'notes-home' : 'folder';
		},
		get capabilities(): SourceCapabilities {
			const folder = folderStore.folders.get(folderId);
			const isDeleted = folder?.deletedAt != null;
			const baseCapabilities: SourceCapabilities = {
				canRename: !isDeleted,
				canDelete: !isDeleted,
				canCreateSubfolder: !isDeleted,
				canCreateNote: !isDeleted,
				canSetFavorite: !isDeleted,
				canEmpty: false,
				showsDeletedNotes: isDeleted
			};

			return {
				...baseCapabilities,
				...options.capabilities
			};
		},
		getNotes(): NoteItem[] {
			const folder = folderStore.folders.get(folderId);
			if (!folder) return [];

			const allNotes = Array.from(notesStore.notes.values());
			if (folder.deletedAt != null) {
				const subtreeIds = getFolderSubtreeIds(folderId);
				return allNotes
					.filter(
						(note) =>
							note.folderId != null &&
							subtreeIds.has(note.folderId) &&
							note.deletedAt === folder.deletedAt
					)
					.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
			}

			return allNotes
				.filter((note) => note.folderId === folderId && note.deletedAt == null)
				.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
		},
		getCount() {
			return this.getNotes().length;
		},
		getChildren() {
			const folder = folderStore.folders.get(folderId);
			if (!folder?.items) return [];
			if (folder.deletedAt != null) return folder.items;
			return folder.items.filter((id) => folderStore.folders.get(id)?.deletedAt == null);
		}
	};
}

function getFolderSubtreeIds(rootId: string): Set<string> {
	const ids = new Set<string>([rootId]);
	const folder = folderStore.folders.get(rootId);
	if (!folder?.items) return ids;

	for (const childId of folder.items) {
		const childIds = getFolderSubtreeIds(childId);
		childIds.forEach((id) => ids.add(id));
	}

	return ids;
}
