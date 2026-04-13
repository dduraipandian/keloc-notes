import { beforeEach, describe, expect, it, vi } from 'vitest';
import { selectionStore } from '$lib/stores/selection.svelte';
import { folderStore, type FolderItem } from '$lib/stores/folders.svelte';
import { settingsRepository } from '$lib/stores/repositories';
import { SvelteMap } from 'svelte/reactivity';
import { PROTECTED_NOTES_FOLDER_ID } from '$lib/stores/sources/constants';

vi.mock('$lib/stores/repositories', () => ({
	foldersRepository: {
		list: vi.fn(),
		save: vi.fn()
	},
	notesRepository: {
		list: vi.fn(),
		save: vi.fn()
	},
	settingsRepository: {
		getAll: vi.fn(),
		save: vi.fn()
	},
	trashRepository: {
		permanentlyDeleteFolderTree: vi.fn(),
		permanentlyDeleteNote: vi.fn()
	}
}));

describe('SelectionStore', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		selectionStore.__resetForTest();
		(folderStore as any).items = [];
		(folderStore as any).folders = new SvelteMap<string, FolderItem>();
	});

	it('should load a persisted selection when the folder exists', async () => {
		folderStore.folders.set('folder-1', { id: 'folder-1', title: 'Folder', url: '#' });
		vi.mocked(settingsRepository.getAll).mockResolvedValue({ selectedFolderID: 'folder-1' } as any);

		await selectionStore.init();

		expect(selectionStore.selectedFolderID).toBe('folder-1');
	});

	it('should fall back to notes when a persisted selection is stale', async () => {
		vi.mocked(settingsRepository.getAll).mockResolvedValue({ selectedFolderID: 'missing-folder' } as any);

		await selectionStore.init();

		expect(selectionStore.selectedFolderID).toBe(PROTECTED_NOTES_FOLDER_ID);
		expect(settingsRepository.save).toHaveBeenCalledWith(
			'selectedFolderID',
			PROTECTED_NOTES_FOLDER_ID
		);
	});

	it('should persist folder selection changes', async () => {
		folderStore.folders.set('folder-1', { id: 'folder-1', title: 'Folder', url: '#' });
		vi.mocked(settingsRepository.getAll).mockResolvedValue({} as any);
		await selectionStore.init();
		vi.clearAllMocks();

		selectionStore.selectFolder('folder-1');

		expect(selectionStore.selectedFolderID).toBe('folder-1');
		expect(settingsRepository.save).toHaveBeenCalledWith('selectedFolderID', 'folder-1');
	});

	it('should fall back to notes when the selected folder is removed', async () => {
		folderStore.folders.set('folder-1', { id: 'folder-1', title: 'Folder', url: '#' });
		vi.mocked(settingsRepository.getAll).mockResolvedValue({} as any);
		await selectionStore.init();
		selectionStore.selectFolder('folder-1');
		vi.clearAllMocks();

		selectionStore.clearFolderIfSelected('folder-1');

		expect(selectionStore.selectedFolderID).toBe(PROTECTED_NOTES_FOLDER_ID);
		expect(settingsRepository.save).toHaveBeenCalledWith(
			'selectedFolderID',
			PROTECTED_NOTES_FOLDER_ID
		);
	});
});
