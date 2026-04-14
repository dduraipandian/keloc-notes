import { describe, it, expect, beforeEach, vi } from 'vitest';
import { notesStore, type NoteItem } from '../../src/lib/stores/notes.svelte';
import { folderStore } from '../../src/lib/stores/folders.svelte';
import { SvelteMap } from 'svelte/reactivity';

// Mock repositories
vi.mock('../../src/lib/stores/repositories', () => ({
	foldersRepository: { list: vi.fn(), save: vi.fn() },
	notesRepository: { list: vi.fn(), save: vi.fn() },
	settingsRepository: { getAll: vi.fn(), save: vi.fn() }
}));

// Mock crypto.randomUUID to be unique for tests
let uuidCounter = 0;
global.crypto.randomUUID = vi.fn(() => `test-uuid-${uuidCounter++}` as any);

describe('NotesStore Note Counts (Performance Optimization)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset store state
		(notesStore as any).notes = new SvelteMap<string, NoteItem>();
		(notesStore as any).isInitialized = true;
		(notesStore as any).counts = {
			byFolder: new SvelteMap<string | null, number>(),
			favorites: 0,
			trash: 0
		};
		
		// Reset folder store if needed
		(folderStore as any).folders = new SvelteMap();
		(folderStore as any).isInitialized = true;
	});

	it('should maintain accurate counts for notes in folders', () => {
		// Initial state
		// @ts-ignore - counts will be added later
		expect(notesStore.counts.byFolder.get('f1')).toBeUndefined();

		// Create a note in folder f1
		notesStore.createNote('f1');
		
		// Verification (Expected to fail until implemented)
		// @ts-ignore
		expect(notesStore.counts.byFolder.get('f1')).toBe(1);

		// Create another note in f1
		notesStore.createNote('f1');
		// @ts-ignore
		expect(notesStore.counts.byFolder.get('f1')).toBe(2);

		// Create a note in f2
		notesStore.createNote('f2');
		// @ts-ignore
		expect(notesStore.counts.byFolder.get('f2')).toBe(1);
	});

	it('should update counts when a note is deleted (moved to trash)', () => {
		notesStore.createNote('f1'); // note id will be 'test-uuid' because of crypto mock or actual random
		const noteId = Array.from(notesStore.notes.keys())[0];

		// Initial verification
		// @ts-ignore
		expect(notesStore.counts.byFolder.get('f1')).toBe(1);
		// @ts-ignore
		expect(notesStore.counts.trash).toBe(0);

		// Delete note
		notesStore.deleteNote(noteId);

		// Folder count should decrease, trash count should increase
		// @ts-ignore
		expect(notesStore.counts.byFolder.get('f1')).toBe(0);
		// @ts-ignore
		expect(notesStore.counts.trash).toBe(1);
	});

	it('should update counts when a note is restored from trash', () => {
		notesStore.createNote('f1');
		const noteId = Array.from(notesStore.notes.keys())[0];
		notesStore.deleteNote(noteId);

		// Restore note
		notesStore.restoreNote(noteId, 'f1');

		// @ts-ignore
		expect(notesStore.counts.byFolder.get('f1')).toBe(1);
		// @ts-ignore
		expect(notesStore.counts.trash).toBe(0);
	});

	it('should maintain accurate counts for favorites', () => {
		notesStore.createNote('f1');
		const noteId = Array.from(notesStore.notes.keys())[0];

		// @ts-ignore
		expect(notesStore.counts.favorites).toBe(0);

		// Set favorite
		notesStore.setFavorite(noteId, true);
		// @ts-ignore
		expect(notesStore.counts.favorites).toBe(1);

		// Unfavorite
		notesStore.setFavorite(noteId, false);
		// @ts-ignore
		expect(notesStore.counts.favorites).toBe(0);
	});

	it('should decrease favorite count when a favorite note is deleted', () => {
		notesStore.createNote('f1');
		const noteId = Array.from(notesStore.notes.keys())[0];
		notesStore.setFavorite(noteId, true);

		// @ts-ignore
		expect(notesStore.counts.favorites).toBe(1);

		// Delete favorite note
		notesStore.deleteNote(noteId);

		// It's in trash, so it's no longer an "active" favorite
		// @ts-ignore
		expect(notesStore.counts.favorites).toBe(0);
	});
});
