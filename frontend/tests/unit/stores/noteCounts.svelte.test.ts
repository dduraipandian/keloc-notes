import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FolderStore } from '../../../src/lib/stores/folders.svelte';
import { NotesStore, type NoteItem } from '../../../src/lib/stores/notes.svelte';
import { SelectionStore } from '../../../src/lib/stores/selection.svelte';
import { SvelteMap } from 'svelte/reactivity';

// Mock repositories
vi.mock('../../../src/lib/infrastructure/repositories', () => ({
	foldersRepository: { list: vi.fn(), save: vi.fn() },
	notesRepository: { 
		list: vi.fn(), 
		saveMeta: vi.fn().mockResolvedValue(undefined),
		saveContent: vi.fn().mockResolvedValue(undefined)
	},
	settingsRepository: { getAll: vi.fn(), save: vi.fn() }
}));

// Mock crypto.randomUUID to be unique for tests
let uuidCounter = 0;
global.crypto.randomUUID = vi.fn(() => `test-uuid-${uuidCounter++}` as any);

describe('NotesStore Note Counts (Performance Optimization)', () => {
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

	it('should maintain accurate counts for notes in folders', () => {
		expect(mockNotesStore.getNoteCount('f1')).toBe(0);

		// Create a note in folder f1
		mockNotesStore.createNote('f1');
		expect(mockNotesStore.getNoteCount('f1')).toBe(1);

		// Create another note in f1
		mockNotesStore.createNote('f1');
		expect(mockNotesStore.getNoteCount('f1')).toBe(2);

		// Create a note in f2
		mockNotesStore.createNote('f2');
		expect(mockNotesStore.getNoteCount('f2')).toBe(1);
	});

	it('should update counts when a note is deleted (moved to trash)', () => {
		mockNotesStore.createNote('f1');
		const noteId = mockNotesStore.selectedNoteID!;

		expect(mockNotesStore.getNoteCount('f1')).toBe(1);
		expect(mockNotesStore.counts.trash).toBe(0);

		// Delete note
		mockNotesStore.deleteNote(noteId);

		expect(mockNotesStore.getNoteCount('f1')).toBe(0);
		expect(mockNotesStore.counts.trash).toBe(1);
	});

	it('should update counts when a note is restored from trash', () => {
		mockNotesStore.createNote('f1');
		const noteId = mockNotesStore.selectedNoteID!;
		mockNotesStore.deleteNote(noteId);

		expect(mockNotesStore.counts.trash).toBe(1);

		// Restore note
		mockNotesStore.restoreNote(noteId, 'f1');

		expect(mockNotesStore.getNoteCount('f1')).toBe(1);
		expect(mockNotesStore.counts.trash).toBe(0);
	});

	it('should maintain accurate counts for favorites', () => {
		mockNotesStore.createNote('f1');
		const noteId = mockNotesStore.selectedNoteID!;

		expect(mockNotesStore.counts.favorites).toBe(0);

		// Set favorite
		mockNotesStore.setFavorite(noteId, true);
		expect(mockNotesStore.counts.favorites).toBe(1);

		// Unfavorite
		mockNotesStore.setFavorite(noteId, false);
		expect(mockNotesStore.counts.favorites).toBe(0);
	});

	it('should decrease favorite count when a favorite note is deleted', () => {
		mockNotesStore.createNote('f1');
		const noteId = mockNotesStore.selectedNoteID!;
		mockNotesStore.setFavorite(noteId, true);

		expect(mockNotesStore.counts.favorites).toBe(1);

		mockNotesStore.deleteNote(noteId);

		expect(mockNotesStore.counts.favorites).toBe(0);
		expect(mockNotesStore.counts.trash).toBe(1);
	});
});

describe('NotesStore Count Reactivity (Regression Test)', () => {
    let mockFolderStore: FolderStore;
    let selectionStore: SelectionStore;
    let mockNotesStore: NotesStore;

	beforeEach(() => {
        mockFolderStore = new FolderStore();
        selectionStore = new SelectionStore(mockFolderStore);
        mockNotesStore = new NotesStore();

		(mockNotesStore as any).isInitialized = true;
	});

	it('should trigger reactivity when selectedNote changes', () => {
		let callCount = 0;
		const sn = () => {
			callCount++;
			return mockNotesStore.selectedNote;
		};

		// Initial track
		expect(sn()).toBeNull();
		expect(callCount).toBe(1);

		// Select a note via creation
		mockNotesStore.createNote('f1');
		const noteId = mockNotesStore.selectedNoteID!;
		
		expect(sn()?.id).toBe(noteId);
		expect(callCount).toBe(2);

		// Deselect
		mockNotesStore.selectNote(null);
		expect(sn()).toBeNull();
		expect(callCount).toBe(3);
	});

	it('should trigger reactivity when folderNoteCounts changes', () => {
		let callCount = 0;
		const dc = () => {
			callCount++;
			return mockNotesStore.getNoteCount('f1');
		};

		expect(dc()).toBe(0);
		expect(callCount).toBe(1);

		mockNotesStore.createNote('f1');

		expect(dc()).toBe(1);
		expect(callCount).toBe(2);
	});

	it('should trigger reactivity when favoriteCount changes', () => {
		let callCount = 0;
		const df = () => {
			callCount++;
			return mockNotesStore.counts.favorites;
		};

		expect(df()).toBe(0);
		expect(callCount).toBe(1);

		mockNotesStore.createNote('f1');
		const noteId = mockNotesStore.selectedNoteID!;
		mockNotesStore.setFavorite(noteId, true);

		expect(df()).toBe(1);
		expect(callCount).toBe(2);
	});

	it('should trigger reactivity when moving notes between folders', () => {
		mockNotesStore.createNote('f1');
		const noteId = mockNotesStore.selectedNoteID!;
		
		let f1Calls = 0;
		let f2Calls = 0;

		const f1Count = () => {
			f1Calls++;
			return mockNotesStore.getNoteCount('f1');
		};
		const f2Count = () => {
			f2Calls++;
			return mockNotesStore.getNoteCount('f2');
		};

		expect(f1Count()).toBe(1);
		expect(f2Count()).toBe(0);
		expect(f1Calls).toBe(1);
		expect(f2Calls).toBe(1);

		// Move note
		mockNotesStore.updateNote(noteId, { folderId: 'f2' });

		expect(f1Count()).toBe(0);
		expect(f2Count()).toBe(1);
		expect(f1Calls).toBe(2);
		expect(f2Calls).toBe(2);
	});
});
