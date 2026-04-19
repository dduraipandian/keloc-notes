import { describe, expect, it, vi, beforeEach } from 'vitest';
import { FolderService } from '../../../src/lib/stores/services/folderService';
import { SelectionStore } from '../../../src/lib/stores/selection.svelte';
import { FolderStore } from '../../../src/lib/stores/folders.svelte';
import { NotesStore } from '../../../src/lib/stores/notes.svelte';

describe('FolderService', () => {
	let selectionStore: SelectionStore;
	let folderStore: FolderStore;
	let notesStore: NotesStore;

	beforeEach(() => {
		vi.clearAllMocks();
		folderStore = new FolderStore();
		selectionStore = new SelectionStore(folderStore);
		notesStore = new NotesStore(folderStore, selectionStore);
		
		(notesStore as any).isInitialized = true;
		(folderStore as any).isInitialized = true;
	});

	it('should delegate folder creation and return the new ID', () => {
		const folders = { createFolder: vi.fn().mockReturnValue('new-folder-id') };
		const selection = {
			selectedFolderID: 'parent',
			selectFolder: vi.fn(),
			getSelectedFolder: vi.fn().mockReturnValue({ id: 'parent', profile: 'regular' }),
			clearFolderIfSelected: vi.fn()
		};

		const result = new FolderService(folders as any, {} as any, selection as any).create();

		expect(folders.createFolder).toHaveBeenCalledWith('parent');
		expect(selection.selectFolder).toHaveBeenCalledWith('new-folder-id');
		expect(result).toBe('new-folder-id');
	});

	it('should create at the root when a virtual view is selected', () => {
		const folders = { createFolder: vi.fn() };
		const selection = {
			selectedFolderID: 'favorites',
			selectFolder: vi.fn(),
			getSelectedFolder: vi.fn().mockReturnValue({ id: 'favorites', profile: 'favorites' }),
			clearFolderIfSelected: vi.fn()
		};

		new FolderService(folders as any, {} as any, selection as any).create();

		expect(folders.createFolder).toHaveBeenCalledWith(null);
	});

	it('should allow creating with an explicit parent ID', () => {
		const folders = { createFolder: vi.fn().mockReturnValue('new-id') };
		const selection = {
			selectFolder: vi.fn(),
			getSelectedFolder: vi.fn()
		};

		const result = new FolderService(folders as any, {} as any, selection as any).create('explicit-parent');

		expect(folders.createFolder).toHaveBeenCalledWith('explicit-parent');
		expect(result).toBe('new-id');
	});

	it('should select the first note when a folder is selected', () => {
		const folders = {
			findItemById: vi.fn().mockReturnValue({ id: 'folder-1', profile: 'regular' })
		};
		const selection = {
			selectedFolderID: null,
			selectFolder: vi.fn(),
			getSelectedFolder: vi.fn(),
			clearFolderIfSelected: vi.fn()
		};
		const notes = {
			listNotes: vi.fn().mockReturnValue([
				{ id: 'note-2', folderId: 'folder-1', updatedAt: '2025-01-02T00:00:00Z', deletedAt: null, summary: '', isFavorite: false, isContentLoaded: true },
				{ id: 'note-1', folderId: 'folder-1', updatedAt: '2025-01-01T00:00:00Z', deletedAt: null, summary: '', isFavorite: false, isContentLoaded: true }
			]),
			selectNote: vi.fn()
		};

		new FolderService(folders as any, notes as any, selection as any).select('folder-1');

		expect(selection.selectFolder).toHaveBeenCalledWith('folder-1');
		expect(notes.selectNote).toHaveBeenCalledWith('note-2');
	});

	it('should clear note selection when selecting an empty folder', () => {
		const folders = {
			findItemById: vi.fn().mockReturnValue({ id: 'folder-1', profile: 'regular' })
		};
		const selection = {
			selectedFolderID: null,
			selectFolder: vi.fn(),
			getSelectedFolder: vi.fn(),
			clearFolderIfSelected: vi.fn()
		};
		const notes = {
			listNotes: vi.fn().mockReturnValue([]),
			selectNote: vi.fn()
		};

		new FolderService(folders as any, notes as any, selection as any).select('folder-1');

		expect(notes.selectNote).toHaveBeenCalledWith(null);
	});

	it('should delegate rename start and cancel', () => {
		const folders = { startRename: vi.fn(), cancelRename: vi.fn() };
		const service = new FolderService(folders as any, {} as any, {} as any);

		service.startRename('folder-1');
		service.cancelRename();

		expect(folders.startRename).toHaveBeenCalledWith('folder-1');
		expect(folders.cancelRename).toHaveBeenCalled();
	});

	it('should delegate folder rename', () => {
		const folders = { renameFolder: vi.fn() };

		new FolderService(folders as any, {} as any, {} as any).rename('folder-1', 'Renamed');

		expect(folders.renameFolder).toHaveBeenCalledWith('folder-1', 'Renamed');
	});

	it('should delegate folder toggle', () => {
		const folders = { openFolder: vi.fn() };

		new FolderService(folders as any, {} as any, {} as any).toggle('folder-1');

		expect(folders.openFolder).toHaveBeenCalledWith('folder-1');
	});

	it('should delegate folder favorite toggles', () => {
		const folders = { setFavorite: vi.fn() };

		new FolderService(folders as any, {} as any, {} as any).setFavorite('folder-1', true);

		expect(folders.setFavorite).toHaveBeenCalledWith('folder-1', true);
	});

	it('should delegate folder deletion', () => {
		const folders = {
			items: ['folder-1', 'folder-2'],
			findItemById: vi
				.fn()
				.mockImplementation((id: string) =>
					id === 'folder-1'
						? { id: 'folder-1', items: ['child-1'] }
						: id === 'child-1'
							? { id: 'child-1', items: [] }
							: { id: 'folder-2', items: [] }
				),
			deleteFolder: vi.fn()
		};
		const selection = {
			selectedFolderID: 'folder-1',
			selectFolder: vi.fn(),
			getSelectedFolder: vi.fn(),
			clearFolderIfSelected: vi.fn()
		};
		const notes = {
			deleteNotesInFolder: vi.fn(),
			listNotes: vi.fn().mockReturnValue([]),
			selectNote: vi.fn()
		};

		new FolderService(folders as any, notes as any, selection as any).delete('folder-1', 'batch-1');

		expect(folders.deleteFolder).toHaveBeenCalledWith('folder-1', expect.any(Number), 'batch-1');
		expect(folders.deleteFolder).toHaveBeenCalledWith('child-1', expect.any(Number), 'batch-1');
		expect(notes.deleteNotesInFolder).toHaveBeenCalledWith('folder-1', expect.any(Number), 'batch-1');
		expect(notes.deleteNotesInFolder).toHaveBeenCalledWith('child-1', expect.any(Number), 'batch-1');
		expect(selection.selectFolder).toHaveBeenCalledWith('folder-2');
		expect(notes.selectNote).toHaveBeenCalledWith(null);
	});

	it('should clear folder and note selection when deleting the last selectable folder', () => {
		const folders = {
			items: ['folder-1'],
			findItemById: vi.fn().mockReturnValue({ id: 'folder-1', items: [] }),
			deleteFolder: vi.fn()
		};
		const selection = {
			selectedFolderID: 'folder-1',
			selectFolder: vi.fn(),
			getSelectedFolder: vi.fn(),
			clearFolderIfSelected: vi.fn()
		};
		const notes = {
			deleteNotesInFolder: vi.fn(),
			listNotes: vi.fn().mockReturnValue([]),
			selectNote: vi.fn()
		};

		new FolderService(folders as any, notes as any, selection as any).delete('folder-1', 'batch-1');

		expect(selection.selectFolder).toHaveBeenCalledWith(null);
		expect(notes.selectNote).toHaveBeenCalledWith(null);
	});

	describe('ensurePath', () => {
		it('should create missing folders in a path and return the leaf ID', () => {
			const folders = {
				folders: new Map(),
				createFolder: vi.fn().mockImplementation((parentId) => {
					const id = `new-id-${parentId ?? 'root'}`;
					folders.folders.set(id, { id, title: 'temp', parentId });
					return id;
				}),
				renameFolder: vi.fn().mockImplementation((id, title) => {
					folders.folders.get(id).title = title;
				})
			};
			const selection = { selectFolder: vi.fn() };
			const service = new FolderService(folders as any, {} as any, selection as any);

			const result = service.ensurePath('Work/Design');

			expect(folders.createFolder).toHaveBeenCalledTimes(2);
			expect(folders.renameFolder).toHaveBeenCalledWith('new-id-root', 'Work');
			expect(folders.renameFolder).toHaveBeenCalledWith('new-id-new-id-root', 'Design');
			expect(result).toBe('new-id-new-id-root');
		});

		it('should reuse existing folders in a path', () => {
			const folders = {
				folders: new Map([
					['work-id', { id: 'work-id', title: 'Work', parentId: null, deletedAt: null }]
				]),
				createFolder: vi.fn().mockReturnValue('design-id'),
				renameFolder: vi.fn()
			};
			const selection = { selectFolder: vi.fn() };
			const service = new FolderService(folders as any, {} as any, selection as any);

			const result = service.ensurePath('Work/Design');

			expect(folders.createFolder).toHaveBeenCalledTimes(1);
			expect(folders.createFolder).toHaveBeenCalledWith('work-id');
			expect(folders.renameFolder).toHaveBeenCalledWith('design-id', 'Design');
			expect(result).toBe('design-id');
		});

		it('should return null for empty path', () => {
			const service = new FolderService({} as any, {} as any, {} as any);
			expect(service.ensurePath('')).toBe(null);
		});
	});
});
