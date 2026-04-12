import { beforeEach, describe, expect, it, vi } from 'vitest';
import { selectionStore } from './selection.svelte';
import { folderStore, type FolderItem } from './folders.svelte';
import { settingsRepository } from './repositories';
import { SvelteMap } from 'svelte/reactivity';

vi.mock('./repositories', () => ({
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
		(folderStore as any).selectedFolderID = null;
	});

	it('should load a persisted selection when the folder exists', async () => {
		folderStore.folders.set('folder-1', { id: 'folder-1', title: 'Folder', url: '#' });
		vi.mocked(settingsRepository.getAll).mockResolvedValue({ selectedFolderID: 'folder-1' } as any);

		await selectionStore.init();

		expect(selectionStore.selectedFolderID).toBe('folder-1');
		expect(folderStore.selectedFolderID).toBe('folder-1');
	});

	it('should clear a stale persisted selection', async () => {
		vi.mocked(settingsRepository.getAll).mockResolvedValue({ selectedFolderID: 'missing-folder' } as any);

		await selectionStore.init();

		expect(selectionStore.selectedFolderID).toBeNull();
		expect(folderStore.selectedFolderID).toBeNull();
		expect(settingsRepository.save).toHaveBeenCalledWith('selectedFolderID', null);
	});

	it('should persist folder selection changes', async () => {
		folderStore.folders.set('folder-1', { id: 'folder-1', title: 'Folder', url: '#' });
		vi.mocked(settingsRepository.getAll).mockResolvedValue({} as any);
		await selectionStore.init();
		vi.clearAllMocks();

		selectionStore.selectFolder('folder-1');

		expect(selectionStore.selectedFolderID).toBe('folder-1');
		expect(folderStore.selectedFolderID).toBe('folder-1');
		expect(settingsRepository.save).toHaveBeenCalledWith('selectedFolderID', 'folder-1');
	});

	it('should clear selection when the selected folder is removed', async () => {
		folderStore.folders.set('folder-1', { id: 'folder-1', title: 'Folder', url: '#' });
		vi.mocked(settingsRepository.getAll).mockResolvedValue({} as any);
		await selectionStore.init();
		selectionStore.selectFolder('folder-1');
		vi.clearAllMocks();

		selectionStore.clearFolderIfSelected('folder-1');

		expect(selectionStore.selectedFolderID).toBeNull();
		expect(folderStore.selectedFolderID).toBeNull();
		expect(settingsRepository.save).toHaveBeenCalledWith('selectedFolderID', null);
	});
});
