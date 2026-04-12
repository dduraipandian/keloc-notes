import { describe, it, expect, beforeEach, vi } from 'vitest';
import { folderStore, type FolderItem } from '../folders.svelte';
import { SvelteMap } from 'svelte/reactivity';
import { getSource, listVirtualViews, listRootFolderSources } from './registry.svelte';
import { PROTECTED_NOTES_FOLDER_ID, TRASH_VIEW_ID } from './constants';

vi.mock('../idbr', () => ({
	putFolder: vi.fn(),
	getAllFolders: vi.fn(),
	putNote: vi.fn(),
	getAllNotes: vi.fn(),
	putSetting: vi.fn(),
	getAllSettings: vi.fn(),
	initDB: vi.fn(),
	getDB: vi.fn()
}));

const addFolder = (f: Partial<FolderItem> & { id: string }) => {
	const folder: FolderItem = { title: 'Folder', url: '#', items: [], parentId: null, deletedAt: null, ...f };
	folderStore.folders.set(f.id, folder);
	if (!folder.parentId) folderStore.items.push(f.id);
};

describe('registry', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();
		(folderStore as any).items = [];
		(folderStore as any).folders = new SvelteMap();
	});

	describe('getSource', () => {
		it('resolves TRASH_VIEW_ID to trashView', () => {
			const source = getSource(TRASH_VIEW_ID);
			expect(source).not.toBeNull();
			expect(source!.id).toBe(TRASH_VIEW_ID);
			expect(source!.kind).toBe('view');
		});

		it('resolves a real folder id to a FolderSource', () => {
			addFolder({ id: 'f1', title: 'Work' });
			const source = getSource('f1');
			expect(source).not.toBeNull();
			expect(source!.id).toBe('f1');
			expect(source!.kind).toBe('folder');
			expect(source!.title).toBe('Work');
		});

		it('returns null for unknown ids', () => {
			expect(getSource('nonexistent')).toBeNull();
		});

		it('resolves PROTECTED_NOTES_FOLDER_ID when the folder exists', () => {
			addFolder({ id: PROTECTED_NOTES_FOLDER_ID, isProtected: true });
			const source = getSource(PROTECTED_NOTES_FOLDER_ID);
			expect(source).not.toBeNull();
			expect(source!.kind).toBe('folder');
		});
	});

	describe('listVirtualViews', () => {
		it('includes the trash view', () => {
			const views = listVirtualViews();
			expect(views.some((v) => v.id === TRASH_VIEW_ID)).toBe(true);
		});

		it('all entries have kind view', () => {
			listVirtualViews().forEach((v) => expect(v.kind).toBe('view'));
		});
	});

	describe('listRootFolderSources', () => {
		it('puts the protected notes folder first', () => {
			addFolder({ id: PROTECTED_NOTES_FOLDER_ID, isProtected: true });
			addFolder({ id: 'user1', title: 'User Folder' });
			folderStore.items = [PROTECTED_NOTES_FOLDER_ID, 'user1'];

			const sources = listRootFolderSources();
			expect(sources[0].id).toBe(PROTECTED_NOTES_FOLDER_ID);
		});

		it('excludes deleted folders', () => {
			addFolder({ id: PROTECTED_NOTES_FOLDER_ID, isProtected: true });
			addFolder({ id: 'deleted', deletedAt: Date.now() });
			folderStore.items = [PROTECTED_NOTES_FOLDER_ID, 'deleted'];

			const sources = listRootFolderSources();
			expect(sources.map((s) => s.id)).not.toContain('deleted');
		});

		it('does not duplicate the protected notes folder', () => {
			addFolder({ id: PROTECTED_NOTES_FOLDER_ID, isProtected: true });
			folderStore.items = [PROTECTED_NOTES_FOLDER_ID];

			const sources = listRootFolderSources();
			expect(sources.filter((s) => s.id === PROTECTED_NOTES_FOLDER_ID)).toHaveLength(1);
		});
	});
});
