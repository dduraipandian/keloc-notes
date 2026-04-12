import type { NoteSource } from './types';
import { createFolderSource } from './FolderSource';
import { trashView } from './builtinViews';
import { PROTECTED_NOTES_FOLDER_ID } from './constants';
import { folderStore } from '../folders.svelte';

/**
 * The source registry is the single place where:
 *   - Virtual views are listed (Trash, future Favorites/Tags)
 *   - Folder sources are created on demand
 *   - The sidebar resolves a sourceId → NoteSource
 *
 * FolderSource objects are created on each call (stateless adapters) — the
 * $derived in selectionStore is what caches the result.
 */

/** All built-in virtual views, in display order. */
const virtualViews: NoteSource[] = [trashView];

/** Resolve any source id → NoteSource, or null if not found. */
export function getSource(id: string): NoteSource | null {
	// Check virtual views first
	const view = virtualViews.find((v) => v.id === id);
	if (view) return view;

	// Then real folders
	if (folderStore.folders.has(id)) {
		return createFolderSource(id);
	}

	return null;
}

/** Virtual views to render at the top of the sidebar (before the folder tree). */
export function listVirtualViews(): NoteSource[] {
	return virtualViews;
}

/**
 * Root-level folder sources — the protected notes folder first, then user
 * folders in their stored order (folderStore.items), excluding system entries
 * like the protected folder which is pinned at the top.
 */
export function listRootFolderSources(): NoteSource[] {
	const sources: NoteSource[] = [];

	// Protected notes folder is always first
	if (folderStore.folders.has(PROTECTED_NOTES_FOLDER_ID)) {
		sources.push(createFolderSource(PROTECTED_NOTES_FOLDER_ID));
	}

	// User-created root folders (skip protected one to avoid duplicate)
	for (const id of folderStore.items) {
		if (id !== PROTECTED_NOTES_FOLDER_ID) {
			const folder = folderStore.folders.get(id);
			if (folder && folder.deletedAt == null) {
				sources.push(createFolderSource(id));
			}
		}
	}

	return sources;
}
