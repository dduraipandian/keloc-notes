import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FolderStore } from '../../../src/lib/stores/folders.svelte';
import { NotesStore } from '../../../src/lib/stores/notes.svelte';
import { SelectionStore } from '../../../src/lib/stores/selection.svelte';
import { notesRepository, settingsRepository } from '../../../src/lib/infrastructure/repositories';
import { NoteService, TrashService } from '../../../src/lib/stores/services';

// Mock repositories
vi.mock('../../../src/lib/infrastructure/repositories', () => ({
	foldersRepository: { list: vi.fn(), save: vi.fn() },
	notesRepository: { 
		list: vi.fn(), 
		save: vi.fn().mockResolvedValue(undefined),
		saveMeta: vi.fn().mockResolvedValue(undefined),
		saveContent: vi.fn().mockResolvedValue(undefined),
		getBulkContents: vi.fn().mockResolvedValue({})
	},
	settingsRepository: { getAll: vi.fn(), save: vi.fn() },
	trashRepository: { permanentlyDeleteNote: vi.fn(), permanentlyDeleteFolderTree: vi.fn() }
}));

describe('Selection Shifting Behavior', () => {
	let noteService: NoteService;
	let trashService: TrashService;
	let selectionStore: SelectionStore;
	let mockFolderStore: FolderStore;
	let mockNotesStore: NotesStore;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		
		mockFolderStore = new FolderStore();
		selectionStore = new SelectionStore(mockFolderStore);
		mockNotesStore = new NotesStore();
		
		(mockNotesStore as any).isInitialized = true;
		(mockFolderStore as any).isInitialized = true;
		
		noteService = new NoteService(mockFolderStore, mockNotesStore, selectionStore);
		trashService = new TrashService(mockFolderStore, mockNotesStore, selectionStore);

		// Setup mock notes
		const notes = [
			{ id: 'n1', title: 'Note 1', folderId: 'f1', updatedAt: '2023-01-01T00:00:00.000Z', deletedAt: null, summary: '', isFavorite: false, isContentLoaded: true },
			{ id: 'n2', title: 'Note 2', folderId: 'f1', updatedAt: '2023-01-01T00:00:01.000Z', deletedAt: null, summary: '', isFavorite: false, isContentLoaded: true },
			{ id: 'n3', title: 'Note 3', folderId: 'f1', updatedAt: '2023-01-01T00:00:02.000Z', deletedAt: null, summary: '', isFavorite: false, isContentLoaded: true }
		];

		notes.forEach(note => {
			let n = $state(note);
			mockNotesStore.notes.set(note.id, n as any);
		});
		
		// Setup mock folder
		let f1 = $state({ id: 'f1', title: 'Folder 1', profile: 'regular' });
		mockFolderStore.folders.set('f1', f1 as any);
	});

	describe('Deletion in Folder', () => {
		it('should select the next note (older) when a middle note is deleted', () => {
			selectionStore.selectFolder('f1');
			mockNotesStore.selectNote('n2');
			
			noteService.delete('n2');
			
			// List is [n3, n2, n1]. Deleting n2 (index 1) selects index 2 (n1)
			expect(mockNotesStore.selectedNoteID).toBe('n1');
			expect(settingsRepository.save).toHaveBeenCalledWith('selectedNoteID', 'n1');
		});

		it('should select the previous note (newer) when the last note is deleted', () => {
			selectionStore.selectFolder('f1');
			mockNotesStore.selectNote('n1');
			
			noteService.delete('n1');
			
			// List is [n3, n2, n1]. Deleting n1 (index 2) selects index 1 (n2)
			expect(mockNotesStore.selectedNoteID).toBe('n2');
			expect(settingsRepository.save).toHaveBeenCalledWith('selectedNoteID', 'n2');
		});

		it('should clear selection when the only note is deleted', () => {
			// Remove others
			mockNotesStore.notes.delete('n2');
			mockNotesStore.notes.delete('n3');
			
			selectionStore.selectFolder('f1');
			mockNotesStore.selectNote('n1');
			
			noteService.delete('n1');
			
			expect(mockNotesStore.selectedNoteID).toBeNull();
			expect(settingsRepository.save).toHaveBeenCalledWith('selectedNoteID', null);
		});
	});

	describe('Restoration from Trash', () => {
		beforeEach(() => {
			// Mark notes as deleted
			const n1 = mockNotesStore.notes.get('n1')!;
			const n2 = mockNotesStore.notes.get('n2')!;
			const n3 = mockNotesStore.notes.get('n3')!;
			n1.deletedAt = 1000;
			n2.deletedAt = 1000;
			n3.deletedAt = 1000;
			
			// Select Trash view
			selectionStore.selectFolder('deleted-notes');
		});

		it('should select the next note (older) in Trash when a note is restored', () => {
			mockNotesStore.selectNote('n2');
			
			trashService.recoverNote('n2');
			
			// Note should be restored locally
			expect(mockNotesStore.notes.get('n2')?.deletedAt).toBeNull();
			// Selection should move to n1 (older neighbor) in Trash
			expect(mockNotesStore.selectedNoteID).toBe('n1');
			// Persistence should be triggered for selection
			expect(settingsRepository.save).toHaveBeenCalledWith('selectedNoteID', 'n1');
		});

		it('should select the previous note (newer) in Trash when the last deleted note is restored', () => {
			mockNotesStore.selectNote('n1');
			
			trashService.recoverNote('n1');
			
			// n1 is removed from Trash. n2 is the newest neighbor available.
			expect(mockNotesStore.selectedNoteID).toBe('n2');
			expect(settingsRepository.save).toHaveBeenCalledWith('selectedNoteID', 'n2');
		});
	});
});
