import { describe, it, expect, beforeEach, vi } from 'vitest';
import { notesStore } from '../../../src/lib/stores/notes.svelte';
import { folderStore } from '../../../src/lib/stores/folders.svelte';
import { selectionStore } from '../../../src/lib/stores/selection.svelte';
import { notesRepository, settingsRepository } from '../../../src/lib/infrastructure/repositories';
import { NoteService, TrashService } from '../../../src/lib/stores/services';

// Mock repositories
vi.mock('../../../src/lib/infrastructure/repositories', () => ({
	foldersRepository: { list: vi.fn(), save: vi.fn() },
	notesRepository: { 
		list: vi.fn(), 
		saveMeta: vi.fn().mockResolvedValue(undefined),
		saveContent: vi.fn().mockResolvedValue(undefined)
	},
	settingsRepository: { getAll: vi.fn(), save: vi.fn() },
	trashRepository: { permanentlyDeleteNote: vi.fn(), permanentlyDeleteFolderTree: vi.fn() }
}));

describe('Selection Shifting Behavior', () => {
	let noteService: NoteService;
	let trashService: TrashService;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		
		// Reset stores
		(notesStore as any).notes.clear();
		(notesStore as any).isInitialized = true;
		(folderStore as any).isInitialized = true;
		
		noteService = new NoteService(folderStore, notesStore, selectionStore);
		trashService = new TrashService(folderStore, notesStore, undefined as any, selectionStore);

		// Setup mock notes
		const notes = [
			{ id: 'n1', title: 'Note 1', folderId: 'f1', updatedAt: '2023-01-01T00:00:00.000Z', deletedAt: null, summary: '', isFavorite: false, isContentLoaded: true },
			{ id: 'n2', title: 'Note 2', folderId: 'f1', updatedAt: '2023-01-01T00:00:01.000Z', deletedAt: null, summary: '', isFavorite: false, isContentLoaded: true },
			{ id: 'n3', title: 'Note 3', folderId: 'f1', updatedAt: '2023-01-01T00:00:02.000Z', deletedAt: null, summary: '', isFavorite: false, isContentLoaded: true }
		];

		notes.forEach(note => {
			let n = $state(note);
			notesStore.notes.set(note.id, n as any);
		});
		
		// Setup mock folder
		let f1 = $state({ id: 'f1', title: 'Folder 1', profile: 'regular' });
		folderStore.folders.set('f1', f1 as any);
	});

	describe('Deletion in Folder', () => {
		it('should select the next note (older) when a middle note is deleted', () => {
			selectionStore.selectFolder('f1');
			notesStore.selectNote('n2');
			
			noteService.delete('n2');
			
			// List is [n3, n2, n1]. Deleting n2 (index 1) selects index 2 (n1)
			expect(notesStore.selectedNoteID).toBe('n1');
			expect(settingsRepository.save).toHaveBeenCalledWith('selectedNoteID', 'n1');
		});

		it('should select the previous note (newer) when the last note is deleted', () => {
			selectionStore.selectFolder('f1');
			notesStore.selectNote('n1');
			
			noteService.delete('n1');
			
			// List is [n3, n2, n1]. Deleting n1 (index 2) selects index 1 (n2)
			expect(notesStore.selectedNoteID).toBe('n2');
			expect(settingsRepository.save).toHaveBeenCalledWith('selectedNoteID', 'n2');
		});

		it('should clear selection when the only note is deleted', () => {
			// Remove others
			notesStore.notes.delete('n2');
			notesStore.notes.delete('n3');
			
			selectionStore.selectFolder('f1');
			notesStore.selectNote('n1');
			
			noteService.delete('n1');
			
			expect(notesStore.selectedNoteID).toBeNull();
			expect(settingsRepository.save).toHaveBeenCalledWith('selectedNoteID', null);
		});
	});

	describe('Restoration from Trash', () => {
		beforeEach(() => {
			// Mark notes as deleted
			const n1 = notesStore.notes.get('n1')!;
			const n2 = notesStore.notes.get('n2')!;
			const n3 = notesStore.notes.get('n3')!;
			n1.deletedAt = 1000;
			n2.deletedAt = 1000;
			n3.deletedAt = 1000;
			
			// Select Trash view
			selectionStore.selectFolder('deleted-notes');
		});

		it('should select the next note (older) in Trash when a note is restored', () => {
			notesStore.selectNote('n2');
			
			trashService.recoverNote('n2');
			
			// Note should be restored locally
			expect(notesStore.notes.get('n2')?.deletedAt).toBeNull();
			// Selection should move to n1 (older neighbor) in Trash
			expect(notesStore.selectedNoteID).toBe('n1');
			// Persistence should be triggered for selection
			expect(settingsRepository.save).toHaveBeenCalledWith('selectedNoteID', 'n1');
		});

		it('should select the previous note (newer) in Trash when the last deleted note is restored', () => {
			notesStore.selectNote('n1');
			
			trashService.recoverNote('n1');
			
			// n1 is removed from Trash. n2 is the newest neighbor available.
			expect(notesStore.selectedNoteID).toBe('n2');
			expect(settingsRepository.save).toHaveBeenCalledWith('selectedNoteID', 'n2');
		});
	});
});
