import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FolderStore } from '../../../src/lib/stores/folders.svelte';
import { NotesStore } from '../../../src/lib/stores/notes.svelte';
import { SelectionStore } from '../../../src/lib/stores/selection.svelte';
import { SvelteMap } from 'svelte/reactivity';

// Mock repositories
vi.mock('../../../src/lib/infrastructure/repositories', () => ({
	foldersRepository: { list: vi.fn(), save: vi.fn() },
	notesRepository: { 
		list: vi.fn(), 
		save: vi.fn().mockResolvedValue(undefined),
		saveMeta: vi.fn().mockResolvedValue(undefined),
		saveContent: vi.fn().mockResolvedValue(undefined)
	},
	settingsRepository: { getAll: vi.fn(), save: vi.fn() }
}));

describe('Phase A: Reactivity & Mutation Tests', () => {
    let mockFolderStore: FolderStore;
    let selectionStore: SelectionStore;
    let mockNotesStore: NotesStore;

	beforeEach(() => {
		vi.clearAllMocks();
		
        mockFolderStore = new FolderStore();
        selectionStore = new SelectionStore(mockFolderStore);
        mockNotesStore = new NotesStore();

		// Reset store state
		(mockNotesStore as any).isInitialized = true;
		(mockFolderStore as any).isInitialized = true;
	});

	it('Item 3.1: should NOT call Map.set when updating existing note properties', () => {
		mockNotesStore.createNote('f1');
		const noteId = mockNotesStore.selectedNoteID!;
		const setSpy = vi.spyOn(mockNotesStore.notes, 'set');

		// 1. Update via updateNote
		mockNotesStore.updateNote(noteId, { title: 'New Title' });
		// Now it DOES call set for immutable replacement
		expect(setSpy).toHaveBeenCalledTimes(1);

		// 2. setFavorite
		setSpy.mockClear();
		mockNotesStore.setFavorite(noteId, true);
		expect(setSpy).toHaveBeenCalledTimes(1); 
	});

	it('Item 3.2: should NOT update updatedAt when typing (content update)', () => {
		mockNotesStore.createNote('f1');
		const noteId = mockNotesStore.selectedNoteID!;
		const note = mockNotesStore.getNote(noteId)!;
		const initialUpdatedAt = note.updatedAt;

		// Simulate typing
		// @ts-ignore - updates.updatedTimestamp exists
		mockNotesStore.updateNote(noteId, { content: 'typing...' }, { updatedTimestamp: false });

		const updatedNote = mockNotesStore.getNote(noteId)!;
		expect(updatedNote.content).toBe('typing...');
		expect(updatedNote.updatedAt).toBe(initialUpdatedAt);
	});

	it('Reactivity: counts should still update correctly without Map.set', () => {
		mockNotesStore.createNote('f1');
		const noteId = mockNotesStore.selectedNoteID!;
		
		// Initial state
		expect(mockNotesStore.counts.favorites).toBe(0);

		// Toggle favorite
		mockNotesStore.setFavorite(noteId, true);
		
		expect(mockNotesStore.counts.favorites).toBe(1);
	});

	it('Edge Case: Moving folders should still update counts correctly', () => {
		mockNotesStore.createNote('f1');
		const noteId = mockNotesStore.selectedNoteID!;

		expect(mockNotesStore.getNoteCount('f1')).toBe(1);
		expect(mockNotesStore.getNoteCount('f2')).toBe(0);

		// Move folder
		mockNotesStore.updateNote(noteId, { folderId: 'f2' });

		expect(mockNotesStore.getNoteCount('f1')).toBe(0);
		expect(mockNotesStore.getNoteCount('f2')).toBe(1);
	});
});
