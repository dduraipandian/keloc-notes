import { settingsRepository } from '../infrastructure/repositories';
import { folderStore, type FolderID, type FolderItem } from './folders.svelte';

class SelectionStore {
	selectedFolderID = $state<FolderID | null>(null);
	private isInitialized = false;
	onPersistError = $state<((err: unknown, key: string) => void) | null>(null);

	async init() {
		if (this.isInitialized) return;

		try {
			const settings = await settingsRepository.getAll();
			const persistedSelection = settings?.selectedFolderID ?? null;
			this.selectFolder(persistedSelection, false);
			this.isInitialized = true;
			if (persistedSelection != null && this.selectedFolderID == null) {
				void Promise.resolve(settingsRepository.save('selectedFolderID', null)).catch((err) => {
					this.onPersistError?.(err, 'selectedFolderID');
				});
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
			void Promise.resolve(settingsRepository.save('selectedFolderID', this.selectedFolderID)).catch(
				(err) => {
					this.onPersistError?.(err, 'selectedFolderID');
				}
			);
		}
	}

	clearFolderIfSelected(id: FolderID) {
		if (this.selectedFolderID === id) {
			this.selectFolder(null);
		}
	}

	getSelectedFolder(): FolderItem | null {
		if (!this.selectedFolderID) return null;
		return folderStore.findItemById(this.selectedFolderID);
	}

	__resetForTest() {
		this.selectedFolderID = null;
		this.isInitialized = false;
		this.onPersistError = null;
	}

	private resolveFolderId(id: FolderID | null) {
		if (!id) return null;
		return folderStore.findItemById(id) ? id : null;
	}
}

export const selectionStore = new SelectionStore();
