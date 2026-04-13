import { describe, expect, it, vi } from 'vitest';
import { FolderSidebarView } from '../../src/lib/views/folderSidebarView.svelte';

describe('FolderSidebarView', () => {
	it('should expose root folder sources', () => {
		const selector = new FolderSidebarView(
			{
				items: ['notes'],
				folders: new Map([['notes', { id: 'notes', title: 'Notes', url: '#' }]])
			} as any,
			{ getFavoriteFolderIds: vi.fn().mockReturnValue([]) } as any,
			{ getNoteCountForFolder: vi.fn().mockReturnValue(3) } as any,
			{ selectedFolderID: 'notes', getSelectedFolder: vi.fn() } as any
		);

		expect(selector.getSections().find((section) => section.id === 'folders')?.sources).toEqual([
			expect.objectContaining({
				id: 'notes',
				kind: 'regular',
				type: 'regular',
				icon: 'folder',
				title: 'Notes',
				isSelected: true,
				noteCount: 3,
				capabilities: expect.objectContaining({ create: true, rename: true, delete: true })
			})
		]);
	});

	it('should expose header sources for trash', () => {
		const selector = new FolderSidebarView(
			{
				folders: new Map([
					['favorites', { id: 'favorites', title: 'Favorites', url: '#', type: 'system' }],
					['deleted-notes', { id: 'deleted-notes', title: 'Trash', url: '#', type: 'trash' }],
					['deleted-folder', { id: 'deleted-folder', title: 'Deleted', url: '#', deletedAt: 123 }]
				])
			} as any,
			{
				getTrashRootIds: vi.fn().mockReturnValue(['deleted-folder']),
				getFavoriteFolderIds: vi.fn().mockReturnValue([])
			} as any,
			{ getNoteCountForFolder: vi.fn().mockReturnValue(0) } as any,
			{ selectedFolderID: 'deleted-notes', getSelectedFolder: vi.fn() } as any
		);

		expect(selector.getSections().find((section) => section.id === 'views')?.sources).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: 'deleted-notes',
					kind: 'trash',
					type: 'view',
					icon: 'trash',
					isSelected: true,
					children: [
						expect.objectContaining({
							id: 'deleted-folder',
							kind: 'regular',
							type: 'regular',
							icon: 'folder'
						})
					],
					capabilities: expect.objectContaining({ emptyTrash: true })
				})
			])
		);
	});

	it('should hide deleted children in the regular tree', () => {
		const selector = new FolderSidebarView(
			{
				items: ['parent'],
				folders: new Map([
					['parent', { id: 'parent', title: 'Parent', url: '#', items: ['child-a', 'child-b'] }],
					['child-a', { id: 'child-a', title: 'A', url: '#', deletedAt: null }],
					['child-b', { id: 'child-b', title: 'B', url: '#', deletedAt: 123 }]
				])
			} as any,
			{ getFavoriteFolderIds: vi.fn().mockReturnValue([]) } as any,
			{ getNoteCountForFolder: vi.fn().mockReturnValue(0) } as any,
			{ selectedFolderID: null, getSelectedFolder: vi.fn() } as any
		);

		expect(
			selector.getSections().find((section) => section.id === 'folders')?.sources[0]?.children
		).toEqual([expect.objectContaining({ id: 'child-a' })]);
	});

	it('should expose note counts for a folder source', () => {
		const selector = new FolderSidebarView(
			{
				items: ['notes'],
				folders: new Map([['notes', { id: 'notes', title: 'Notes', url: '#', type: 'regular' }]])
			} as any,
			{ getFavoriteFolderIds: vi.fn().mockReturnValue([]) } as any,
			{ getNoteCountForFolder: vi.fn().mockReturnValue(3) } as any,
			{ selectedFolderID: null, getSelectedFolder: vi.fn() } as any
		);

		expect(
			selector.getSections().find((section) => section.id === 'folders')?.sources[0]?.noteCount
		).toBe(3);
	});

	it('should expose trash item capabilities through the shared source model', () => {
		const selector = new FolderSidebarView(
			{
				folders: new Map([
					['favorites', { id: 'favorites', title: 'Favorites', url: '#', type: 'system' }],
					['deleted-notes', { id: 'deleted-notes', title: 'Trash', url: '#', type: 'trash' }],
					['deleted-folder', { id: 'deleted-folder', title: 'Deleted', url: '#', deletedAt: 123 }]
				])
			} as any,
			{
				getTrashRootIds: vi.fn().mockReturnValue(['deleted-folder']),
				getFavoriteFolderIds: vi.fn().mockReturnValue([])
			} as any,
			{ getNoteCountForFolder: vi.fn().mockReturnValue(0) } as any,
			{ selectedFolderID: null, getSelectedFolder: vi.fn() } as any
		);

		const deletedFolder = selector
			.getSections()
			.find((section) => section.id === 'views')
			?.sources.find((source) => source.id === 'deleted-notes')?.children[0];

		expect(deletedFolder?.capabilities).toEqual(
			expect.objectContaining({
				recover: true,
				permanentDelete: true,
				create: false,
				rename: false,
				delete: false,
				emptyTrash: false
			})
		);
	});

	it('should expose sidebar sections through the registry', () => {
		const selector = new FolderSidebarView(
			{
				items: ['notes'],
				folders: new Map([
					['favorites', { id: 'favorites', title: 'Favorites', url: '#', type: 'system' }],
					['notes', { id: 'notes', title: 'Notes', url: '#', type: 'regular' }],
					['deleted-notes', { id: 'deleted-notes', title: 'Trash', url: '#', type: 'trash' }]
				])
			} as any,
			{
				getTrashRootIds: vi.fn().mockReturnValue([]),
				getFavoriteFolderIds: vi.fn().mockReturnValue([])
			} as any,
			{ getNoteCountForFolder: vi.fn().mockReturnValue(0) } as any,
			{ selectedFolderID: null, getSelectedFolder: vi.fn() } as any
		);

		expect(selector.getSections()).toEqual([
			expect.objectContaining({ id: 'views', label: null }),
			expect.objectContaining({ id: 'folders', label: 'Folders' })
		]);
	});

	it('should expose favorites as a virtual view with favorite folders as children', () => {
		const selector = new FolderSidebarView(
			{
				folders: new Map([
					['favorites', { id: 'favorites', title: 'Favorites', url: '#', type: 'system' }],
					['work', { id: 'work', title: 'Work', url: '#', isFavorite: true, deletedAt: null }]
				])
			} as any,
			{
				getTrashRootIds: vi.fn().mockReturnValue([]),
				getFavoriteFolderIds: vi.fn().mockReturnValue(['work'])
			} as any,
			{
				getNoteCountForFolder: vi
					.fn()
					.mockImplementation((id: string) => (id === 'favorites' ? 2 : 1))
			} as any,
			{ selectedFolderID: 'favorites', getSelectedFolder: vi.fn() } as any
		);

		const favorites = selector
			.getSections()
			.find((section) => section.id === 'views')
			?.sources.find((source) => source.id === 'favorites');

		expect(favorites).toEqual(
			expect.objectContaining({
				kind: 'favorites',
				type: 'view',
				icon: 'star',
				isSelected: true,
				noteCount: 2,
				children: [expect.objectContaining({ id: 'work', kind: 'regular', icon: 'folder' })]
			})
		);
	});

	it('should hide deleted favorite folders from the favorites virtual view immediately', () => {
		const selector = new FolderSidebarView(
			{
				folders: new Map([
					['favorites', { id: 'favorites', title: 'Favorites', url: '#', type: 'system' }],
					['work', { id: 'work', title: 'Work', url: '#', isFavorite: true, deletedAt: 123 }]
				])
			} as any,
			{
				getTrashRootIds: vi.fn().mockReturnValue([]),
				getFavoriteFolderIds: vi.fn().mockReturnValue([])
			} as any,
			{ getNoteCountForFolder: vi.fn().mockReturnValue(0) } as any,
			{ selectedFolderID: 'favorites', getSelectedFolder: vi.fn() } as any
		);

		const favorites = selector
			.getSections()
			.find((section) => section.id === 'views')
			?.sources.find((source) => source.id === 'favorites');

		expect(favorites?.children).toEqual([]);
	});

	describe('contextMenuItems', () => {
		const mockActions = {
			folderCreate: vi.fn(),
			folderStartRename: vi.fn(),
			folderDelete: vi.fn(),
			folderSetFavorite: vi.fn(),
			trashRecover: vi.fn(),
			trashPermanentDelete: vi.fn(),
			trashEmpty: vi.fn()
		};

		it('should generate correct items for a regular folder', () => {
			const selector = new FolderSidebarView(
				{
					items: ['work'],
					folders: new Map([
						['work', { id: 'work', title: 'Work', url: '#', type: 'regular', isFavorite: false }]
					])
				} as any,
				{ getFavoriteFolderIds: vi.fn().mockReturnValue([]) } as any,
				{ getNoteCountForFolder: vi.fn().mockReturnValue(0) } as any,
				{ selectedFolderID: null, getSelectedFolder: vi.fn() } as any,
				mockActions as any
			);

			const source = selector.getSections().find((s) => s.id === 'folders')?.sources[0];
			const labels = source?.contextMenuItems.map((m) => m.label);

			expect(labels).toContain('New Folder');
			expect(labels).toContain('Add To Favorites');
			expect(labels).toContain('Rename');
			expect(labels).toContain('Delete');

			const deleteItem = source?.contextMenuItems.find((m) => m.label === 'Delete');
			expect(deleteItem?.variant).toBe('destructive');

			const renameItem = source?.contextMenuItems.find((m) => m.label === 'Rename');
			expect(renameItem?.separatorAfter).toBe(true);

			deleteItem?.action();
			expect(mockActions.folderDelete).toHaveBeenCalledWith('work');
		});

		it('should generate correct items for trash root', () => {
			const selector = new FolderSidebarView(
				{
					folders: new Map([
						['deleted-notes', { id: 'deleted-notes', title: 'Trash', type: 'trash' }]
					])
				} as any,
				{
					getTrashRootIds: vi.fn().mockReturnValue([]),
					getFavoriteFolderIds: vi.fn().mockReturnValue([])
				} as any,
				{ getNoteCountForFolder: vi.fn().mockReturnValue(0) } as any,
				{ selectedFolderID: null, getSelectedFolder: vi.fn() } as any,
				mockActions as any
			);

			const source = selector
				.getSections()
				.find((s) => s.id === 'views')
				?.sources.find((s) => s.id === 'deleted-notes');
			const labels = source?.contextMenuItems.map((m) => m.label);

			expect(labels).toEqual(['Empty Trash']);
			const emptyItem = source?.contextMenuItems[0];
			expect(emptyItem?.variant).toBe('destructive');

			emptyItem?.action();
			expect(mockActions.trashEmpty).toHaveBeenCalled();
		});
	});
});
