import { describe, it, expect, beforeEach, vi } from 'vitest';
import { folderStore, type FolderItem } from '../../src/lib/stores/folders.svelte';
import { SvelteMap } from 'svelte/reactivity';

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
		const folder: FolderItem = { id: 'f1', title: 'F1', deletedAt: 123, parentId: null };
		folderStore.folders.set('f1', folder);
		
		expect(folderStore.items).not.toContain('f1');

		folderStore.restoreFolder('f1', 123);

		expect(folderStore.folders.get('f1')?.deletedAt).toBeNull();
		expect(folderStore.items).toContain('f1');
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
