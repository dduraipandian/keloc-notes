import { describe, expect, it, vi } from 'vitest';
import { FolderSidebarView } from '../../src/lib/views/folderSidebarView.svelte';

// Re-usable mock factory
function createView(opts: {
	items?: string[];
	folders: Record<string, any>;
	trashRootIds?: string[];
	favoriteFolderIds?: string[];
	homeFolderChildIds?: string[];
	noteCountFn?: (id: string) => number;
	selectedFolderID?: string | null;
	actions?: any;
}) {
	const foldersMap = new Map(Object.entries(opts.folders));
	return new FolderSidebarView(
		{ items: opts.items ?? [], folders: foldersMap, editingId: null } as any,
		{
			getTrashRootIds: vi.fn().mockReturnValue(opts.trashRootIds ?? []),
			getFavoriteFolderIds: vi.fn().mockReturnValue(opts.favoriteFolderIds ?? []),
			getHomeFolderChildIds: vi.fn().mockReturnValue(opts.homeFolderChildIds ?? [])
		} as any,
		{
			getNoteCountForFolder: vi
				.fn()
				.mockImplementation(opts.noteCountFn ?? (() => 0))
		} as any,
		{
			selectedFolderID: opts.selectedFolderID ?? null,
			getSelectedFolder: vi.fn()
		} as any,
		opts.actions
	);
}

function findViewSource(view: FolderSidebarView, id: string) {
	return view.getSections().find((s) => s.id === 'views')?.sources.find((s) => s.id === id);
}

function findFolderSource(view: FolderSidebarView, id: string) {
	return view.getSections().find((s) => s.id === 'folders')?.sources.find((s) => s.id === id);
}

function defaultMockActions() {
	return {
		folderCreate: vi.fn(),
		folderStartRename: vi.fn(),
		folderDelete: vi.fn(),
		folderSetFavorite: vi.fn(),
		trashRecover: vi.fn(),
		trashPermanentDelete: vi.fn(),
		trashEmpty: vi.fn()
	};
}

describe('sections', () => {
	it('has views section with null label and folders section with "Folders" label', () => {
		const view = createView({
			items: ['work'],
			folders: {
				'deleted-notes': { id: 'deleted-notes', title: 'Trash', profile: 'deleted-notes' },
				favorites: { id: 'favorites', title: 'Favorites', profile: 'favorites' },
				home: { id: 'home', title: 'Home', profile: 'home' },
				work: { id: 'work', title: 'Work', profile: 'regular' }
			}
		});
		const sections = view.getSections();
		expect(sections[0]).toMatchObject({ id: 'views', label: null });
		expect(sections[1]).toMatchObject({ id: 'folders', label: 'Folders' });
	});

	it('excludes system and trash folders from the folders section', () => {
		const view = createView({
			items: ['work', 'deleted-notes', 'favorites', 'home'],
			folders: {
				'deleted-notes': { id: 'deleted-notes', title: 'Trash', profile: 'deleted-notes' },
				favorites: { id: 'favorites', title: 'Favorites', profile: 'favorites' },
				home: { id: 'home', title: 'Home', profile: 'home' },
				work: { id: 'work', title: 'Work', profile: 'regular' }
			}
		});
		const folderSources = view.getSections().find((s) => s.id === 'folders')?.sources ?? [];
		expect(folderSources.map((s) => s.id)).toEqual(['work']);
	});
});

describe('trash profile', () => {
	it('resolves trash kind and has emptyTrash capability', () => {
		const view = createView({
			folders: {
				'deleted-notes': { id: 'deleted-notes', title: 'Trash', profile: 'deleted-notes' },
				favorites: { id: 'favorites', title: 'Favorites', profile: 'favorites' },
				home: { id: 'home', title: 'Home', profile: 'home' }
			}
		});
		const trash = findViewSource(view, 'deleted-notes');
		expect(trash?.profile).toBe('deleted-notes');
		expect(trash?.capabilities.emptyTrash).toBe(true);
		expect(trash?.capabilities.createFolder).toBe(false);
	});

	it('shows deleted folders as children from getTrashRootIds', () => {
		const view = createView({
			folders: {
				'deleted-notes': { id: 'deleted-notes', title: 'Trash', profile: 'deleted-notes' },
				favorites: { id: 'favorites', title: 'Favorites', profile: 'favorites' },
				home: { id: 'home', title: 'Home', profile: 'home' },
				'del-1': { id: 'del-1', title: 'Deleted Folder', deletedAt: 100 }
			},
			trashRootIds: ['del-1']
		});
		const trash = findViewSource(view, 'deleted-notes');
		expect(trash?.children).toHaveLength(1);
		expect(trash?.children[0].id).toBe('del-1');
		expect(trash?.children[0].profile).toBe('deleted');
	});

	it('does not show sub-children of deleted folders (trash is flat)', () => {
		const view = createView({
			folders: {
				'deleted-notes': { id: 'deleted-notes', title: 'Trash', profile: 'deleted-notes' },
				favorites: { id: 'favorites', title: 'Favorites', profile: 'favorites' },
				home: { id: 'home', title: 'Home', profile: 'home' },
				'del-1': { id: 'del-1', title: 'Deleted', deletedAt: 100, items: ['sub-1'] },
				'sub-1': { id: 'sub-1', title: 'Sub', deletedAt: 100, parentId: 'del-1' }
			},
			trashRootIds: ['del-1']
		});
		const deletedChild = findViewSource(view, 'deleted-notes')?.children[0];
		expect(deletedChild?.children).toEqual([]);
	});

	it('context menu has only "Empty Trash"', () => {
		const actions = defaultMockActions();
		const view = createView({
			folders: {
				'deleted-notes': { id: 'deleted-notes', title: 'Trash', profile: 'deleted-notes' },
				favorites: { id: 'favorites', title: 'Favorites', profile: 'favorites' },
				home: { id: 'home', title: 'Home', profile: 'home' }
			},
			actions
		});
		const trash = findViewSource(view, 'deleted-notes');
		expect(trash?.contextMenuItems.map((m) => m.label)).toEqual(['Empty Trash']);
		trash?.contextMenuItems[0].action();
		expect(actions.trashEmpty).toHaveBeenCalled();
	});
});

describe('favorites profile', () => {
	it('resolves favorites kind with star icon', () => {
		const view = createView({
			folders: {
				'deleted-notes': { id: 'deleted-notes', title: 'Trash', profile: 'deleted-notes' },
				favorites: { id: 'favorites', title: 'Favorites', profile: 'favorites' },
				home: { id: 'home', title: 'Home', profile: 'home' }
			}
		});
		const fav = findViewSource(view, 'favorites');
		expect(fav?.profile).toBe('favorites');
		expect(fav?.icon).toEqual(expect.any(Function)); // Star component
	});

	it('shows favorite folders as children', () => {
		const view = createView({
			folders: {
				'deleted-notes': { id: 'deleted-notes', title: 'Trash', profile: 'deleted-notes' },
				favorites: { id: 'favorites', title: 'Favorites', profile: 'favorites' },
				home: { id: 'home', title: 'Home', profile: 'home' },
				work: { id: 'work', title: 'Work', isFavorite: true, deletedAt: null }
			},
			favoriteFolderIds: ['work']
		});
		const fav = findViewSource(view, 'favorites');
		expect(fav?.children).toHaveLength(1);
		expect(fav?.children[0].id).toBe('work');
	});

	it('hides deleted favorites', () => {
		const view = createView({
			folders: {
				'deleted-notes': { id: 'deleted-notes', title: 'Trash', profile: 'deleted-notes' },
				favorites: { id: 'favorites', title: 'Favorites', profile: 'favorites' },
				home: { id: 'home', title: 'Home', profile: 'home' },
				work: { id: 'work', title: 'Work', isFavorite: true, deletedAt: 123 }
			},
			favoriteFolderIds: ['work']
		});
		const fav = findViewSource(view, 'favorites');
		expect(fav?.children).toEqual([]);
	});

	it('does not show sub-children of favorite folders', () => {
		const view = createView({
			folders: {
				'deleted-notes': { id: 'deleted-notes', title: 'Trash', profile: 'deleted-notes' },
				favorites: { id: 'favorites', title: 'Favorites', profile: 'favorites' },
				home: { id: 'home', title: 'Home', profile: 'home' },
				work: { id: 'work', title: 'Work', isFavorite: true, deletedAt: null, items: ['sub'] },
				sub: { id: 'sub', title: 'Sub', parentId: 'work', deletedAt: null }
			},
			favoriteFolderIds: ['work']
		});
		const favChild = findViewSource(view, 'favorites')?.children[0];
		expect(favChild?.children).toEqual([]);
	});

	it('has no capabilities and empty context menu', () => {
		const view = createView({
			folders: {
				'deleted-notes': { id: 'deleted-notes', title: 'Trash', profile: 'deleted-notes' },
				favorites: { id: 'favorites', title: 'Favorites', profile: 'favorites' },
				home: { id: 'home', title: 'Home', profile: 'home' }
			}
		});
		const fav = findViewSource(view, 'favorites');
		expect(fav?.capabilities.createFolder).toBe(false);
		expect(fav?.capabilities.favorite).toBe(false);
		expect(fav?.contextMenuItems).toEqual([]);
	});
});

describe('home profile', () => {
	it('resolves home kind for the home system folder', () => {
		const view = createView({
			folders: {
				'deleted-notes': { id: 'deleted-notes', title: 'Trash', profile: 'deleted-notes' },
				favorites: { id: 'favorites', title: 'Favorites', profile: 'favorites' },
				home: { id: 'home', title: 'Home', profile: 'home' }
			}
		});
		const home = findViewSource(view, 'home');
		expect(home?.profile).toBe('home');
	});

	it('allows creating sub-folders but not rename/delete/favorite', () => {
		const view = createView({
			folders: {
				'deleted-notes': { id: 'deleted-notes', title: 'Trash', profile: 'deleted-notes' },
				favorites: { id: 'favorites', title: 'Favorites', profile: 'favorites' },
				home: { id: 'home', title: 'Home', profile: 'home' }
			}
		});
		const home = findViewSource(view, 'home');
		expect(home?.capabilities.createFolder).toBe(true);
		expect(home?.capabilities.rename).toBe(false);
		expect(home?.capabilities.delete).toBe(false);
		expect(home?.capabilities.favorite).toBe(false);
	});

	it('shows sub-folders and they can expand (childrenExpandable=true)', () => {
		const view = createView({
			folders: {
				'deleted-notes': { id: 'deleted-notes', title: 'Trash', profile: 'deleted-notes' },
				favorites: { id: 'favorites', title: 'Favorites', profile: 'favorites' },
				home: { id: 'home', title: 'Home', profile: 'home' },
				sub: { id: 'sub', title: 'Sub', profile: 'regular', parentId: 'home' }
			}
		});
		const home = findViewSource(view, 'home');
		expect(home?.children).toHaveLength(1);
		expect(home?.children[0].id).toBe('sub');
	});

	it('context menu has only "New Folder"', () => {
		const actions = defaultMockActions();
		const view = createView({
			folders: {
				'deleted-notes': { id: 'deleted-notes', title: 'Trash', profile: 'deleted-notes' },
				favorites: { id: 'favorites', title: 'Favorites', profile: 'favorites' },
				home: { id: 'home', title: 'Home', profile: 'home' }
			},
			actions
		});
		const home = findViewSource(view, 'home');
		expect(home?.contextMenuItems.map((m) => m.label)).toEqual(['New Folder']);
	});
});

describe('regular profile', () => {
	it('resolves regular kind with folder icon', () => {
		const view = createView({
			items: ['work'],
			folders: { work: { id: 'work', title: 'Work', profile: 'regular' } }
		});
		const work = findFolderSource(view, 'work');
		expect(work?.profile).toBe('regular');
	});

	it('has full capabilities: create, rename, delete, favorite', () => {
		const view = createView({
			items: ['work'],
			folders: { work: { id: 'work', title: 'Work', profile: 'regular' } }
		});
		const work = findFolderSource(view, 'work');
		expect(work?.capabilities).toMatchObject({
			createFolder: true, createNote: true, rename: true, delete: true, favorite: true,
			recover: false, permanentDelete: false, emptyTrash: false
		});
	});

	it('shows children from item.items and hides deleted ones', () => {
		const view = createView({
			items: ['parent'],
			folders: {
				parent: { id: 'parent', title: 'Parent', items: ['alive', 'dead'] },
				alive: { id: 'alive', title: 'Alive', deletedAt: null },
				dead: { id: 'dead', title: 'Dead', deletedAt: 123 }
			}
		});
		const parent = findFolderSource(view, 'parent');
		expect(parent?.children.map((c) => c.id)).toEqual(['alive']);
	});

	it('children can expand to show their sub-children', () => {
		const view = createView({
			items: ['parent'],
			folders: {
				parent: { id: 'parent', title: 'Parent', items: ['child'] },
				child: { id: 'child', title: 'Child', parentId: 'parent', items: ['grandchild'] },
				grandchild: { id: 'grandchild', title: 'Grandchild', parentId: 'child' }
			}
		});
		const child = findFolderSource(view, 'parent')?.children[0];
		expect(child?.children).toHaveLength(1);
		expect(child?.children[0].id).toBe('grandchild');
	});

	it('context menu has New Folder, Add To Favorites, Rename, Delete', () => {
		const actions = defaultMockActions();
		const view = createView({
			items: ['work'],
			folders: { work: { id: 'work', title: 'Work', profile: 'regular', isFavorite: false } },
			actions
		});
		const work = findFolderSource(view, 'work');
		const labels = work?.contextMenuItems.map((m) => m.label);
		expect(labels).toEqual(['New Folder', 'Add To Favorites', 'Rename', 'Delete']);
	});

	it('context menu shows "Remove From Favorites" when folder is favorited', () => {
		const view = createView({
			items: ['work'],
			folders: { work: { id: 'work', title: 'Work', profile: 'regular', isFavorite: true } },
			actions: defaultMockActions()
		});
		const work = findFolderSource(view, 'work');
		expect(work?.contextMenuItems.map((m) => m.label)).toContain('Remove From Favorites');
	});

	it('Delete action calls folderDelete with the folder id', () => {
		const actions = defaultMockActions();
		const view = createView({
			items: ['work'],
			folders: { work: { id: 'work', title: 'Work', profile: 'regular', isFavorite: false } },
			actions
		});
		const work = findFolderSource(view, 'work');
		work?.contextMenuItems.find((m) => m.label === 'Delete')?.action();
		expect(actions.folderDelete).toHaveBeenCalledWith('work');
	});
});

describe('deleted profile', () => {
	it('resolves deleted kind for items with deletedAt', () => {
		const view = createView({
			folders: {
				'deleted-notes': { id: 'deleted-notes', title: 'Trash', profile: 'deleted-notes' },
				favorites: { id: 'favorites', title: 'Favorites', profile: 'favorites' },
				home: { id: 'home', title: 'Home', profile: 'home' },
				'del-1': { id: 'del-1', title: 'Deleted', deletedAt: 100 }
			},
			trashRootIds: ['del-1']
		});
		const child = findViewSource(view, 'deleted-notes')?.children[0];
		expect(child?.profile).toBe('deleted');
	});

	it('has recover and permanentDelete capabilities only', () => {
		const view = createView({
			folders: {
				'deleted-notes': { id: 'deleted-notes', title: 'Trash', profile: 'deleted-notes' },
				favorites: { id: 'favorites', title: 'Favorites', profile: 'favorites' },
				home: { id: 'home', title: 'Home', profile: 'home' },
				'del-1': { id: 'del-1', title: 'Deleted', deletedAt: 100 }
			},
			trashRootIds: ['del-1']
		});
		const child = findViewSource(view, 'deleted-notes')?.children[0];
		expect(child?.capabilities).toMatchObject({
			recover: true, permanentDelete: true,
			createFolder: false, createNote: false, rename: false, delete: false, favorite: false
		});
	});

	it('context menu has Recover Folder and Delete Permanently', () => {
		const actions = defaultMockActions();
		const view = createView({
			folders: {
				'deleted-notes': { id: 'deleted-notes', title: 'Trash', profile: 'deleted-notes' },
				favorites: { id: 'favorites', title: 'Favorites', profile: 'favorites' },
				home: { id: 'home', title: 'Home', profile: 'home' },
				'del-1': { id: 'del-1', title: 'Deleted', deletedAt: 100 }
			},
			trashRootIds: ['del-1'],
			actions
		});
		const child = findViewSource(view, 'deleted-notes')?.children[0];
		const labels = child?.contextMenuItems.map((m) => m.label);
		expect(labels).toEqual(['Recover Folder', 'Delete Permanently']);
	});
});

describe('selection and note counts', () => {
	it('marks the selected folder as selected', () => {
		const view = createView({
			items: ['work'],
			folders: { work: { id: 'work', title: 'Work' } },
			selectedFolderID: 'work'
		});
		const work = findFolderSource(view, 'work');
		expect(work?.isSelected).toBe(true);
	});

	it('exposes note count from noteQueries', () => {
		const view = createView({
			items: ['work'],
			folders: { work: { id: 'work', title: 'Work' } },
			noteCountFn: (id) => (id === 'work' ? 5 : 0)
		});
		const work = findFolderSource(view, 'work');
		expect(work?.noteCount).toBe(5);
	});
});
