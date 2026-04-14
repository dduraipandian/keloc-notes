import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FolderTreeHelper } from '../../src/lib/stores/domain/folderTree';
import type { FolderItem, FolderID } from '../../src/lib/stores/folders.svelte';
import { SvelteMap } from 'svelte/reactivity';

describe('FolderTreeHelper (Flat Model)', () => {
	let folders: any;
	let notes: any;
	let helper: FolderTreeHelper;

	beforeEach(() => {
		folders = {
			items: [] as string[],
			folders: new SvelteMap<string, FolderItem>(),
			findItemById: vi.fn((id: string) => folders.folders.get(id) || null)
		};
		notes = {
			listNotes: vi.fn().mockReturnValue([])
		};
		helper = new FolderTreeHelper(folders, notes);
	});

	it('should correctly filter notes for the Home view', () => {
		folders.folders.set('home', { id: 'home', title: 'Home', profile: 'home' } as any);
		notes.listNotes.mockReturnValue([
			{ id: '1', folderId: null, deletedAt: null },
			{ id: '2', folderId: 'f1', deletedAt: null }
		]);

		const result = helper.getNotesForFolder(null, 'home');
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('1');
	});

	it('should return no children for the Home view (Sidebar Isolation)', () => {
		folders.items = ['f1', 'f2'];
		folders.folders.set('f1', { id: 'f1', title: 'F1', parentId: null, deletedAt: null } as any);
		folders.folders.set('f2', { id: 'f2', title: 'F2', parentId: 'f1', deletedAt: null } as any);

		const result = helper.getHomeFolderChildIds();
		expect(result).toEqual([]);
	});
});
