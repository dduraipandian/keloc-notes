import type { NoteSource, SourceCapabilities } from './types';
import type { NoteItem } from '../notes.svelte';
import { folderStore } from '../folders.svelte';
import { notesStore } from '../notes.svelte';

/**
 * Creates a NoteSource backed by a real folder in the folder tree.
 *
 * The source is a stateless adapter — it reads live from folderStore and
 * notesStore on every call. Do not cache or add $state here; let Svelte's
 * reactivity in the consuming $derived do the caching.
 */
export function createFolderSource(folderId: string): NoteSource {
	return {
		get id() {
			return folderId;
		},

		kind: 'folder' as const,

		get title() {
			return folderStore.folders.get(folderId)?.title ?? '';
		},

		get iconKey() {
			const folder = folderStore.folders.get(folderId);
			if (!folder) return 'folder';
			return folder.id === 'notes' ? 'notes-home' : 'folder';
		},

		get capabilities(): SourceCapabilities {
			const folder = folderStore.folders.get(folderId);
			const isProtected = folder?.isProtected ?? false;
			const isDeleted = folder?.deletedAt != null;
			return {
				canRename: !isProtected && !isDeleted,
				canDelete: !isProtected && !isDeleted,
				canCreateSubfolder: !isDeleted,
				canCreateNote: !isDeleted,
				showsDeletedNotes: isDeleted
			};
		},

		getNotes(): NoteItem[] {
			const folder = folderStore.folders.get(folderId);
			if (!folder) return [];

			const allNotes = Array.from(notesStore.notes.values());

			if (folder.deletedAt != null) {
				// Deleted folder view: show notes from the entire subtree that were
				// soft-deleted in the same batch as this folder.
				const subtreeIds = getFolderSubtreeIds(folderId);
				return allNotes
					.filter((n) => n.folderId && subtreeIds.has(n.folderId) && n.deletedAt === folder.deletedAt)
					.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
			}

			return allNotes
				.filter((n) => n.folderId === folderId && n.deletedAt == null)
				.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
		},

		getCount(): number {
			return notesStore.folderCountIndex.get(folderId) ?? 0;
		},

		getChildren(): string[] {
			const folder = folderStore.folders.get(folderId);
			if (!folder?.items) return [];
			return folder.items.filter((id) => folderStore.folders.get(id)?.deletedAt == null);
		}
	};
}

/** Collects the id of a folder and all its descendants. */
function getFolderSubtreeIds(rootId: string): Set<string> {
	const ids = new Set<string>([rootId]);
	const folder = folderStore.folders.get(rootId);
	if (folder?.items) {
		for (const childId of folder.items) {
			const childSubtree = getFolderSubtreeIds(childId);
			childSubtree.forEach((id) => ids.add(id));
		}
	}
	return ids;
}
