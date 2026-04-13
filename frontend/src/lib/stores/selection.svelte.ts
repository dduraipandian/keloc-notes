import { settingsRepository } from './repositories';
import { folderStore, type FolderID, type FolderItem } from './folders.svelte';
import { PROTECTED_NOTES_FOLDER_ID } from './sources/constants';
import { getSource } from './sources/registry.svelte';

class SelectionStore {
	selectedFolderID = $state<FolderID | null>(null);
	private isInitialized = false;
	currentSource = $derived.by(() => {
		const sourceId = this.selectedFolderID ?? PROTECTED_NOTES_FOLDER_ID;
		return getSource(sourceId);
	});

	async init() {
		if (this.isInitialized) return;

		try {
			const settings = await settingsRepository.getAll();
			const persistedSelection = settings?.selectedFolderID ?? null;
			this.selectedFolderID = this.resolveFolderId(persistedSelection);
			this.isInitialized = true;
			if (this.selectedFolderID !== persistedSelection) {
				settingsRepository.save('selectedFolderID', this.selectedFolderID);
			}
		} catch (error) {
			console.error('Failed to load selected folder from storage:', error);
			throw error;
		}
	}

	selectFolder(id: FolderID | null, persist = true) {
		const resolvedId = this.resolveFolderId(id);
		this.selectedFolderID = resolvedId;

		if (persist && this.isInitialized) {
			settingsRepository.save('selectedFolderID', this.selectedFolderID);
		}
	}

	clearFolderIfSelected(id: FolderID) {
		if (this.selectedFolderID === id) {
			this.selectFolder(null);
		}
	}

	getSelectedFolder(): FolderItem | null {
		const sourceId = this.currentSource?.id ?? this.selectedFolderID;
		if (!sourceId) return null;
		return folderStore.findItemById(sourceId);
	}

	__resetForTest() {
		this.selectedFolderID = null;
		this.isInitialized = false;
	}

	private resolveFolderId(id: FolderID | null) {
		if (id && getSource(id)) return id;

		const defaultFolderId = folderStore.getDefaultFolderId();
		return getSource(defaultFolderId)?.id ?? null;
	}
}

export const selectionStore = new SelectionStore();
