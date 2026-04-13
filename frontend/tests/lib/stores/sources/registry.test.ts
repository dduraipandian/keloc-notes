import { beforeEach, describe, expect, it, vi } from 'vitest';
import { folderStore, type FolderItem } from '$lib/stores/folders.svelte';
import { FAVORITES_VIEW_ID, PROTECTED_NOTES_FOLDER_ID, TRASH_VIEW_ID } from '$lib/stores/sources/constants';
import {
	getSource,
	listPinnedSources,
	listRootFolderSources,
	listSidebarSectionSources
} from '$lib/stores/sources/registry.svelte';

vi.mock('$lib/stores/repositories', () => ({
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

const addFolder = (folder: Partial<FolderItem> & { id: string }) => {
	const value: FolderItem = {
		title: 'Folder',
		url: '#',
		items: [],
		parentId: null,
		deletedAt: null,
		...folder
	};
	folderStore.folders.set(folder.id, value);
	if (!value.parentId) folderStore.items.push(folder.id);
};

describe('source registry', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(folderStore as any).items = [];
		folderStore.folders.clear();
	});

	it('resolves virtual views before folders', () => {
		expect(getSource(TRASH_VIEW_ID)?.kind).toBe('view');
		expect(getSource(FAVORITES_VIEW_ID)?.kind).toBe('view');
	});

	it('resolves real folders as folder sources', () => {
		addFolder({ id: 'work', title: 'Work' });

		expect(getSource('work')).toEqual(
			expect.objectContaining({
				id: 'work',
				kind: 'folder',
				title: 'Work'
			})
		);
	});

	it('keeps the protected notes folder out of the regular folder tree', () => {
		addFolder({ id: PROTECTED_NOTES_FOLDER_ID, title: 'Notes' });
		addFolder({ id: 'work', title: 'Work' });
		folderStore.items = [PROTECTED_NOTES_FOLDER_ID, 'work'];

		expect(listRootFolderSources().map((source) => source.id)).toEqual(['work']);
	});

	it('lists pinned sources in sidebar order', () => {
		addFolder({ id: PROTECTED_NOTES_FOLDER_ID, title: 'Notes' });

		expect(listPinnedSources().map((source) => source.id)).toEqual([
			PROTECTED_NOTES_FOLDER_ID,
			FAVORITES_VIEW_ID,
			TRASH_VIEW_ID
		]);
	});

	it('lists section sources through the shared sidebar registry', () => {
		addFolder({ id: PROTECTED_NOTES_FOLDER_ID, title: 'Notes' });
		addFolder({ id: 'work', title: 'Work' });
		folderStore.items = [PROTECTED_NOTES_FOLDER_ID, 'work'];

		expect(listSidebarSectionSources('views').map((source) => source.id)).toEqual([
			PROTECTED_NOTES_FOLDER_ID,
			FAVORITES_VIEW_ID,
			TRASH_VIEW_ID
		]);
		expect(listSidebarSectionSources('folders').map((source) => source.id)).toEqual(['work']);
	});
});
