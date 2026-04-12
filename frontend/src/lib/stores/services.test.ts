import { describe, expect, it, vi } from 'vitest';
import { FolderService, NoteService, TrashService } from './services';
import * as idbr from './idbr';

vi.mock('./idbr', () => ({
	permanentDeleteFolderTransactionally: vi.fn(),
	permanentDeleteNoteTransactionally: vi.fn()
}));

describe('FolderService', () => {
	it('should delegate folder creation', () => {
		const folders = { createFolder: vi.fn() };

		new FolderService(folders as any).create();

		expect(folders.createFolder).toHaveBeenCalled();
	});

	it('should delegate folder selection', () => {
		const folders = { selectFolder: vi.fn() };

		new FolderService(folders as any).select('folder-1');

		expect(folders.selectFolder).toHaveBeenCalledWith('folder-1');
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

	it('should delegate folder deletion', () => {
		const folders = {
			findItemById: vi.fn().mockImplementation((id: string) =>
				id === 'folder-1' ? { id: 'folder-1', items: ['child-1'] } : { id: 'child-1', items: [] }
			),
			deleteFolder: vi.fn()
		};
		const notes = { deleteNotesInFolder: vi.fn() };

		new FolderService(folders as any, notes as any).delete('folder-1', 123);

		expect(folders.deleteFolder).toHaveBeenCalledWith('folder-1', 123);
		expect(folders.deleteFolder).toHaveBeenCalledWith('child-1', 123);
		expect(notes.deleteNotesInFolder).toHaveBeenCalledWith('folder-1', 123);
		expect(notes.deleteNotesInFolder).toHaveBeenCalledWith('child-1', 123);
	});
});

describe('NoteService', () => {
	it('should create in the selected regular folder', () => {
		const folders = {
			findItemById: vi.fn().mockReturnValue({ id: 'work', type: 'regular' }),
			getDefaultFolderId: vi.fn()
		};
		const notes = { createNote: vi.fn() };

		new NoteService(folders as any, notes as any).create('work');

		expect(notes.createNote).toHaveBeenCalledWith('work');
		expect(folders.getDefaultFolderId).not.toHaveBeenCalled();
	});

	it('should fall back to the default folder for trash/system views', () => {
		const folders = {
			findItemById: vi.fn().mockReturnValue({ id: 'deleted-notes', type: 'trash' }),
			getDefaultFolderId: vi.fn().mockReturnValue('notes')
		};
		const notes = { createNote: vi.fn() };

		new NoteService(folders as any, notes as any).create('deleted-notes');

		expect(folders.getDefaultFolderId).toHaveBeenCalled();
		expect(notes.createNote).toHaveBeenCalledWith('notes');
	});

	it('should delegate note updates', () => {
		const folders = {};
		const notes = { updateNote: vi.fn() };

		new NoteService(folders as any, notes as any).update('note-1', { title: 'Updated' });

		expect(notes.updateNote).toHaveBeenCalledWith('note-1', { title: 'Updated' });
	});

	it('should delegate note selection', () => {
		const folders = {};
		const notes = { selectNote: vi.fn() };

		new NoteService(folders as any, notes as any).select('note-1');

		expect(notes.selectNote).toHaveBeenCalledWith('note-1');
	});

	it('should delegate soft deletion', () => {
		const folders = {};
		const notes = { deleteNote: vi.fn() };

		new NoteService(folders as any, notes as any).delete('note-1', 123);

		expect(notes.deleteNote).toHaveBeenCalledWith('note-1', 123);
	});

	it('should return notes for a folder sorted by updatedAt descending', () => {
		const folders = { findItemById: vi.fn().mockReturnValue(null) };
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
		const folders = {};
		const notes = {
			listNotes: vi.fn().mockReturnValue([
				{ id: '1', folderId: 'f1', deletedAt: 123, updatedAt: '2025-01-01T00:00:00Z' },
				{ id: '2', folderId: 'f1', deletedAt: null, updatedAt: '2024-01-01T00:00:00Z' }
			])
		};

		const result = new NoteService(folders as any, notes as any).getNotesForFolder('deleted-notes');

		expect(result.map((note: any) => note.id)).toEqual(['1']);
	});

	it('should count notes using the folder-aware query rules', () => {
		const folders = { findItemById: vi.fn().mockReturnValue(null) };
		const notes = {
			listNotes: vi.fn().mockReturnValue([
				{ id: '1', folderId: 'f1', deletedAt: null, updatedAt: '2025-01-01T00:00:00Z' },
				{ id: '2', folderId: 'f1', deletedAt: null, updatedAt: '2024-01-01T00:00:00Z' },
				{ id: '3', folderId: 'f2', deletedAt: null, updatedAt: '2023-01-01T00:00:00Z' }
			])
		};

		const count = new NoteService(folders as any, notes as any).getNoteCountForFolder('f1');

		expect(count).toBe(2);
	});

	it('should include deleted subtree notes when viewing a deleted folder', () => {
		const deletedFolder = { id: 'A', deletedAt: 123, items: ['B'] };
		const childFolder = { id: 'B', deletedAt: 123, items: [] };
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

describe('TrashService', () => {
	it('should recover a note with folder hierarchy when the parent chain is deleted', () => {
		const folders = {
			findItemById: vi.fn().mockReturnValue({ id: 'folder-a', deletedAt: 123, items: [] }),
			findTopDeletedAncestor: vi.fn().mockReturnValue({ id: 'folder-a' }),
			restoreFolder: vi.fn(),
			rootFolderIfParentMissing: vi.fn(),
			restoreParentPath: vi.fn()
		};
		const notes = {
			getNote: vi.fn().mockReturnValue({ id: 'note-1', folderId: 'folder-a' }),
			restoreNotesInFolder: vi.fn(),
			restoreNote: vi.fn()
		};

		new TrashService(folders as any, notes as any).recoverNote('note-1');

		expect(folders.findTopDeletedAncestor).toHaveBeenCalledWith('folder-a');
		expect(folders.restoreFolder).toHaveBeenCalledWith('folder-a', 123);
		expect(notes.restoreNotesInFolder).toHaveBeenCalledWith('folder-a', 123);
		expect(notes.restoreNote).toHaveBeenCalledWith('note-1', undefined);
	});

	it('should recover only the note when no deleted ancestor exists', () => {
		const folders = {
			findItemById: vi.fn().mockReturnValue({ id: 'folder-a', deletedAt: null }),
			findTopDeletedAncestor: vi.fn().mockReturnValue(null)
		};
		const notes = {
			getNote: vi.fn().mockReturnValue({ id: 'note-1', folderId: 'folder-a' }),
			restoreNote: vi.fn()
		};

		new TrashService(folders as any, notes as any).recoverNote('note-1');

		expect(notes.restoreNote).toHaveBeenCalledWith('note-1', undefined);
	});

	it('should root the note when its parent folder is deleted but hierarchy is not restored', () => {
		const folders = {
			findItemById: vi.fn().mockReturnValue({ id: 'folder-a', deletedAt: 123, items: [] }),
			findTopDeletedAncestor: vi.fn().mockReturnValue(null)
		};
		const notes = {
			getNote: vi.fn().mockReturnValue({ id: 'note-1', folderId: 'folder-a' }),
			restoreNote: vi.fn()
		};

		new TrashService(folders as any, notes as any).recoverNote('note-1');

		expect(notes.restoreNote).toHaveBeenCalledWith('note-1', null);
	});

	it('should root the note when its parent folder metadata is missing', () => {
		const folders = {
			findItemById: vi.fn().mockReturnValue(null),
			findTopDeletedAncestor: vi.fn().mockReturnValue(null)
		};
		const notes = {
			getNote: vi.fn().mockReturnValue({ id: 'note-1', folderId: 'missing-folder' }),
			restoreNote: vi.fn()
		};

		new TrashService(folders as any, notes as any).recoverNote('note-1');

		expect(notes.restoreNote).toHaveBeenCalledWith('note-1', null);
	});

	it('should delegate folder recovery', () => {
		const folders = {
			findItemById: vi.fn().mockReturnValue({ id: 'folder-1', deletedAt: 123, items: [] }),
			restoreFolder: vi.fn(),
			rootFolderIfParentMissing: vi.fn(),
			restoreParentPath: vi.fn()
		};
		const notes = { restoreNotesInFolder: vi.fn() };

		new TrashService(folders as any, notes as any).recoverFolder('folder-1', 123);

		expect(folders.restoreFolder).toHaveBeenCalledWith('folder-1', 123);
		expect(notes.restoreNotesInFolder).toHaveBeenCalledWith('folder-1', 123);
	});

	it('should repair the folder path when recovering a top-level deleted folder', () => {
		const folder = { id: 'folder-1', deletedAt: 123, parentId: 'missing-parent', items: [] };
		const folders = {
			findItemById: vi.fn().mockImplementation((id: string) => (id === 'folder-1' ? folder : null)),
			restoreFolder: vi.fn(),
			rootFolderIfParentMissing: vi.fn(),
			restoreParentPath: vi.fn()
		};
		const notes = { restoreNotesInFolder: vi.fn() };

		new TrashService(folders as any, notes as any).recoverFolder('folder-1');

		expect(folders.rootFolderIfParentMissing).toHaveBeenCalledWith('folder-1');
		expect(folders.restoreParentPath).toHaveBeenCalledWith('missing-parent');
	});

	it('should delegate permanent folder deletion', async () => {
		const folders = {
			findItemById: vi.fn().mockReturnValue({ id: 'folder-1', deletedAt: 123 }),
			collectFolderSubtree: vi.fn().mockReturnValue([{ id: 'folder-1', deletedAt: 123 }]),
			getFolderPath: vi.fn().mockReturnValue('Folder:folder-1'),
			applyPermanentDeleteState: vi.fn(),
			clearSelectionIfSelected: vi.fn()
		};
		const notes = {
			getNotesToArchive: vi.fn().mockReturnValue([]),
			removeNoteLocally: vi.fn()
		};

		vi.mocked(idbr.permanentDeleteFolderTransactionally).mockResolvedValue(undefined as any);

		await new TrashService(folders as any, notes as any).permanentlyDeleteFolder('folder-1', 123);

		expect(idbr.permanentDeleteFolderTransactionally).toHaveBeenCalled();
		expect(folders.applyPermanentDeleteState).toHaveBeenCalledWith([{ id: 'folder-1', deletedAt: 123 }]);
		expect(folders.clearSelectionIfSelected).toHaveBeenCalledWith('folder-1');
	});

	it('should delegate permanent note deletion', async () => {
		const folders = { getFolderPath: vi.fn().mockReturnValue('Work:f1') };
		const notes = {
			getNote: vi.fn().mockReturnValue({ id: 'note-1', title: 'Note 1', folderId: 'f1' }),
			removeNoteLocally: vi.fn(),
			clearSelectionIfSelected: vi.fn()
		};

		vi.mocked(idbr.permanentDeleteNoteTransactionally).mockResolvedValue(undefined as any);

		await new TrashService(folders as any, notes as any).permanentlyDeleteNote('note-1');

		expect(idbr.permanentDeleteNoteTransactionally).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'note-1' }),
			'Work:f1/Note 1:note-1',
			expect.any(Number)
		);
		expect(notes.removeNoteLocally).toHaveBeenCalledWith('note-1');
	});

	it('should delegate empty trash', async () => {
		const folders = {
			trashItems: ['folder-1'],
			collectFolderSubtree: vi.fn().mockReturnValue([{ id: 'folder-1', deletedAt: 123 }]),
			getFolderPath: vi.fn().mockReturnValue('Folder:folder-1'),
			applyPermanentDeleteState: vi.fn(),
			clearSelectionIfSelected: vi.fn()
		};
		const notes = {
			getDeletedNotes: vi.fn().mockReturnValue([]),
			removeNoteLocally: vi.fn()
		};

		vi.mocked(idbr.permanentDeleteFolderTransactionally).mockResolvedValue(undefined as any);

		await new TrashService(folders as any, notes as any).empty();

		expect(idbr.permanentDeleteFolderTransactionally).toHaveBeenCalled();
		expect(folders.applyPermanentDeleteState).toHaveBeenCalled();
	});
});
