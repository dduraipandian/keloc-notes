import { describe, it, expect, beforeEach, vi } from 'vitest';
import { folderStore, type FolderItem } from './folders.svelte';

// Mock crypto.randomUUID
global.crypto.randomUUID = vi.fn(() => 'test-uuid' as any);

describe('FolderStore', () => {
	beforeEach(() => {
		// Reset store state before each test
		folderStore.items = [];
		folderStore.selectedItem = null;
		folderStore.editingId = null;
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
		folderStore.items = [item];
		folderStore.selectItem(item);

		folderStore.deleteFolder('item');

		expect(folderStore.selectedItem).toBeNull();
	});
});
