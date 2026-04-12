import { getAllSettings, putSetting } from './idbr';
import { getSource } from './sources/registry.svelte';
import { PROTECTED_NOTES_FOLDER_ID } from './sources/constants';
import type { NoteSource } from './sources/types';
import type { NoteItem } from './notes.svelte';
import { folderStore } from './folders.svelte';

/**
 * SelectionStore — owns the user's current sidebar selection.
 *
 * Resolves the selected id through the source registry:
 *   1. If the id maps to a virtual view (trash, future favorites) → use it.
 *   2. If the id maps to a real folder → use it.
 *   3. Otherwise (stale id, old 'deleted-notes' string, deleted folder) → fall
 *      back to the protected notes folder so the pane is never blank.
 *
 * Note selection (selectedNoteID) is a separate concern and stays on notesStore.
 * This store is purely about the sidebar/folder-pane selection axis.
 */
class SelectionStore {
	selectedSourceId = $state<string | null>(null);
	private isInitialized = false;

	/**
	 * The resolved NoteSource for the current selection. Never null — falls back
	 * to the protected notes folder when the id can't be resolved.
	 */
	currentSource = $derived.by((): NoteSource | null => {
		const id = this.selectedSourceId;
		if (id) {
			const resolved = getSource(id);
			if (resolved) return resolved;
		}
		// Fallback: protected notes folder (always exists after folderStore.init)
		return getSource(PROTECTED_NOTES_FOLDER_ID);
	});

	/** Notes for the current selection, sorted by updatedAt desc. */
	currentNotes = $derived.by((): NoteItem[] => {
		return this.currentSource?.getNotes() ?? [];
	});

	/** Note count badge for the current selection. */
	currentCount = $derived.by((): number => {
		return this.currentSource?.getCount() ?? 0;
	});

	async init() {
		if (this.isInitialized) return;
		try {
			const settings = await getAllSettings();
			if (settings?.selectedFolderID) {
				this.selectedSourceId = settings.selectedFolderID;
			}
		} catch (error) {
			console.error('SelectionStore: failed to load selection from storage:', error);
		}
		this.isInitialized = true;
	}

	select(id: string | null) {
		this.selectedSourceId = id;
		// Sync folderStore selection so createFolder() knows the current context
		// (virtual view ids won't resolve to real folders, so they implicitly clear it)
		const source = id ? getSource(id) : null;
		folderStore.selectedFolderID = source?.kind === 'folder' ? id : null;
		this.persist();
	}

	persist() {
		if (!this.isInitialized) return;
		putSetting('selectedFolderID', this.selectedSourceId);
	}

	/** Test helper — resets store to initial state without touching IDB. */
	__resetForTest() {
		this.selectedSourceId = null;
		this.isInitialized = false;
	}
}

export const selectionStore = new SelectionStore();
