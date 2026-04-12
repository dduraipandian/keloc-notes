import { describe, expect, it, vi } from 'vitest';
import { FolderSidebarSelector, NoteListSelector } from './selectors';

describe('NoteListSelector', () => {
	it('should expose the selected folder title with a fallback', () => {
		const selector = new NoteListSelector(
			{ folders: new Map() } as any,
			{} as any,
			{} as any,
			{} as any,
			{
				selectedFolderID: 'notes',
				getSelectedFolder: () => ({ id: 'notes', title: 'Notes', url: '#' })
			} as any
		);

		expect(selector.getSelectedFolderTitle()).toBe('Notes');
	});

	it('should filter notes by the current query', () => {
		const selector = new NoteListSelector(
			{ folders: new Map() } as any,
			{} as any,
			{} as any,
			{
				getNotesForFolder: vi.fn().mockReturnValue([
					{ id: '1', title: 'Alpha', content: 'First', updatedAt: '2025-01-01T00:00:00Z' },
					{ id: '2', title: 'Beta', content: 'Second', updatedAt: '2025-01-02T00:00:00Z' }
				])
			} as any,
			{
				selectedFolderID: 'notes',
				getSelectedFolder: () => ({ id: 'notes', title: 'Notes', url: '#', type: 'regular' })
			} as any
		);

		expect(selector.getFilteredNotes('alp')).toEqual([
			expect.objectContaining({ id: '1', title: 'Alpha' })
		]);
	});

	it('should compute note restore context from folder hierarchy', () => {
		const selector = new NoteListSelector(
			{} as any,
			{} as any,
			{
				findTopDeletedAncestor: vi.fn().mockReturnValue({ id: 'folder-a' })
			} as any,
			{} as any
		);

		expect(selector.getRestoreContext({ id: 'n1', folderId: 'folder-a' } as any)).toEqual({
			isHierarchical: true,
			topDeletedAncestor: { id: 'folder-a' }
		});
	});

	it('should expose selected note delete context', () => {
		const selector = new NoteListSelector(
			{} as any,
			{
				selectedNoteID: 'n1',
				selectedNote: { id: 'n1', title: 'Selected', deletedAt: null }
			} as any,
			{} as any,
			{} as any
		);

		expect(selector.getSelectedNoteDeleteContext()).toEqual({
			id: 'n1',
			title: 'Selected'
		});
	});
});

describe('FolderSidebarSelector', () => {
	it('should expose root folder sources', () => {
		const selector = new FolderSidebarSelector(
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
				kind: 'folder',
				title: 'Notes',
				isSelected: true,
				noteCount: 3,
				capabilities: expect.objectContaining({ create: true, rename: true, delete: true })
			})
		]);
	});

	it('should expose header sources for trash', () => {
		const selector = new FolderSidebarSelector(
			{
				folders: new Map([
					['favorites', { id: 'favorites', title: 'Favorites', url: '#', type: 'system' }],
					['deleted-notes', { id: 'deleted-notes', title: 'Trash', url: '#', type: 'trash' }],
					['deleted-folder', { id: 'deleted-folder', title: 'Deleted', url: '#', deletedAt: 123 }]
				])
			} as any,
			{ getTrashRootIds: vi.fn().mockReturnValue(['deleted-folder']), getFavoriteFolderIds: vi.fn().mockReturnValue([]) } as any,
			{ getNoteCountForFolder: vi.fn().mockReturnValue(0) } as any,
			{ selectedFolderID: 'deleted-notes', getSelectedFolder: vi.fn() } as any
		);

		expect(selector.getSections().find((section) => section.id === 'views')?.sources).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: 'deleted-notes',
					kind: 'trash',
					isTrashRoot: true,
					isSelected: true,
					children: [expect.objectContaining({ id: 'deleted-folder', isTrashTree: true })],
					capabilities: expect.objectContaining({ emptyTrash: true })
				})
			])
		);
	});

	it('should hide deleted children in the regular tree', () => {
		const selector = new FolderSidebarSelector(
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

		expect(selector.getSections().find((section) => section.id === 'folders')?.sources[0]?.children).toEqual([
			expect.objectContaining({ id: 'child-a' })
		]);
	});

	it('should expose note counts for a folder source', () => {
		const selector = new FolderSidebarSelector(
			{
				items: ['notes'],
				folders: new Map([['notes', { id: 'notes', title: 'Notes', url: '#', type: 'regular' }]])
			} as any,
			{ getFavoriteFolderIds: vi.fn().mockReturnValue([]) } as any,
			{ getNoteCountForFolder: vi.fn().mockReturnValue(3) } as any,
			{ selectedFolderID: null, getSelectedFolder: vi.fn() } as any
		);

		expect(selector.getSections().find((section) => section.id === 'folders')?.sources[0]?.noteCount).toBe(3);
	});

	it('should expose trash item capabilities through the shared source model', () => {
		const selector = new FolderSidebarSelector(
			{
				folders: new Map([
					['favorites', { id: 'favorites', title: 'Favorites', url: '#', type: 'system' }],
					['deleted-notes', { id: 'deleted-notes', title: 'Trash', url: '#', type: 'trash' }],
					['deleted-folder', { id: 'deleted-folder', title: 'Deleted', url: '#', deletedAt: 123 }]
				])
			} as any,
			{ getTrashRootIds: vi.fn().mockReturnValue(['deleted-folder']), getFavoriteFolderIds: vi.fn().mockReturnValue([]) } as any,
			{ getNoteCountForFolder: vi.fn().mockReturnValue(0) } as any,
			{ selectedFolderID: null, getSelectedFolder: vi.fn() } as any
		);

		const deletedFolder = selector
			.getSections()
			.find((section) => section.id === 'views')
			?.sources.find((source) => source.id === 'deleted-notes')
			?.children[0];

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
		const selector = new FolderSidebarSelector(
			{
				items: ['notes'],
				folders: new Map([
					['favorites', { id: 'favorites', title: 'Favorites', url: '#', type: 'system' }],
					['notes', { id: 'notes', title: 'Notes', url: '#', type: 'regular' }],
					['deleted-notes', { id: 'deleted-notes', title: 'Trash', url: '#', type: 'trash' }]
				])
			} as any,
			{ getTrashRootIds: vi.fn().mockReturnValue([]), getFavoriteFolderIds: vi.fn().mockReturnValue([]) } as any,
			{ getNoteCountForFolder: vi.fn().mockReturnValue(0) } as any,
			{ selectedFolderID: null, getSelectedFolder: vi.fn() } as any
		);

		expect(selector.getSections()).toEqual([
			expect.objectContaining({ id: 'views', label: null }),
			expect.objectContaining({ id: 'folders', label: 'Folders' })
		]);
	});

	it('should expose favorites as a virtual view with favorite folders as children', () => {
		const selector = new FolderSidebarSelector(
			{
				folders: new Map([
					['favorites', { id: 'favorites', title: 'Favorites', url: '#', type: 'system' }],
					['work', { id: 'work', title: 'Work', url: '#', isFavorite: true, deletedAt: null }]
				])
			} as any,
			{ getTrashRootIds: vi.fn().mockReturnValue([]), getFavoriteFolderIds: vi.fn().mockReturnValue(['work']) } as any,
			{ getNoteCountForFolder: vi.fn().mockImplementation((id: string) => (id === 'favorites' ? 2 : 1)) } as any,
			{ selectedFolderID: 'favorites', getSelectedFolder: vi.fn() } as any
		);

		const favorites = selector.getSections().find((section) => section.id === 'views')?.sources.find((source) => source.id === 'favorites');

		expect(favorites).toEqual(
			expect.objectContaining({
				kind: 'favorites',
				isSelected: true,
				noteCount: 2,
				children: [expect.objectContaining({ id: 'work', kind: 'folder' })]
			})
		);
	});

	it('should hide deleted favorite folders from the favorites virtual view immediately', () => {
		const selector = new FolderSidebarSelector(
			{
				folders: new Map([
					['favorites', { id: 'favorites', title: 'Favorites', url: '#', type: 'system' }],
					['work', { id: 'work', title: 'Work', url: '#', isFavorite: true, deletedAt: 123 }]
				])
			} as any,
			{ getTrashRootIds: vi.fn().mockReturnValue([]), getFavoriteFolderIds: vi.fn().mockReturnValue([]) } as any,
			{ getNoteCountForFolder: vi.fn().mockReturnValue(0) } as any,
			{ selectedFolderID: 'favorites', getSelectedFolder: vi.fn() } as any
		);

		const favorites = selector.getSections().find((section) => section.id === 'views')?.sources.find((source) => source.id === 'favorites');

		expect(favorites?.children).toEqual([]);
	});
});
