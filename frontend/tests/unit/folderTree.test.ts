import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FolderTreeHelper } from '../../src/lib/stores/domain/folderTree';
import type { FolderItem, FolderID } from '../../src/lib/stores/folders.svelte';
import { SvelteMap } from 'svelte/reactivity';
import { resolveProfile } from '../../src/lib/stores/domain/profiles';

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

	it('should include notes with folderId: "home" in the Home view', () => {
		folders.folders.set('home', { id: 'home', title: 'Home', profile: 'home' } as any);
		notes.listNotes.mockReturnValue([
			{ id: '1', folderId: null, deletedAt: null },
			{ id: '2', folderId: 'home', deletedAt: null },
			{ id: '3', folderId: 'other', deletedAt: null }
		]);

		const result = helper.getNotesForFolder(null, 'home');
		expect(result).toHaveLength(2);
		expect(result.map(n => n.id)).toContain('1');
		expect(result.map(n => n.id)).toContain('2');
	});

	it('should resolve children for the Home view if parentId is "home"', () => {
		const homeItem = { id: 'home', title: 'Home', profile: 'home' } as any;
		folders.folders.set('home', homeItem);
		folders.folders.set('f1', { id: 'f1', title: 'F1', parentId: 'home', deletedAt: null } as any);
		folders.folders.set('f2', { id: 'f2', title: 'F2', parentId: null, deletedAt: null } as any);

		const profile = resolveProfile(homeItem);
		const result = profile.resolveChildFolderIds(homeItem, folders);
		expect(result).toEqual(['f1']);
	});
});
