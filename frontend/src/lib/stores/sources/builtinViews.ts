import { folderStore } from '../folders.svelte';
import { createVirtualView } from './VirtualView';
import { FAVORITES_VIEW_ID, TRASH_VIEW_ID } from './constants';
import type { SourceCapabilities } from './types';

export const protectedFolderViewCapabilities: Partial<SourceCapabilities> = {
	canRename: false,
	canDelete: false,
	canSetFavorite: false
};

function getFavoriteFolderIds() {
	const result: string[] = [];
	for (const [id, folder] of folderStore.folders.entries()) {
		if (
			folder &&
			folder.isFavorite === true &&
			folder.deletedAt == null &&
			folder.type !== 'trash' &&
			folder.type !== 'system'
		) {
			result.push(id);
		}
	}
	return result;
}

function getTrashRootIds() {
	const result: string[] = [];
	for (const [id, folder] of folderStore.folders.entries()) {
		if (folder.type === 'trash' || folder.deletedAt == null) continue;
		const parent = folder.parentId ? folderStore.folders.get(folder.parentId) : null;
		if (!parent || parent.deletedAt == null) {
			result.push(id);
		}
	}
	return result;
}

export const trashView = createVirtualView({
	id: TRASH_VIEW_ID,
	title: 'Recently Deleted',
	iconKey: 'trash',
	predicate: (note) => note.deletedAt != null,
	getChildren: getTrashRootIds,
	capabilities: {
		canRename: false,
		canDelete: false,
		canCreateSubfolder: false,
		canCreateNote: false,
		canSetFavorite: false,
		canEmpty: true,
		showsDeletedNotes: true
	}
});

export const favoritesView = createVirtualView({
	id: FAVORITES_VIEW_ID,
	title: 'Favorites',
	iconKey: 'star',
	predicate: (note) => note.deletedAt == null && note.isFavorite === true,
	getChildren: getFavoriteFolderIds,
	capabilities: {
		canRename: false,
		canDelete: false,
		canCreateSubfolder: false,
		canCreateNote: false,
		canSetFavorite: false,
		canEmpty: false,
		showsDeletedNotes: false
	}
});

export const builtinViews = [favoritesView, trashView];
