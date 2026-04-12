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
