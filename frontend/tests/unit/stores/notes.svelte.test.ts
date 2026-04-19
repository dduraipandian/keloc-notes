import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NotesStore, type NoteItem } from '../../../src/lib/stores/notes.svelte';
import { FolderStore, type FolderItem } from '../../../src/lib/stores/folders.svelte';
import { TrashService } from '../../../src/lib/stores/services/trashService';
import { SelectionStore } from '../../../src/lib/stores/selection.svelte';
import { SvelteMap } from 'svelte/reactivity';
import { notesRepository, settingsRepository, trashRepository } from '../../../src/lib/infrastructure/repositories';

// Mock repositories module
vi.mock('../../../src/lib/infrastructure/repositories', () => ({
	foldersRepository: { list: vi.fn(), save: vi.fn() },
	notesRepository: { 
		list: vi.fn(), 
		saveMeta: vi.fn(), 
		saveContent: vi.fn(),
		getContent: vi.fn()
	},
	settingsRepository: { getAll: vi.fn(), save: vi.fn() },
	trashRepository: { permanentlyDeleteFolderTree: vi.fn(), permanentlyDeleteNote: vi.fn() }
}));

// Mock crypto.randomUUID
global.crypto.randomUUID = vi.fn(() => 'test-uuid' as any);

describe('NotesStore (Flat Recovery)', () => {
    let mockFolderStore: FolderStore;
	let selectionStore: SelectionStore;
    let mockNotesStore: NotesStore;
	let trashService: TrashService;

	beforeEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();
        
        mockFolderStore = new FolderStore();
        selectionStore = new SelectionStore(mockFolderStore);
        mockNotesStore = new NotesStore();

		(mockNotesStore as any).isInitialized = true;
		(mockFolderStore as any).isInitialized = true;
		
		trashService = new TrashService(
			mockFolderStore as any,
			mockNotesStore as any,
			trashRepository as any,
			selectionStore as any
		);
	});

	const addNoteToStore = (note: Partial<NoteItem> & { id: string }) => {
		const fullNote: NoteItem = {
			folderId: null,
			title: 'Untitled',
			summary: note.content ? mockNotesStore.summarize(note.content) : '',
			content: '',
			updatedAt: new Date().toISOString(),
			deletedAt: null,
			isContentLoaded: true,
			...note
		};
		mockNotesStore.notes.set(fullNote.id, fullNote);
	};

	it('should recover a note to Home (null) if parent is deleted', () => {
		const parent: FolderItem = { id: 'f1', title: 'Deleted Folder', deletedAt: 123 };
		mockFolderStore.folders.set('f1', parent);

		addNoteToStore({ id: 'n1', folderId: 'f1', deletedAt: 123 });

		trashService.recoverNote('n1');

		expect(mockNotesStore.notes.get('n1')?.deletedAt).toBeNull();
		expect(mockNotesStore.notes.get('n1')?.folderId).toBeNull(); // Ejected to Home
		// Stay in trash, n1 removed from selection (since it's the only note)
		expect(mockNotesStore.selectedNoteID).toBeNull();
	});

	it('should recover a note to its folder if parent is active', () => {
		const parent: FolderItem = { id: 'f1', title: 'Active Folder', deletedAt: null };
		mockFolderStore.folders.set('f1', parent);
		mockFolderStore.items.push('f1');

		addNoteToStore({ id: 'n1', folderId: 'f1', deletedAt: 123 });

		trashService.recoverNote('n1');

		expect(mockNotesStore.notes.get('n1')?.deletedAt).toBeNull();
		expect(mockNotesStore.notes.get('n1')?.folderId).toBe('f1'); // Preserved parent
		// Stay in trash
		expect(mockNotesStore.selectedNoteID).toBeNull();
	});

	it('should recover a note to Home (null) if parent is MISSING', () => {
		// No parent in folderStore
		addNoteToStore({ id: 'n1', folderId: 'missing-id', deletedAt: 123 });

		trashService.recoverNote('n1');

		expect(mockNotesStore.notes.get('n1')?.deletedAt).toBeNull();
		expect(mockNotesStore.notes.get('n1')?.folderId).toBeNull(); // Ejected to Home
	});

	it('should persist null selection when selectNote(null) is called', async () => {
		addNoteToStore({ id: 'n1' });
		mockNotesStore.selectNote('n1');
		vi.clearAllMocks();

		await mockNotesStore.selectNote(null);

		expect(mockNotesStore.selectedNoteID).toBeNull();
		expect(settingsRepository.save).toHaveBeenCalledWith('selectedNoteID', null);
	});

	describe('summarize and lazy-loading', () => {
		it('should summarize content correctly', () => {
			addNoteToStore({ id: 'n1', content: 'First line\nSecond line\nThird line' });
			const note = mockNotesStore.getNote('n1')!;
			expect(note.summary).toBe('First line Second line');
		});

		it('should load content on demand', async () => {
			vi.mocked(notesRepository.getContent).mockResolvedValue('loaded content');
			addNoteToStore({ id: 'n1', content: '', isContentLoaded: false });
			
			await mockNotesStore.loadNoteContent('n1');
			
			expect(mockNotesStore.getNote('n1')?.content).toBe('loaded content');
			expect(mockNotesStore.getNote('n1')?.isContentLoaded).toBe(true);
		});
	});

	describe('persistNote error handling', () => {
		it('surfaces save errors through onPersistError', async () => {
			vi.useFakeTimers();
			const onPersistError = vi.fn();
			(mockNotesStore as any).onPersistError = onPersistError;
			vi.mocked(notesRepository.saveMeta).mockRejectedValueOnce(new Error('save failed'));

			addNoteToStore({ id: 'n1', title: 'Old' });
			mockNotesStore.updateNote('n1', { title: 'New' });
			
			// Wait for async persist
			await vi.advanceTimersByTimeAsync(400);

			expect(onPersistError).toHaveBeenCalledWith(expect.any(Error), 'n1');
			vi.useRealTimers();
		});

		it('does not invoke onPersistError for successful saves', async () => {
			const onPersistError = vi.fn();
			(mockNotesStore as any).onPersistError = onPersistError;
			vi.mocked(notesRepository.saveMeta).mockResolvedValueOnce('n1' as any);

			addNoteToStore({ id: 'n1', title: 'Old' });
			mockNotesStore.updateNote('n1', { title: 'New' });
			
			await Promise.resolve();
			expect(onPersistError).not.toHaveBeenCalled();
		});

		it('surfaces selection persistence errors with the selection sentinel id', async () => {
			const onPersistError = vi.fn();
			(mockNotesStore as any).onPersistError = onPersistError;
			vi.mocked(settingsRepository.save).mockRejectedValueOnce(new Error('selection save failed'));

			addNoteToStore({ id: 'n1' });
			await mockNotesStore.selectNote('n1');

			expect(onPersistError).toHaveBeenCalledWith(expect.any(Error), '__selection__');
	});
});
});
