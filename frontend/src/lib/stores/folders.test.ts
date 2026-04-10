import { describe, it, expect, beforeEach, vi } from 'vitest';
import { folderStore, type FolderItem } from './folders.svelte';
import * as idbr from './idbr';
import { SvelteMap } from 'svelte/reactivity';

// Mock crypto.randomUUID
global.crypto.randomUUID = vi.fn(() => 'test-uuid' as any);

// Mock IDBR module
vi.mock('./idbr', () => ({
	putFolder: vi.fn(),
	getAllFolders: vi.fn(),
	putSetting: vi.fn(),
	getAllSettings: vi.fn(),
	initDB: vi.fn(),
	getDB: vi.fn()
}));

describe('FolderStore', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset store state before each test
		(folderStore as any).items = [];
		(folderStore as any).folders = new SvelteMap<string, FolderItem>();
		(folderStore as any).selectedFolderID = null;
		(folderStore as any).editingId = null;
		(folderStore as any).isInitialized = false;
	});

	it('should create a folder at the root when nothing is selected', () => {
		(folderStore as any).isInitialized = true;
		folderStore.createFolder();

		expect(folderStore.items.length).toBe(1);
		expect(folderStore.items[0]).toBe('test-uuid');
		const folder = folderStore.folders.get('test-uuid');
		expect(folder?.title).toBe('New Folder');
		expect(folderStore.selectedFolderID).toBe('test-uuid');
		expect(idbr.putFolder).toHaveBeenCalled();
	});

	it('should support folders with a type', () => {
		const folder: FolderItem = { id: 'all', title: 'All', url: '#', type: 'all' };
		folderStore.folders.set('all', folder);
		folderStore.items = ['all'];
		expect(folderStore.folders.get('all')?.type).toBe('all');
	});

	it('should provide a default folder id and create if none exists', () => {
		(folderStore as any).isInitialized = true;
		const id = folderStore.getDefaultFolderId();
		expect(id).toBe('notes');
		expect(folderStore.folders.has('notes')).toBe(true);
		expect(folderStore.items).toContain('notes');
	});

	it('should return existing regular folder as default', () => {
		const folder: FolderItem = { id: 'existing', title: 'Existing', url: '#' };
		folderStore.folders.set('existing', folder);
		folderStore.items = ['existing'];

		const id = folderStore.getDefaultFolderId();
		expect(id).toBe('existing');
		expect(folderStore.items.length).toBe(1);
	});

	it('should create a folder inside a selected folder', () => {
		(folderStore as any).isInitialized = true;
		const parent: FolderItem = { id: 'parent', title: 'Parent', url: '#', items: [] };
		folderStore.folders.set('parent', parent);
		folderStore.items = ['parent'];
		folderStore.selectFolder('parent');

		folderStore.createFolder();

		expect(parent.items?.length).toBe(1);
		expect(parent.items?.[0]).toBe('test-uuid');
		expect(parent.isOpen).toBe(true);

		const child = folderStore.folders.get('test-uuid');
		expect(child?.parentId).toBe('parent');
		expect(folderStore.selectedFolderID).toBe('test-uuid');
	});

	it('should soft delete a folder and cascade deletedAt batches', () => {
		(folderStore as any).isInitialized = true;
		const child: FolderItem = { id: 'child', title: 'Child', url: '#', parentId: 'parent' };
		const parent: FolderItem = {
			id: 'parent',
			title: 'Parent',
			url: '#',
			items: ['child']
		};

		folderStore.folders.set('parent', parent);
		folderStore.folders.set('child', child);
		folderStore.items = ['parent'];

		const fixedEpoch = 123456789;
		folderStore.deleteFolder('parent', fixedEpoch);

		// Structural map intact
		expect(folderStore.items).toContain('parent');
		expect(folderStore.folders.get('parent')?.items).toContain('child');
		expect(folderStore.folders.get('child')?.parentId).toBe('parent');

		// Batched flags applied perfectly
		expect(folderStore.folders.get('parent')?.deletedAt).toBe(fixedEpoch);
		expect(folderStore.folders.get('child')?.deletedAt).toBe(fixedEpoch);
	});

	it('should recover a folder recursively only if it shares the target batch epoch', () => {
		(folderStore as any).isInitialized = true;
		const validEpoch = 11111;
		const oldEpoch = 99999;
		const childA: FolderItem = {
			id: 'childA',
			title: 'ChildA',
			url: '#',
			parentId: 'parent',
			deletedAt: validEpoch
		};
		const childB: FolderItem = {
			id: 'childB',
			title: 'ChildB',
			url: '#',
			parentId: 'parent',
			deletedAt: oldEpoch
		};
		const parent: FolderItem = {
			id: 'parent',
			title: 'Parent',
			url: '#',
			items: ['childA', 'childB'],
			deletedAt: validEpoch,
			parentId: null
		};

		folderStore.folders.set('parent', parent);
		folderStore.folders.set('childA', childA);
		folderStore.folders.set('childB', childB);

		folderStore.recoverFolderAndChildren('parent');

		// Parent and Child A match batch and recover
		expect(folderStore.folders.get('parent')?.deletedAt).toBeNull();
		expect(folderStore.folders.get('childA')?.deletedAt).toBeNull();

		// Child B was deleted long before, should remain flagged!
		expect(folderStore.folders.get('childB')?.deletedAt).toBe(oldEpoch);
	});

	it('should start renaming correctly', () => {
		vi.useFakeTimers();
		folderStore.startRename('folder-1');
		vi.runAllTimers();

		expect(folderStore.editingId).toBe('folder-1');
		vi.useRealTimers();
	});

	it('should clear selection if selected item is deleted', () => {
		(folderStore as any).isInitialized = true;
		const item: FolderItem = { id: 'item', title: 'Item', url: '#' };
		folderStore.folders.set('item', item);
		folderStore.items = ['item'];
		folderStore.selectFolder('item');

		folderStore.deleteFolder('item');

		expect(folderStore.selectedFolderID).toBeNull();
	});

	describe('Persistence', () => {
		it('should load state on init', async () => {
			const savedFolders = [{ id: 'f1', title: 'F1', url: '#' }];
			vi.mocked(idbr.getAllFolders).mockResolvedValue(savedFolders as any);
			vi.mocked(idbr.getAllSettings).mockResolvedValue({
				selectedFolderID: 'f1',
				selectedNoteID: null
			});

			await folderStore.init();

			expect(folderStore.folders.has('f1')).toBe(true);
			expect(folderStore.items).toContain('f1');
			expect(folderStore.selectedFolderID).toBe('f1');
		});

		it('should throw error when initialization fails', async () => {
			vi.mocked(idbr.getAllFolders).mockRejectedValue(new Error('DB Error'));

			await expect(folderStore.init()).rejects.toThrow('DB Error');
			expect((folderStore as any).isInitialized).toBe(false);
		});

		it('should save setting when selection changes', async () => {
			(folderStore as any).isInitialized = true;
			const item: FolderItem = { id: 'item', title: 'Item', url: '#' };
			folderStore.folders.set('item', item);
			folderStore.items = ['item'];

			folderStore.selectFolder('item');

			expect(idbr.putSetting).toHaveBeenCalledWith('selectedFolderID', 'item');
		});

		it('should save folder when title changes (rename)', async () => {
			(folderStore as any).isInitialized = true;
			const item: FolderItem = { id: 'item', title: 'Old Name', url: '#' };
			folderStore.folders.set('item', item);

			folderStore.renameFolder('item', 'New Name');

			expect(item.title).toBe('New Name');
			expect(idbr.putFolder).toHaveBeenCalled();
		});

		it('should save folder when isOpen toggles', async () => {
			(folderStore as any).isInitialized = true;
			const item: FolderItem = { id: 'f1', title: 'F1', url: '#', isOpen: false };
			folderStore.folders.set('f1', item);

			folderStore.openFolder('f1');

			expect(item.isOpen).toBe(true);
			expect(idbr.putFolder).toHaveBeenCalled();
		});

		it('should NOT save state if not initialized', () => {
			(folderStore as any).isInitialized = false;
			const item: FolderItem = { id: 'item', title: 'Item', url: '#' };
			folderStore.folders.set('item', item);

			folderStore.persist('item');

			expect(idbr.putFolder).not.toHaveBeenCalled();
		});
	});

	describe('Complex Tree Operations (Edge Cases)', () => {
		it('should propagate epoch across deeply nested structures', () => {
			(folderStore as any).isInitialized = true;
			// L1 -> L2 -> L3
			const l3: FolderItem = { id: 'L3', title: 'L3', url: '#', parentId: 'L2' };
			const l2: FolderItem = { id: 'L2', title: 'L2', url: '#', parentId: 'L1', items: ['L3'] };
			const l1: FolderItem = { id: 'L1', title: 'L1', url: '#', parentId: null, items: ['L2'] };

			folderStore.folders.set('L1', l1);
			folderStore.folders.set('L2', l2);
			folderStore.folders.set('L3', l3);
			folderStore.items = ['L1'];

			const epoch = 555;
			folderStore.deleteFolder('L2', epoch);

			expect(folderStore.folders.get('L1')?.items).toContain('L2');
			expect(folderStore.folders.get('L2')?.parentId).toBe('L1');

			// Epochs cascade completely
			expect(folderStore.folders.get('L2')?.deletedAt).toBe(epoch);
			expect(folderStore.folders.get('L3')?.deletedAt).toBe(epoch);
		});

		it('should selectively recover paths without recovering siblings', () => {
			(folderStore as any).isInitialized = true;
			const epoch = 555;
			const sibling: FolderItem = {
				id: 'sibling',
				title: 'Sibling',
				url: '#',
				parentId: 'L1',
				deletedAt: epoch
			};
			const l2: FolderItem = { id: 'L2', title: 'L2', url: '#', parentId: 'L1', deletedAt: epoch };
			const l1: FolderItem = {
				id: 'L1',
				title: 'L1',
				url: '#',
				parentId: null,
				items: ['L2', 'sibling'],
				deletedAt: epoch
			};

			folderStore.folders.set('L1', l1);
			folderStore.folders.set('L2', l2);
			folderStore.folders.set('sibling', sibling);
			folderStore.items = ['L1'];

			folderStore.recoverParentPath('L2');

			expect(folderStore.folders.get('L2')?.deletedAt).toBeNull();
			expect(folderStore.folders.get('L1')?.deletedAt).toBeNull();

			expect(folderStore.folders.get('sibling')?.deletedAt).toBe(epoch);
		});

		it('should strictly recreate active folder paths from trash configurations without mutating the original trash structures', () => {
			(folderStore as any).isInitialized = true;
			const epoch = 555;
			const child: FolderItem = { id: 'child', title: 'Child', url: '#', parentId: 'parent', items: [], deletedAt: epoch };
			const parent: FolderItem = { id: 'parent', title: 'Parent', url: '#', parentId: null, items: ['child'], deletedAt: epoch };
			
			folderStore.folders.set('parent', parent);
			folderStore.folders.set('child', child);
			folderStore.items = ['parent'];

			const activeChildId = folderStore.recreateActivePathForFolder('child');

			const activeChild = folderStore.folders.get(activeChildId);
			expect(activeChild).toBeDefined();
			expect(activeChild?.deletedAt).toBeNull();
			expect(activeChild?.title).toBe('Child');
			expect(activeChildId).not.toBe('child'); // It's a fresh clone UUID

			// Ensure original trash hierarchy remained locked and unmutated
			expect(folderStore.folders.get('child')?.deletedAt).toBe(epoch);
			expect(folderStore.folders.get('parent')?.deletedAt).toBe(epoch);
		});

		it('should dynamically cascade-prune dead trash hierarchies upward when emptied of data', async () => {
			(folderStore as any).isInitialized = true;
			const epoch = 555;
			const child: FolderItem = { id: 'garbage-child', title: 'Child', url: '#', parentId: 'garbage-parent', items: [], deletedAt: epoch };
			const parent: FolderItem = { id: 'garbage-parent', title: 'Parent', url: '#', parentId: null, items: ['garbage-child'], deletedAt: epoch };
			
			folderStore.folders.set('garbage-parent', parent);
			folderStore.folders.set('garbage-child', child);
			folderStore.items = ['garbage-parent'];

			// Assuming no notes live here, pruning child destroys both
			await folderStore.pruneEmptyTrashPath('garbage-child');

			expect(folderStore.folders.has('garbage-child')).toBe(false);
			expect(folderStore.folders.has('garbage-parent')).toBe(false);
			expect(folderStore.items).not.toContain('garbage-parent');
		});

		it('should clear selection if its parent is deleted', () => {
			(folderStore as any).isInitialized = true;
			const leaf: FolderItem = { id: 'leaf', title: 'Leaf', url: '#', parentId: 'parent' };
			const parent: FolderItem = {
				id: 'parent',
				title: 'Parent',
				url: '#',
				items: ['leaf']
			};
			folderStore.folders.set('parent', parent);
			folderStore.folders.set('leaf', leaf);
			folderStore.items = ['parent'];

			folderStore.selectFolder('leaf');
			expect(folderStore.selectedFolderID).toBe('leaf');

			folderStore.deleteFolder('parent');

			expect(folderStore.folders.get('parent')?.deletedAt).toBeDefined();
			expect(folderStore.selectedFolderID).toBeNull();
		});
	});
});
