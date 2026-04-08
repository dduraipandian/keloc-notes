import { describe, it, expect, beforeEach, vi } from 'vitest';
import { folderStore, type FolderItem } from './folders.svelte';
import * as idb from './idb';

// Mock crypto.randomUUID
global.crypto.randomUUID = vi.fn(() => 'test-uuid' as any);

// Mock IDB module
vi.mock('./idb', () => ({
	loadFolderState: vi.fn(),
	saveFolderState: vi.fn(),
	initDB: vi.fn(),
	getDB: vi.fn()
}));

describe('FolderStore', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset store state before each test
		// Using a private reset for tests to ensure clean state
		(folderStore as any).items = [];
		(folderStore as any).selectedItem = null;
		(folderStore as any).editingId = null;
		(folderStore as any).isInitialized = false;
	});

	it('should create a folder at the root when nothing is selected', () => {
		folderStore.createFolder();
		
		expect(folderStore.items.length).toBe(1);
		expect(folderStore.items[0].title).toBe('New Folder');
		expect(folderStore.items[0].id).toBe('test-uuid');
		expect(folderStore.selectedItem?.id).toBe('test-uuid');
	});

	it('should create a folder inside a selected folder', () => {
		const parent: FolderItem = { id: 'parent', title: 'Parent', url: '#' };
		folderStore.items = [parent];
		folderStore.selectItem(folderStore.items[0]);

		folderStore.createFolder();

		expect(folderStore.items[0].items?.length).toBe(1);
		expect(folderStore.items[0].items?.[0].title).toBe('New Folder');
		expect(folderStore.items[0].isOpen).toBe(true);
		expect(folderStore.selectedItem?.id).toBe('test-uuid');
	});

	it('should delete a folder and all its children recursively', () => {
		const child: FolderItem = { id: 'child', title: 'Child', url: '#' };
		const parent: FolderItem = { 
			id: 'parent', 
			title: 'Parent', 
			url: '#', 
			items: [child] 
		};
		folderStore.items = [parent];

		folderStore.deleteFolder('parent');

		expect(folderStore.items.length).toBe(0);
	});

	it('should delete a child folder but keep the parent', () => {
		const child: FolderItem = { id: 'child', title: 'Child', url: '#' };
		const parent: FolderItem = { 
			id: 'parent', 
			title: 'Parent', 
			url: '#', 
			items: [child] 
		};
		folderStore.items = [parent];

		folderStore.deleteFolder('child');

		expect(folderStore.items.length).toBe(1);
		expect(folderStore.items[0].items?.length).toBe(0);
	});

	it('should start renaming correctly', () => {
		vi.useFakeTimers();
		folderStore.startRename('folder-1');
		vi.runAllTimers();
		
		expect(folderStore.editingId).toBe('folder-1');
		vi.useRealTimers();
	});

	it('should clear selection if selected item is deleted', () => {
		const item: FolderItem = { id: 'item', title: 'Item', url: '#' };
		(folderStore as any).isInitialized = true;
		folderStore.items = [item];
		folderStore.selectItem(item);

		folderStore.deleteFolder('item');

		expect(folderStore.selectedItem).toBeNull();
	});

	describe('Persistence', () => {
		it('should load state on init', async () => {
			const savedItems = [{ id: 'saved', title: 'Saved', url: '#' }];
			vi.mocked(idb.loadFolderState).mockResolvedValue({
				items: savedItems,
				selectedId: 'saved'
			});

			await folderStore.init();

			expect(folderStore.items).toEqual(savedItems);
			expect(folderStore.selectedItem?.id).toBe('saved');
		});

		it('should save state on selectItem', async () => {
			(folderStore as any).isInitialized = true;
			const item: FolderItem = { id: 'item', title: 'Item', url: '#' };
			folderStore.items = [item];

			folderStore.selectItem(item);

			expect(idb.saveFolderState).toHaveBeenCalledWith(expect.objectContaining({
				selectedId: 'item'
			}));
		});

		it('should save state on deleteFolder', async () => {
			(folderStore as any).isInitialized = true;
			folderStore.items = [{ id: 'item', title: 'Item', url: '#' }];

			folderStore.deleteFolder('item');

			expect(idb.saveFolderState).toHaveBeenCalled();
		});

		it('should save state on openFolder', async () => {
			(folderStore as any).isInitialized = true;
			const folder: FolderItem = { id: 'f1', title: 'F1', url: '#', isOpen: false };
			
			folderStore.openFolder(folder);

			expect(folder.isOpen).toBe(true);
			expect(idb.saveFolderState).toHaveBeenCalled();
		});

		it('should NOT save state on createFolder (wait for rename)', async () => {
			(folderStore as any).isInitialized = true;
			folderStore.createFolder();
			expect(idb.saveFolderState).not.toHaveBeenCalled();
		});

		it('should save state on renameFolder', async () => {
			(folderStore as any).isInitialized = true;
			folderStore.items = [{ id: 'item', title: 'Old Name', url: '#' }];
			
			folderStore.renameFolder('item', 'New Name');

			expect(idb.saveFolderState).toHaveBeenCalled();
		});

		it('should NOT save state if not initialized', () => {
			(folderStore as any).isInitialized = false;
			folderStore.items = [{ id: 'item', title: 'Item', url: '#' }];
			
			folderStore.persist();

			expect(idb.saveFolderState).not.toHaveBeenCalled();
		});
	});
});
