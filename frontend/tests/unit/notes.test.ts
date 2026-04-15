import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { notesStore, type NoteItem } from '../../src/lib/stores/notes.svelte';
import { folderStore, type FolderItem } from '../../src/lib/stores/folders.svelte';
import { noteService, trashService } from '../../src/lib/stores/services';
import { selectionStore } from '../../src/lib/stores/selection.svelte';
import { SvelteMap } from 'svelte/reactivity';
import { notesRepository, settingsRepository } from '../../src/lib/stores/repositories';

// Mock IDBR module
vi.mock('../../src/lib/stores/repositories', () => ({
	foldersRepository: { list: vi.fn(), save: vi.fn() },
	notesRepository: { list: vi.fn(), save: vi.fn() },
	settingsRepository: { getAll: vi.fn(), save: vi.fn() },
	trashRepository: { permanentlyDeleteFolderTree: vi.fn(), permanentlyDeleteNote: vi.fn() }
}));

// Mock crypto.randomUUID
global.crypto.randomUUID = vi.fn(() => 'test-uuid' as any);

describe('NotesStore (Flat Recovery)', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();
		(notesStore as any).notes = new SvelteMap();
		(notesStore as any).selectedNoteID = null;
		(notesStore as any).onPersistError = null;
		(notesStore as any).isInitialized = true;
		(folderStore as any).items = [];
		(folderStore as any).folders = new SvelteMap();
		(folderStore as any).isInitialized = true;
		selectionStore.__resetForTest();
	});

	const addNoteToStore = (note: Partial<NoteItem> & { id: string }) => {
		const fullNote: NoteItem = {
			folderId: null,
			title: 'Untitled',
			content: '',
			updatedAt: new Date().toISOString(),
			deletedAt: null,
			...note
		};
		notesStore.notes.set(fullNote.id, fullNote);
	};

	it('should recover a note to Home (null) if parent is deleted', () => {
		const parent: FolderItem = { id: 'f1', title: 'Deleted Folder', deletedAt: 123 };
		folderStore.folders.set('f1', parent);

		addNoteToStore({ id: 'n1', folderId: 'f1', deletedAt: 123 });

		trashService.recoverNote('n1');

		expect(notesStore.notes.get('n1')?.deletedAt).toBeNull();
		expect(notesStore.notes.get('n1')?.folderId).toBeNull(); // Ejected to Home
		// Stay in trash, n1 removed from selection (since it's the only note)
		expect(notesStore.selectedNoteID).toBeNull();
	});

	it('should recover a note to its folder if parent is active', () => {
		const parent: FolderItem = { id: 'f1', title: 'Active Folder', deletedAt: null };
		folderStore.folders.set('f1', parent);
		folderStore.items.push('f1');

		addNoteToStore({ id: 'n1', folderId: 'f1', deletedAt: 123 });

		trashService.recoverNote('n1');

		expect(notesStore.notes.get('n1')?.deletedAt).toBeNull();
		expect(notesStore.notes.get('n1')?.folderId).toBe('f1'); // Preserved parent
		// Stay in trash
		expect(notesStore.selectedNoteID).toBeNull();
	});

	it('should recover a note to Home (null) if parent is MISSING', () => {
		// No parent in folderStore
		addNoteToStore({ id: 'n1', folderId: 'missing-id', deletedAt: 123 });

		trashService.recoverNote('n1');

		expect(notesStore.notes.get('n1')?.deletedAt).toBeNull();
		expect(notesStore.notes.get('n1')?.folderId).toBeNull(); // Ejected to Home
	});

	it('should persist null selection when selectNote(null) is called', () => {
		notesStore.selectNote(null);
		expect(notesStore.selectedNoteID).toBeNull();
		expect(settingsRepository.save).toHaveBeenCalledWith('selectedNoteID', null);
	});

	describe('persistNote error handling', () => {
		beforeEach(() => {
			vi.useFakeTimers();
			addNoteToStore({ id: 'n1', content: 'Original content' });
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it('surfaces save errors through onPersistError', async () => {
			const onPersistError = vi.fn();
			(notesStore as any).onPersistError = onPersistError;
			(notesRepository.save as any).mockRejectedValueOnce(new Error('quota'));

			notesStore.updateNote('n1', { content: 'Updated content' });
			vi.advanceTimersByTime(400);
			await Promise.resolve();

			expect(onPersistError).toHaveBeenCalledTimes(1);
			expect(onPersistError).toHaveBeenCalledWith(expect.any(Error), 'n1');
			expect(onPersistError.mock.calls[0][0].message).toBe('quota');
		});

		it('does not invoke onPersistError for successful saves', async () => {
			const onPersistError = vi.fn();
			(notesStore as any).onPersistError = onPersistError;
			(notesRepository.save as any).mockResolvedValueOnce(undefined);

			notesStore.updateNote('n1', { content: 'Updated content' });
			vi.advanceTimersByTime(400);
			await Promise.resolve();

			expect(onPersistError).not.toHaveBeenCalled();
		});

		it('surfaces selection persistence errors with the selection sentinel id', async () => {
			const onPersistError = vi.fn();
			(notesStore as any).onPersistError = onPersistError;
			(settingsRepository.save as any).mockRejectedValueOnce(new Error('settings failed'));

			notesStore.selectNote('n1');
			await Promise.resolve();

			expect(onPersistError).toHaveBeenCalledTimes(1);
			expect(onPersistError).toHaveBeenCalledWith(expect.any(Error), '__selection__');
			expect(onPersistError.mock.calls[0][0].message).toBe('settings failed');
		});
	});
});
