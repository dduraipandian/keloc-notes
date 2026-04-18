import { describe, it, expect, vi } from 'vitest';
import { foldersRepository, notesRepository, settingsRepository, trashRepository } from '../../src/lib/stores/repositories';
import * as idbr from '../../src/lib/stores/idbr';

// Mock idbr to verify wiring without actually calling IndexedDB again
vi.mock('../../src/lib/stores/idbr', () => ({
	getAllFolders: vi.fn(),
	putFolder: vi.fn(),
	getAllNotesMeta: vi.fn(),
	putNoteMeta: vi.fn(),
	putNoteContent: vi.fn(),
	getNoteContent: vi.fn(),
	getAllSettings: vi.fn(),
	putSetting: vi.fn(),
	permanentDeleteFolderTransactionally: vi.fn(),
	permanentDeleteNoteTransactionally: vi.fn()
}));

describe('Repositories (Wiring Tests)', () => {
	it('foldersRepository.list should call getAllFolders', async () => {
		await foldersRepository.list();
		expect(idbr.getAllFolders).toHaveBeenCalled();
	});

	it('foldersRepository.save should call putFolder', async () => {
		const folder = { id: 'f1' } as any;
		await foldersRepository.save(folder);
		expect(idbr.putFolder).toHaveBeenCalledWith(folder);
	});

	it('notesRepository.list should call getAllNotesMeta', async () => {
		await notesRepository.list();
		expect(idbr.getAllNotesMeta).toHaveBeenCalled();
	});

	it('notesRepository.saveMeta should call putNoteMeta', async () => {
		const meta = { id: 'n1' } as any;
		await notesRepository.saveMeta(meta);
		expect(idbr.putNoteMeta).toHaveBeenCalledWith(meta);
	});

	it('notesRepository.saveContent should call putNoteContent', async () => {
		await notesRepository.saveContent('n1', 'content');
		expect(idbr.putNoteContent).toHaveBeenCalledWith('n1', 'content');
	});

	it('notesRepository.getContent should call getNoteContent', async () => {
		await notesRepository.getContent('n1');
		expect(idbr.getNoteContent).toHaveBeenCalledWith('n1');
	});

	it('settingsRepository.getAll should call getAllSettings', async () => {
		await settingsRepository.getAll();
		expect(idbr.getAllSettings).toHaveBeenCalled();
	});

	it('settingsRepository.save should call putSetting', async () => {
		await settingsRepository.save('key', 'value');
		expect(idbr.putSetting).toHaveBeenCalledWith('key', 'value');
	});

	it('trashRepository.permanentlyDeleteFolderTree should call permanentDeleteFolderTransactionally', async () => {
		await trashRepository.permanentlyDeleteFolderTree([], [], 123);
		expect(idbr.permanentDeleteFolderTransactionally).toHaveBeenCalledWith([], [], 123);
	});

	it('trashRepository.permanentlyDeleteNote should call permanentDeleteNoteTransactionally', async () => {
		const note = { id: 'n1' } as any;
		await trashRepository.permanentlyDeleteNote(note, 'path', 123);
		expect(idbr.permanentDeleteNoteTransactionally).toHaveBeenCalledWith(note, 'path', 123);
	});
});
