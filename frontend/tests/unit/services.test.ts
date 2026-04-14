import { describe, expect, it, vi } from 'vitest';
import { FolderService, NoteService, TrashService } from '../../src/lib/stores/services';
import { trashRepository } from '../../src/lib/stores/repositories';

vi.mock('../../src/lib/stores/repositories', () => ({
	trashRepository: {
		permanentlyDeleteFolderTree: vi.fn(),
		permanentlyDeleteNote: vi.fn()
	}
}));

describe('FolderService', () => {
	it('should delegate folder creation', () => {
		const folders = { createFolder: vi.fn() };
		const selection = {
			selectedFolderID: 'parent',
			selectFolder: vi.fn(),
			getSelectedFolder: vi.fn().mockReturnValue({ id: 'parent', profile: 'regular' }),
			clearFolderIfSelected: vi.fn()
		};

		new FolderService(folders as any, {} as any, selection as any).create();

		expect(folders.createFolder).toHaveBeenCalledWith('parent');
		expect(selection.selectFolder).toHaveBeenCalled();
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
				{ id: 'note-2', folderId: 'folder-1', updatedAt: '2025-01-02T00:00:00Z', deletedAt: null },
				{ id: 'note-1', folderId: 'folder-1', updatedAt: '2025-01-01T00:00:00Z', deletedAt: null }
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
		const service = new FolderService(folders as any);

		service.startRename('folder-1');
		service.cancelRename();

		expect(folders.startRename).toHaveBeenCalledWith('folder-1');
		expect(folders.cancelRename).toHaveBeenCalled();
	});

	it('should delegate folder rename', () => {
		const folders = { renameFolder: vi.fn() };

		new FolderService(folders as any).rename('folder-1', 'Renamed');

		expect(folders.renameFolder).toHaveBeenCalledWith('folder-1', 'Renamed');
	});

	it('should delegate folder toggle', () => {
		const folders = { openFolder: vi.fn() };

		new FolderService(folders as any).toggle('folder-1');

		expect(folders.openFolder).toHaveBeenCalledWith('folder-1');
	});

	it('should delegate folder favorite toggles', () => {
		const folders = { setFavorite: vi.fn() };

		new FolderService(folders as any).setFavorite('folder-1', true);

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

		new FolderService(folders as any, notes as any, selection as any).delete('folder-1', 123);

		expect(folders.deleteFolder).toHaveBeenCalledWith('folder-1', 123);
		expect(folders.deleteFolder).toHaveBeenCalledWith('child-1', 123);
		expect(notes.deleteNotesInFolder).toHaveBeenCalledWith('folder-1', 123);
		expect(notes.deleteNotesInFolder).toHaveBeenCalledWith('child-1', 123);
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

		new FolderService(folders as any, notes as any, selection as any).delete('folder-1', 123);

		expect(selection.selectFolder).toHaveBeenCalledWith(null);
		expect(notes.selectNote).toHaveBeenCalledWith(null);
	});
});

describe('NoteService', () => {
	it('should create in the selected regular folder', () => {
		const folders = {
			findItemById: vi.fn().mockReturnValue({ id: 'work', profile: 'regular' }),
			getDefaultFolderId: vi.fn()
		};
		const selection = {
			selectedFolderID: null,
			selectFolder: vi.fn(),
			getSelectedFolder: vi.fn(),
			clearFolderIfSelected: vi.fn()
		};
		const notes = { createNote: vi.fn() };

		new NoteService(folders as any, notes as any, selection as any).create('work');

		expect(notes.createNote).toHaveBeenCalledWith('work');
		expect(selection.selectFolder).toHaveBeenCalledWith('work');
		expect(folders.getDefaultFolderId).not.toHaveBeenCalled();
	});

	it('should fall back to the default folder for trash/favorites views', () => {
		const folders = {
			findItemById: vi.fn().mockReturnValue({ id: 'deleted-notes', profile: 'trash' }),
			getDefaultFolderId: vi.fn().mockReturnValue('notes')
		};
		const selection = {
			selectedFolderID: null,
			selectFolder: vi.fn(),
			getSelectedFolder: vi.fn(),
			clearFolderIfSelected: vi.fn()
		};
		const notes = { createNote: vi.fn() };

		new NoteService(folders as any, notes as any, selection as any).create('deleted-notes');

		expect(folders.getDefaultFolderId).toHaveBeenCalled();
		expect(notes.createNote).toHaveBeenCalledWith('notes');
		expect(selection.selectFolder).toHaveBeenCalledWith('notes');
	});

	it('should allow creation in the home view', () => {
		const folders = {
			findItemById: vi.fn().mockReturnValue({ id: 'home', profile: 'home' }),
			getDefaultFolderId: vi.fn()
		};
		const selection = {
			selectedFolderID: null,
			selectFolder: vi.fn(),
			getSelectedFolder: vi.fn(),
			clearFolderIfSelected: vi.fn()
		};
		const notes = { createNote: vi.fn() };

		new NoteService(folders as any, notes as any, selection as any).create('home');

		expect(folders.getDefaultFolderId).not.toHaveBeenCalled();
		expect(notes.createNote).toHaveBeenCalledWith('home');
	});

	it('should delegate note updates', () => {
		const folders = { findItemById: (id: string) => ({ id, profile: ['home', 'favorites', 'deleted-notes', 'trash'].includes(id) ? (id === 'deleted-notes' ? 'trash' : id) : 'regular' }) };
		const notes = { updateNote: vi.fn() };

		new NoteService(folders as any, notes as any).update('note-1', { title: 'Updated' });

		expect(notes.updateNote).toHaveBeenCalledWith('note-1', { title: 'Updated' }, undefined);
	});

	it('should delegate note selection', () => {
		const folders = { findItemById: (id: string) => ({ id, profile: ['home', 'favorites', 'deleted-notes', 'trash'].includes(id) ? (id === 'deleted-notes' ? 'trash' : id) : 'regular' }) };
		const notes = { selectNote: vi.fn() };

		new NoteService(folders as any, notes as any).select('note-1');

		expect(notes.selectNote).toHaveBeenCalledWith('note-1');
	});

	it('should delegate note favorite toggles', () => {
		const notes = { setFavorite: vi.fn() };

		new NoteService({ findItemById: (id: string) => ({ id, profile: ['home', 'favorites', 'deleted-notes', 'trash'].includes(id) ? id : 'regular' }) } as any, notes as any).setFavorite('note-1', true);

		expect(notes.setFavorite).toHaveBeenCalledWith('note-1', true);
	});

	it('should select the next note after deleting the current note', () => {
		const folders = {
			findItemById: vi.fn().mockReturnValue({ id: 'f1', profile: 'regular' })
		};
		const selection = {
			selectedFolderID: 'f1',
			selectFolder: vi.fn(),
			getSelectedFolder: vi.fn().mockReturnValue({ id: 'f1', profile: 'regular' }),
			clearFolderIfSelected: vi.fn()
		};
		const notes = {
			listNotes: vi.fn().mockReturnValue([
				{ id: 'note-1', folderId: 'f1', updatedAt: '2025-01-02T00:00:00Z', deletedAt: null },
				{ id: 'note-2', folderId: 'f1', updatedAt: '2025-01-01T00:00:00Z', deletedAt: null }
			]),
			deleteNote: vi.fn(),
			selectNote: vi.fn()
		};

		new NoteService(folders as any, notes as any, selection as any).delete('note-1', 123);

		expect(notes.deleteNote).toHaveBeenCalledWith('note-1', 123);
		expect(notes.selectNote).toHaveBeenCalledWith('note-2');
	});

	it('should clear selection when deleting the last visible note', () => {
		const folders = {
			findItemById: vi.fn().mockReturnValue({ id: 'f1', profile: 'regular' })
		};
		const selection = {
			selectedFolderID: 'f1',
			selectFolder: vi.fn(),
			getSelectedFolder: vi.fn().mockReturnValue({ id: 'f1', profile: 'regular' }),
			clearFolderIfSelected: vi.fn()
		};
		const notes = {
			listNotes: vi
				.fn()
				.mockReturnValue([
					{ id: 'note-1', folderId: 'f1', updatedAt: '2025-01-02T00:00:00Z', deletedAt: null }
				]),
			deleteNote: vi.fn(),
			selectNote: vi.fn()
		};

		new NoteService(folders as any, notes as any, selection as any).delete('note-1', 123);

		expect(notes.selectNote).toHaveBeenCalledWith(null);
	});

	it('should return notes for a folder sorted by updatedAt descending', () => {
		const folders = { findItemById: vi.fn().mockImplementation((id) => ({ id, profile: ['home', 'favorites', 'deleted-notes', 'trash'].includes(id) ? id : 'regular' })) };
		const notes = {
			listNotes: vi.fn().mockReturnValue([
				{ id: '1', folderId: 'f1', updatedAt: '2020-01-01T00:00:00Z', deletedAt: null },
				{ id: '2', folderId: 'f1', updatedAt: '2025-01-01T00:00:00Z', deletedAt: null }
			])
		};

		const result = new NoteService(folders as any, notes as any).getNotesForFolder('f1');

		expect(result.map((note: any) => note.id)).toEqual(['2', '1']);
	});

	it('should return deleted notes for trash folder', () => {
		const folders = { findItemById: (id: string) => ({ id, profile: ['home', 'favorites', 'deleted-notes', 'trash'].includes(id) ? (id === 'deleted-notes' ? 'trash' : id) : 'regular' }) };
		const notes = {
			listNotes: vi.fn().mockReturnValue([
				{ id: '1', folderId: 'f1', deletedAt: 123, updatedAt: '2025-01-01T00:00:00Z' },
				{ id: '2', folderId: 'f1', deletedAt: null, updatedAt: '2024-01-01T00:00:00Z' }
			])
		};

		const result = new NoteService(folders as any, notes as any).getNotesForFolder('deleted-notes', 'trash');

		expect(result.map((note: any) => note.id)).toEqual(['1']);
	});

	it('should return favorite notes for the favorites virtual view', () => {
		const notes = {
			listNotes: vi.fn().mockReturnValue([
				{
					id: '1',
					folderId: 'f1',
					isFavorite: true,
					deletedAt: null,
					updatedAt: '2025-01-01T00:00:00Z'
				},
				{
					id: '2',
					folderId: 'f1',
					isFavorite: false,
					deletedAt: null,
					updatedAt: '2024-01-01T00:00:00Z'
				},
				{
					id: '3',
					folderId: 'f1',
					isFavorite: true,
					deletedAt: 123,
					updatedAt: '2023-01-01T00:00:00Z'
				}
			])
		};

		const result = new NoteService({ findItemById: (id: string) => ({ id, profile: ['home', 'favorites', 'deleted-notes', 'trash'].includes(id) ? id : 'regular' }) } as any, notes as any).getNotesForFolder(
			'favorites',
			'favorites'
		);

		expect(result.map((note: any) => note.id)).toEqual(['1']);
	});

	it('should count notes using the folder-aware query rules', () => {
		const folders = {
			findItemById: vi.fn().mockImplementation((id) => (id ? { id, profile: 'regular' } : null))
		};
		const notes = {
			listNotes: vi.fn().mockReturnValue([
				{ id: '1', folderId: 'f1', deletedAt: null, updatedAt: '2025-01-01T00:00:00Z' },
				{ id: '2', folderId: 'f1', deletedAt: null, updatedAt: '2024-01-01T00:00:00Z' },
				{ id: '3', folderId: 'f2', deletedAt: null, updatedAt: '2023-01-01T00:00:00Z' }
			]),
			getNoteCount: vi.fn().mockReturnValue(2),
			getDeletedNotes: vi.fn(() => [])
		};

		const count = new NoteService(folders as any, notes as any).getNoteCountForFolder('f1');

		expect(count).toBe(2);
	});

	it('should include deleted subtree notes when viewing a deleted folder', () => {
		const deletedFolder = { id: 'A', deletedAt: 123, items: ['B'], profile: 'regular' };
		const childFolder = { id: 'B', deletedAt: 123, items: [], profile: 'regular' };
		const folders = {
			findItemById: vi.fn().mockImplementation((id: string) => {
				if (id === 'A') return deletedFolder;
				if (id === 'B') return childFolder;
				return null;
			})
		};
		const notes = {
			listNotes: vi.fn().mockReturnValue([
				{ id: 'note-x', folderId: 'B', deletedAt: 123, updatedAt: '2025-01-01T00:00:00Z' },
				{ id: 'note-y', folderId: 'B', deletedAt: 999, updatedAt: '2024-01-01T00:00:00Z' }
			])
		};

		const result = new NoteService(folders as any, notes as any).getNotesForFolder('A');

		expect(result.map((note: any) => note.id)).toEqual(['note-x']);
	});
});

describe('TrashService (Flat Recovery)', () => {
	it('should recover a note to Home (null) if parent folder is deleted', () => {
		const folders = {
			findItemById: vi.fn().mockImplementation((id: string) => {
				if (id === 'folder-a') return { id: 'folder-a', deletedAt: 123, items: [], profile: 'regular' };
				return null;
			})
		};
		const selection = {
			selectFolder: vi.fn()
		};
		const notes = {
			getNote: vi.fn().mockReturnValue({ id: 'note-1', folderId: 'folder-a' }),
			restoreNote: vi.fn(),
			selectNote: vi.fn()
		};

		const trashService = new TrashService(
			folders as any,
			notes as any,
			trashRepository as any,
			selection as any
		);

		// When n1 is restored, TrashService should now look for a neighbor in Trash.
		// In our test mock, getDeletedNotes returns empty by default, so it will select null.
		trashService.recoverNote('n1');
		expect(notes.restoreNote).toHaveBeenCalledWith('n1', null);
		expect(notes.selectNote).toHaveBeenCalledWith(null);
	});

	it('should recover a note to its original folder if parent is active', () => {
		const folders = {
			findItemById: vi.fn().mockReturnValue({ id: 'folder-a', deletedAt: null, profile: 'regular' })
		};
		const selection = {
			selectFolder: vi.fn()
		};
		const notes = {
			getNote: vi.fn().mockReturnValue({ id: 'note-1', folderId: 'folder-a' }),
			restoreNote: vi.fn(),
			selectNote: vi.fn()
		};

		const trashService = new TrashService(
			folders as any,
			notes as any,
			trashRepository as any,
			selection as any
		);
		trashService.recoverNote('note-1');
		expect(notes.restoreNote).toHaveBeenCalledWith('note-1', undefined);
		// Should NOT select the folder, stay in Trash view
		expect(selection.selectFolder).not.toHaveBeenCalled();
		expect(notes.selectNote).toHaveBeenCalledWith(null);
	});

	it('should root the folder if its parent is deleted during recovery', () => {
		const folders = {
			findItemById: vi.fn().mockReturnValue({ id: 'folder-1', deletedAt: 123, profile: 'regular', items: [] }),
			restoreFolder: vi.fn(),
			rootFolderIfParentMissing: vi.fn()
		};
		const selection = {
			selectFolder: vi.fn()
		};
		const notes = {
			restoreNotesInFolder: vi.fn(),
			listNotes: vi.fn().mockReturnValue([]),
			selectNote: vi.fn()
		};

		new TrashService(
			folders as any,
			notes as any,
			trashRepository as any,
			selection as any
		).recoverFolder('folder-1', 123);

		// Verification: rootFolderIfParentMissing called, but NO restoreParentPath
		expect(folders.rootFolderIfParentMissing).toHaveBeenCalledWith('folder-1');
		expect(folders.restoreFolder).toHaveBeenCalledWith('folder-1', 123);
		expect(selection.selectFolder).toHaveBeenCalledWith('folder-1');
	});

	it('should delegate permanent folder deletion', async () => {
		const folders = {
			findItemById: vi.fn().mockImplementation((id: string) => {
				if (id === 'folder-1')
					return { id: 'folder-1', title: 'Folder', deletedAt: 123, items: [], profile: 'regular' };
				return null;
			}),
			applyPermanentDeleteState: vi.fn()
		};
		const selection = {
			selectedFolderID: null,
			selectFolder: vi.fn(),
			getSelectedFolder: vi.fn(),
			clearFolderIfSelected: vi.fn()
		};
		const notes = {
			getNotesToArchive: vi.fn().mockReturnValue([]),
			removeNoteLocally: vi.fn()
		};

		vi.mocked(trashRepository.permanentlyDeleteFolderTree).mockResolvedValue(undefined as any);

		await new TrashService(
			folders as any,
			notes as any,
			trashRepository as any,
			selection as any
		).permanentlyDeleteFolder('folder-1', 123);

		expect(folders.applyPermanentDeleteState).toHaveBeenCalled();
	});
});
