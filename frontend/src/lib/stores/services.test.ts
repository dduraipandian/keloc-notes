import { describe, expect, it, vi } from 'vitest';
import { FolderService, NoteService, TrashService } from './services';

describe('FolderService', () => {
	it('should delegate folder creation', () => {
		const folders = { createFolder: vi.fn() };

		new FolderService(folders as any).create();

		expect(folders.createFolder).toHaveBeenCalled();
	});

	it('should delegate folder deletion', () => {
		const folders = { deleteFolder: vi.fn() };

		new FolderService(folders as any).delete('folder-1', 123);

		expect(folders.deleteFolder).toHaveBeenCalledWith('folder-1', 123);
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
			findTopDeletedAncestor: vi.fn().mockReturnValue({ id: 'folder-a' })
		};
		const notes = {
			getNote: vi.fn().mockReturnValue({ id: 'note-1', folderId: 'folder-a' }),
			recoverNote: vi.fn()
		};

		new TrashService(folders as any, notes as any).recoverNote('note-1');

		expect(folders.findTopDeletedAncestor).toHaveBeenCalledWith('folder-a');
		expect(notes.recoverNote).toHaveBeenCalledWith('note-1', true);
	});

	it('should recover only the note when no deleted ancestor exists', () => {
		const folders = {
			findTopDeletedAncestor: vi.fn().mockReturnValue(null)
		};
		const notes = {
			getNote: vi.fn().mockReturnValue({ id: 'note-1', folderId: 'folder-a' }),
			recoverNote: vi.fn()
		};

		new TrashService(folders as any, notes as any).recoverNote('note-1');

		expect(notes.recoverNote).toHaveBeenCalledWith('note-1', false);
	});

	it('should delegate folder recovery', () => {
		const folders = { recoverFolderAndChildren: vi.fn() };
		const notes = {};

		new TrashService(folders as any, notes as any).recoverFolder('folder-1', 123);

		expect(folders.recoverFolderAndChildren).toHaveBeenCalledWith('folder-1', 123);
	});

	it('should delegate permanent folder deletion', async () => {
		const folders = { permanentDeleteFolderAndChildren: vi.fn().mockResolvedValue(undefined) };
		const notes = {};

		await new TrashService(folders as any, notes as any).permanentlyDeleteFolder('folder-1', 123);

		expect(folders.permanentDeleteFolderAndChildren).toHaveBeenCalledWith('folder-1', 123);
	});

	it('should delegate permanent note deletion', async () => {
		const folders = {};
		const notes = { permanentDeleteNote: vi.fn().mockResolvedValue(undefined) };

		await new TrashService(folders as any, notes as any).permanentlyDeleteNote('note-1');

		expect(notes.permanentDeleteNote).toHaveBeenCalledWith('note-1');
	});

	it('should delegate empty trash', async () => {
		const folders = { emptyTrash: vi.fn().mockResolvedValue(undefined) };
		const notes = {};

		await new TrashService(folders as any, notes as any).empty();

		expect(folders.emptyTrash).toHaveBeenCalled();
	});
});
