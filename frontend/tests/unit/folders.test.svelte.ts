import { describe, it, expect, beforeEach, vi } from 'vitest';
import { folderStore, type FolderItem } from '../../src/lib/stores/folders.svelte';
import { SvelteMap } from 'svelte/reactivity';
import { foldersRepository } from '../../src/lib/stores/repositories';

// Mock repositories to avoid IndexedDB errors
vi.mock('../../src/lib/stores/repositories', () => ({
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
	}
}));

// Mock crypto.randomUUID
global.crypto.randomUUID = vi.fn(() => 'test-uuid' as any);

describe('FolderStore (Flat Recovery & Validation)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(folderStore as any).items = [];
		(folderStore as any).folders = new SvelteMap<string, FolderItem>();
		(folderStore as any).isInitialized = true;
		(folderStore as any).onPersistError = null;
		(folderStore as any).editingId = null;
		(folderStore as any).editingTitle = '';
		(folderStore as any).rejectedRename = null;
	});

	it('should root a folder and add to items list if its parent is deleted', () => {
		const parent: FolderItem = { id: 'p1', title: 'Parent', deletedAt: 123, items: ['c1'] };
		const child: FolderItem = { id: 'c1', title: 'Child', parentId: 'p1', deletedAt: 123 };
		
		folderStore.folders.set('p1', parent);
		folderStore.folders.set('c1', child);
		
		// Currently child is not in root items
		expect(folderStore.items).not.toContain('c1');

		// Execution: rootFolderIfParentMissing
		folderStore.rootFolderIfParentMissing('c1');

		// Verification: parentId becomes null AND child is added to root items
		expect(folderStore.folders.get('c1')?.parentId).toBeNull();
		expect(folderStore.items).toContain('c1');
	});

	it('should root a folder if its parent metadata is MISSING', () => {
		const folder: FolderItem = { id: 'f1', title: 'F1', parentId: 'missing', deletedAt: 123 };
		folderStore.folders.set('f1', folder);
		
		folderStore.rootFolderIfParentMissing('f1');

		expect(folderStore.folders.get('f1')?.parentId).toBeNull();
		expect(folderStore.items).toContain('f1');
	});

	it('should add to items list during restoreFolder if recovering to root', () => {
		const folder: FolderItem = { id: 'f1', title: 'F1', deletedAt: 123, deletedBatchId: 'batch-f1', parentId: null };
		folderStore.folders.set('f1', folder);
		
		expect(folderStore.items).not.toContain('f1');

		folderStore.restoreFolder('f1', 'batch-f1');

		expect(folderStore.folders.get('f1')?.deletedAt).toBeNull();
		expect(folderStore.items).toContain('f1');
	});

	it('surfaces folder persistence errors through onPersistError', async () => {
		const onPersistError = vi.fn();
		(folderStore as any).onPersistError = onPersistError;
		(foldersRepository.save as any).mockRejectedValueOnce(new Error('folder save failed'));

		folderStore.folders.set('f1', { id: 'f1', title: 'Folder', deletedAt: null, deletedBatchId: null });
		folderStore.renameFolder('f1', 'Renamed');
		await Promise.resolve();

		expect(onPersistError).toHaveBeenCalledTimes(1);
		expect(onPersistError).toHaveBeenCalledWith(expect.any(Error), 'f1');
		expect(onPersistError.mock.calls[0][0].message).toBe('folder save failed');
	});

	it('does not invoke onPersistError for successful folder persistence', async () => {
		const onPersistError = vi.fn();
		(folderStore as any).onPersistError = onPersistError;
		(foldersRepository.save as any).mockResolvedValueOnce(undefined);

		folderStore.folders.set('f1', { id: 'f1', title: 'Folder', deletedAt: null, deletedBatchId: null });
		folderStore.renameFolder('f1', 'Renamed');
		await Promise.resolve();

		expect(onPersistError).not.toHaveBeenCalled();
	});

	it('rejects empty folder renames without mutating the stored title', () => {
		folderStore.folders.set('f1', { id: 'f1', title: 'Folder', deletedAt: null, deletedBatchId: null });
		(folderStore as any).editingId = 'f1';
		(folderStore as any).editingTitle = '';

		folderStore.renameFolder('f1', '   ');

		expect(folderStore.folders.get('f1')?.title).toBe('Folder');
		expect((folderStore as any).editingId).toBeNull();
		expect((folderStore as any).editingTitle).toBe('Folder');
		expect((folderStore as any).rejectedRename).toEqual(
			expect.objectContaining({ id: 'f1' })
		);
		expect(foldersRepository.save).not.toHaveBeenCalled();
	});
});

describe('FolderStore Reactivity (Regression Test)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(folderStore as any).items = [];
		(folderStore as any).folders = new SvelteMap<string, FolderItem>();
		(folderStore as any).isInitialized = true;
	});

	it('should be reactive when folder title is updated', () => {
		const id = folderStore.createFolder();
		const folder = folderStore.folders.get(id!);
		
		let updateCount = 0;
		const derivedTitle = $derived.by(() => {
			updateCount++;
			return folder?.title;
		});

		// Initial access to track
		expect(derivedTitle).toBe('New Folder');
		expect(updateCount).toBe(1);

		// Mutate title
		folderStore.renameFolder(id!, 'Updated Title');

		// Assert update trace
		expect(folder?.title).toBe('Updated Title');
		expect(derivedTitle).toBe('Updated Title');
		expect(updateCount).toBe(2); 
	});
});
