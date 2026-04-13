import { beforeEach, describe, expect, it, vi } from 'vitest';
import { folderStore, type FolderItem } from '$lib/stores/folders.svelte';
import { notesStore, type NoteItem } from '$lib/stores/notes.svelte';
import { FolderSidebarSelector, NoteListSelector } from '$lib/stores/selectors';
import { selectionStore } from '$lib/stores/selection.svelte';

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
	const selector = new FolderSidebarSelector();

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

	const addNote = (note: Partial<NoteItem> & { id: string }) => {
		const value: NoteItem = {
			folderId: null,
			title: 'Untitled',
			content: '',
			updatedAt: new Date().toISOString(),
			deletedAt: null,
			...note
		};
		notesStore.notes.set(note.id, value);
	};

	beforeEach(() => {
		vi.clearAllMocks();
		(folderStore as any).items = [];
		folderStore.folders.clear();
		notesStore.notes.clear();
		(selectionStore as any).selectedFolderID = null;
	});

	it('should expose notes in the pinned system section', () => {
		addFolder({ id: 'notes', title: 'Notes' });
		addNote({ id: 'n1', folderId: 'notes' });
		(selectionStore as any).selectedFolderID = 'notes';

		expect(selector.getSections().find((section) => section.id === 'views')?.sources).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: 'notes',
					kind: 'folder',
					title: 'Notes',
					isSelected: true,
					noteCount: 1,
					capabilities: expect.objectContaining({
						create: true,
						rename: false,
						delete: false,
						setFavorite: false
					})
				})
			])
		);
	});

	it('should expose header sources for trash', () => {
		addFolder({ id: 'favorites', title: 'Favorites', type: 'system' });
		addFolder({ id: 'deleted-notes', title: 'Trash', type: 'trash' });
		addFolder({ id: 'deleted-folder', title: 'Deleted', deletedAt: 123 });
		(selectionStore as any).selectedFolderID = 'deleted-notes';

		expect(selector.getSections().find((section) => section.id === 'views')?.sources).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: 'deleted-notes',
					kind: 'view',
					iconKey: 'trash',
					isSelected: true,
					children: [expect.objectContaining({ id: 'deleted-folder' })],
					capabilities: expect.objectContaining({ emptyTrash: true })
				})
			])
		);
	});

	it('should hide deleted children in the regular tree', () => {
		addFolder({ id: 'notes', title: 'Notes' });
		addFolder({ id: 'parent', title: 'Parent', items: ['child-a', 'child-b'] });
		addFolder({ id: 'child-a', title: 'A', parentId: 'parent' });
		addFolder({ id: 'child-b', title: 'B', parentId: 'parent', deletedAt: 123 });
		folderStore.items = ['notes', 'parent'];

		expect(selector.getSections().find((section) => section.id === 'folders')?.sources[0]?.children).toEqual([
			expect.objectContaining({ id: 'child-a' })
		]);
	});

	it('should expose note counts for a folder source', () => {
		addFolder({ id: 'notes', title: 'Notes' });
		addNote({ id: 'n1', folderId: 'notes' });
		addNote({ id: 'n2', folderId: 'notes' });

		expect(
			selector
				.getSections()
				.find((section) => section.id === 'views')
				?.sources.find((source) => source.id === 'notes')?.noteCount
		).toBe(2);
	});

	it('should expose trash item capabilities through the shared source model', () => {
		addFolder({ id: 'favorites', title: 'Favorites', type: 'system' });
		addFolder({ id: 'deleted-notes', title: 'Trash', type: 'trash' });
		addFolder({ id: 'deleted-folder', title: 'Deleted', deletedAt: 123 });

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
		addFolder({ id: 'favorites', title: 'Favorites', type: 'system' });
		addFolder({ id: 'notes', title: 'Notes', type: 'regular' });
		addFolder({ id: 'deleted-notes', title: 'Trash', type: 'trash' });
		addFolder({ id: 'work', title: 'Work', type: 'regular' });
		folderStore.items = ['notes', 'work'];

		expect(selector.getSections()).toEqual([
			expect.objectContaining({ id: 'views', label: null, placement: 'header' }),
			expect.objectContaining({ id: 'folders', label: 'Folders', placement: 'content' })
		]);
	});

	it('should keep notes with pinned views and out of the regular folder tree', () => {
		addFolder({ id: 'work', title: 'Work', type: 'regular' });
		addFolder({ id: 'notes', title: 'Notes', type: 'regular' });
		folderStore.items = ['work', 'notes'];

		const sections = selector.getSections();

		expect(sections.find((section) => section.id === 'views')?.sources.map((source) => source.id)).toEqual([
			'notes',
			'favorites',
			'deleted-notes'
		]);
		expect(
			sections.find((section) => section.id === 'folders')?.sources.map((source) => source.id)
		).toEqual(['work']);
	});

	it('should expose favorites as a virtual view with favorite folders as children', () => {
		addFolder({ id: 'favorites', title: 'Favorites', type: 'system' });
		addFolder({ id: 'work', title: 'Work', isFavorite: true, deletedAt: null });
		addNote({ id: 'n1', isFavorite: true });
		(selectionStore as any).selectedFolderID = 'favorites';

		const favorites = selector
			.getSections()
			.find((section) => section.id === 'views')
			?.sources.find((source) => source.id === 'favorites');

		expect(favorites).toEqual(
			expect.objectContaining({
				kind: 'view',
				iconKey: 'star',
				isSelected: true,
				noteCount: 1,
				children: [expect.objectContaining({ id: 'work', kind: 'folder' })]
			})
		);
	});

	it('should hide deleted favorite folders from the favorites virtual view immediately', () => {
		addFolder({ id: 'favorites', title: 'Favorites', type: 'system' });
		addFolder({ id: 'work', title: 'Work', isFavorite: true, deletedAt: 123 });

		const favorites = selector
			.getSections()
			.find((section) => section.id === 'views')
			?.sources.find((source) => source.id === 'favorites');

		expect(favorites?.children).toEqual([]);
	});
});
