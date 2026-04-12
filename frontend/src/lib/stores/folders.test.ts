import { describe, it, expect, beforeEach, vi } from 'vitest';
import { folderStore, type FolderItem } from './folders.svelte';
import * as idbr from './idbr';
import { notesStore } from './notes.svelte';
import { folderService, trashService } from './services';
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
		folderService.delete('parent', fixedEpoch);

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

		trashService.recoverFolder('parent');

		// Parent and Child A match batch and recover
		expect(folderStore.folders.get('parent')?.deletedAt).toBeNull();
		expect(folderStore.folders.get('childA')?.deletedAt).toBeNull();

		// Child B was deleted long before, should remain flagged!
		expect(folderStore.folders.get('childB')?.deletedAt).toBe(oldEpoch);
	});

	it('should root the folder if its parent metadata is missing during recovery', () => {
		(folderStore as any).isInitialized = true;
		const folder: FolderItem = { id: 'f1', title: 'F1', url: '#', parentId: 'missing-parent', deletedAt: 123 };
		folderStore.folders.set('f1', folder);
		
		// Mock has to return false for missing-parent
		const hasSpy = vi.spyOn((folderStore as any).folders, 'has').mockImplementation((id) => {
			if (id === 'missing-parent') return false;
			return true;
		});

		trashService.recoverFolder('f1');

		expect(folderStore.folders.get('f1')?.parentId).toBeNull();
		expect(folderStore.folders.get('f1')?.deletedAt).toBeNull();
	});

	it('should recover all notes within the folder hierarchy during folder recovery', () => {
		(folderStore as any).isInitialized = true;
		const epoch = 123;
		const folder: FolderItem = { id: 'f1', title: 'F1', url: '#', deletedAt: epoch };
		folderStore.folders.set('f1', folder);
		
		const recoverNotesSpy = vi.spyOn(notesStore, 'restoreNotesInFolder');

		trashService.recoverFolder('f1');

		expect(recoverNotesSpy).toHaveBeenCalledWith('f1', epoch);
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

		folderService.delete('item');

		expect(folderStore.selectedFolderID).toBeNull();
	});

	it('should cascade delete notes when a folder is deleted', () => {
		(folderStore as any).isInitialized = true;
		const epoch = 123456789;
		const folder: FolderItem = { id: 'f1', title: 'F1', url: '#', items: [] };
		folderStore.folders.set('f1', folder);
		folderStore.items = ['f1'];

		const deleteNotesSpy = vi.spyOn(notesStore, 'deleteNotesInFolder');

		folderService.delete('f1', epoch);

		expect(deleteNotesSpy).toHaveBeenCalledWith('f1', epoch);
	});

	it('should clear editingId when the folder being renamed is deleted', () => {
		(folderStore as any).isInitialized = true;
		const folder: FolderItem = { id: 'f1', title: 'F1', url: '#' };
		folderStore.folders.set('f1', folder);
		folderStore.items = ['f1'];
		(folderStore as any).editingId = 'f1';

		folderService.delete('f1');

		expect(folderStore.editingId).toBeNull();
	});

	it('should not rename folder to an empty string', () => {
		(folderStore as any).isInitialized = true;
		const folder: FolderItem = { id: 'f1', title: 'Original', url: '#' };
		folderStore.folders.set('f1', folder);

		folderStore.renameFolder('f1', '');

		expect(folderStore.folders.get('f1')?.title).toBe('Original');
		expect(idbr.putFolder).not.toHaveBeenCalled();
	});

	it('should not rename folder to a whitespace-only string', () => {
		(folderStore as any).isInitialized = true;
		const folder: FolderItem = { id: 'f1', title: 'Original', url: '#' };
		folderStore.folders.set('f1', folder);

		folderStore.renameFolder('f1', '   ');

		expect(folderStore.folders.get('f1')?.title).toBe('Original');
		expect(idbr.putFolder).not.toHaveBeenCalled();
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
			folderService.delete('L2', epoch);

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

			folderStore.restoreParentPath('L2');

			expect(folderStore.folders.get('L2')?.deletedAt).toBeNull();
			expect(folderStore.folders.get('L1')?.deletedAt).toBeNull();

			expect(folderStore.folders.get('sibling')?.deletedAt).toBe(epoch);
		});

		it('should correctly identify deletion roots in trashItems', () => {
			(folderStore as any).isInitialized = true;
			const epoch = 555;
			// A (Active) -> B (Deleted) -> C (Deleted)
			const c: FolderItem = { id: 'C', title: 'C', url: '#', parentId: 'B', deletedAt: epoch };
			const b: FolderItem = { id: 'B', title: 'B', url: '#', parentId: 'A', items: ['C'], deletedAt: epoch };
			const a: FolderItem = { id: 'A', title: 'A', url: '#', parentId: null, items: ['B'], deletedAt: null };
			
			folderStore.folders.set('A', a);
			folderStore.folders.set('B', b);
			folderStore.folders.set('C', c);
			folderStore.items = ['A'];

			// Only B should be a root, because its parent A is NOT deleted
			expect(folderStore.trashItems).toContain('B');
			expect(folderStore.trashItems).not.toContain('C');
		});

		it('should find the top deleted ancestor correctly', () => {
			(folderStore as any).isInitialized = true;
			const epoch = 555;
			// A (Active) -> B (Deleted) -> C (Deleted)
			const c: FolderItem = { id: 'C', title: 'C', url: '#', parentId: 'B', deletedAt: epoch };
			const b: FolderItem = { id: 'B', title: 'B', url: '#', parentId: 'A', items: ['C'], deletedAt: epoch };
			const a: FolderItem = { id: 'A', title: 'A', url: '#', parentId: null, items: ['B'], deletedAt: null };
			
			folderStore.folders.set('A', a);
			folderStore.folders.set('B', b);
			folderStore.folders.set('C', c);

			const top = folderStore.findTopDeletedAncestor('C');
			expect(top?.id).toBe('B');
		});

		it('should handle recursive recovery of parent path', () => {
			(folderStore as any).isInitialized = true;
			const epoch = 555;
			// L1 (Deleted) -> L2 (Deleted)
			const l2: FolderItem = { id: 'L2', title: 'L2', url: '#', parentId: 'L1', deletedAt: epoch };
			const l1: FolderItem = { id: 'L1', title: 'L1', url: '#', parentId: null, items: ['L2'], deletedAt: epoch };
			
			folderStore.folders.set('L1', l1);
			folderStore.folders.set('L2', l2);
			folderStore.items = ['L1'];

			folderStore.restoreParentPath('L2');

			expect(folderStore.folders.get('L2')?.deletedAt).toBeNull();
			expect(folderStore.folders.get('L1')?.deletedAt).toBeNull();
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

			folderService.delete('parent');

			expect(folderStore.folders.get('parent')?.deletedAt).toBeDefined();
			expect(folderStore.selectedFolderID).toBeNull();
		});
	});
});
