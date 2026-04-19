import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SelectionStore } from '../../../src/lib/stores/selection.svelte';
import { FolderStore, type FolderItem } from '../../../src/lib/stores/folders.svelte';
import { settingsRepository } from '../../../src/lib/infrastructure/repositories';
import { SvelteMap } from 'svelte/reactivity';

vi.mock('../../../src/lib/infrastructure/repositories', () => ({
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
	let selectionStore: SelectionStore;
	let mockFolderStore: FolderStore;

	beforeEach(() => {
		vi.clearAllMocks();
		mockFolderStore = new FolderStore();
		selectionStore = new SelectionStore(mockFolderStore);
		(mockFolderStore as any).items = [];
		(mockFolderStore as any).folders = new SvelteMap<string, FolderItem>();
	});

	it('should load a persisted selection when the folder exists', async () => {
		mockFolderStore.folders.set('folder-1', { id: 'folder-1', title: 'Folder' });
		vi.mocked(settingsRepository.getAll).mockResolvedValue({ selectedFolderID: 'folder-1' } as any);

		await selectionStore.init();

		expect(selectionStore.selectedFolderID).toBe('folder-1');
	});

	it('should clear a stale persisted selection', async () => {
		vi.mocked(settingsRepository.getAll).mockResolvedValue({
			selectedFolderID: 'missing-folder'
		} as any);

		await selectionStore.init();

		expect(selectionStore.selectedFolderID).toBeNull();
		expect(settingsRepository.save).toHaveBeenCalledWith('selectedFolderID', null);
	});

	it('should persist folder selection changes', async () => {
		mockFolderStore.folders.set('folder-1', { id: 'folder-1', title: 'Folder' });
		vi.mocked(settingsRepository.getAll).mockResolvedValue({} as any);
		await selectionStore.init();
		vi.clearAllMocks();

		selectionStore.selectFolder('folder-1');

		expect(selectionStore.selectedFolderID).toBe('folder-1');
		expect(settingsRepository.save).toHaveBeenCalledWith('selectedFolderID', 'folder-1');
	});

	it('should clear selection when the selected folder is removed', async () => {
		mockFolderStore.folders.set('folder-1', { id: 'folder-1', title: 'Folder' });
		vi.mocked(settingsRepository.getAll).mockResolvedValue({} as any);
		await selectionStore.init();
		selectionStore.selectFolder('folder-1');
		vi.clearAllMocks();

		selectionStore.clearFolderIfSelected('folder-1');

		expect(selectionStore.selectedFolderID).toBeNull();
		expect(settingsRepository.save).toHaveBeenCalledWith('selectedFolderID', null);
	});

	it('surfaces selection persistence errors through onPersistError', async () => {
		const onPersistError = vi.fn();
		(selectionStore as any).onPersistError = onPersistError;
		mockFolderStore.folders.set('folder-1', { id: 'folder-1', title: 'Folder' });
		vi.mocked(settingsRepository.getAll).mockResolvedValue({} as any);
		await selectionStore.init();
		vi.clearAllMocks();
		vi.mocked(settingsRepository.save).mockRejectedValueOnce(new Error('selection save failed') as any);

		selectionStore.selectFolder('folder-1');
		await Promise.resolve();

		expect(onPersistError).toHaveBeenCalledTimes(1);
		expect(onPersistError).toHaveBeenCalledWith(expect.any(Error), 'selectedFolderID');
		expect(onPersistError.mock.calls[0][0].message).toBe('selection save failed');
	});

	it('does not invoke onPersistError for successful selection persistence', async () => {
		const onPersistError = vi.fn();
		(selectionStore as any).onPersistError = onPersistError;
		mockFolderStore.folders.set('folder-1', { id: 'folder-1', title: 'Folder' });
		vi.mocked(settingsRepository.getAll).mockResolvedValue({} as any);
		await selectionStore.init();
		vi.clearAllMocks();
		vi.mocked(settingsRepository.save).mockResolvedValueOnce(undefined as any);

		selectionStore.selectFolder('folder-1');
		await Promise.resolve();

		expect(onPersistError).not.toHaveBeenCalled();
	});
});
