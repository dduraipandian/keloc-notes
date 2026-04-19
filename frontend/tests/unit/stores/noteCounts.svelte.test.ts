import { describe, it, expect, beforeEach, vi } from 'vitest';
import { notesStore, type NoteItem } from '../../../src/lib/stores/notes.svelte';
import { folderStore } from '../../../src/lib/stores/folders.svelte';
import { SvelteMap } from 'svelte/reactivity';

// Mock repositories
vi.mock('../../../src/lib/stores/repositories', () => ({
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
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset store state
		(notesStore as any).notes.clear();
		(notesStore as any).isInitialized = true;
		(notesStore as any).folderNoteCounts = {};
		(notesStore as any).favoriteCount = 0;
		(notesStore as any).trashCount = 0;
		(notesStore as any).selectedNoteID = null;
		
		// Reset folder store if needed
		(folderStore as any).folders = new SvelteMap();
		(folderStore as any).isInitialized = true;
	});

	it('should maintain accurate counts for notes in folders', () => {
		expect(notesStore.getNoteCount('f1')).toBe(0);

		// Create a note in folder f1
		notesStore.createNote('f1');
		expect(notesStore.getNoteCount('f1')).toBe(1);

		// Create another note in f1
		notesStore.createNote('f1');
		expect(notesStore.getNoteCount('f1')).toBe(2);

		// Create a note in f2
		notesStore.createNote('f2');
		expect(notesStore.getNoteCount('f2')).toBe(1);
	});

	it('should update counts when a note is deleted (moved to trash)', () => {
		notesStore.createNote('f1');
		const noteId = notesStore.selectedNoteID!;

		expect(notesStore.getNoteCount('f1')).toBe(1);
		expect(notesStore.counts.trash).toBe(0);

		// Delete note
		notesStore.deleteNote(noteId);

		expect(notesStore.getNoteCount('f1')).toBe(0);
		expect(notesStore.counts.trash).toBe(1);
	});

	it('should update counts when a note is restored from trash', () => {
		notesStore.createNote('f1');
		const noteId = notesStore.selectedNoteID!;
		notesStore.deleteNote(noteId);

		expect(notesStore.counts.trash).toBe(1);

		// Restore note
		notesStore.restoreNote(noteId, 'f1');

		expect(notesStore.getNoteCount('f1')).toBe(1);
		expect(notesStore.counts.trash).toBe(0);
	});

	it('should maintain accurate counts for favorites', () => {
		notesStore.createNote('f1');
		const noteId = notesStore.selectedNoteID!;

		expect(notesStore.counts.favorites).toBe(0);

		// Set favorite
		notesStore.setFavorite(noteId, true);
		expect(notesStore.counts.favorites).toBe(1);

		// Unfavorite
		notesStore.setFavorite(noteId, false);
		expect(notesStore.counts.favorites).toBe(0);
	});

	it('should decrease favorite count when a favorite note is deleted', () => {
		notesStore.createNote('f1');
		const noteId = notesStore.selectedNoteID!;
		notesStore.setFavorite(noteId, true);

		expect(notesStore.counts.favorites).toBe(1);

		notesStore.deleteNote(noteId);

		expect(notesStore.counts.favorites).toBe(0);
		expect(notesStore.counts.trash).toBe(1);
	});
});

describe('NotesStore Count Reactivity (Regression Test)', () => {
	beforeEach(() => {
		(notesStore as any).folderNoteCounts = {};
		(notesStore as any).favoriteCount = 0;
		(notesStore as any).trashCount = 0;
		(notesStore as any).selectedNoteID = null;
		(notesStore as any).notes.clear();
	});

	it('should trigger reactivity when selectedNote changes', () => {
		let callCount = 0;
		const sn = $derived.by(() => {
			callCount++;
			return notesStore.selectedNote;
		});

		// Initial track
		expect(sn).toBeNull();
		expect(callCount).toBe(1);

		// Select a note via creation
		notesStore.createNote('f1');
		const noteId = notesStore.selectedNoteID!;
		
		expect(sn?.id).toBe(noteId);
		expect(callCount).toBe(2);

		// Deselect
		notesStore.selectNote(null);
		expect(sn).toBeNull();
		expect(callCount).toBe(3);
	});

	it('should trigger reactivity when folderNoteCounts changes', () => {
		let callCount = 0;
		const dc = $derived.by(() => {
			callCount++;
			return notesStore.getNoteCount('f1');
		});

		expect(dc).toBe(0);
		expect(callCount).toBe(1);

		notesStore.createNote('f1');

		expect(dc).toBe(1);
		expect(callCount).toBe(2);
	});

	it('should trigger reactivity when favoriteCount changes', () => {
		let callCount = 0;
		const df = $derived.by(() => {
			callCount++;
			return notesStore.counts.favorites;
		});

		expect(df).toBe(0);
		expect(callCount).toBe(1);

		notesStore.createNote('f1');
		const noteId = notesStore.selectedNoteID!;
		notesStore.setFavorite(noteId, true);

		expect(df).toBe(1);
		expect(callCount).toBe(2);
	});

	it('should trigger reactivity when moving notes between folders', () => {
		notesStore.createNote('f1');
		const noteId = notesStore.selectedNoteID!;
		
		let f1Calls = 0;
		let f2Calls = 0;

		const f1Count = $derived.by(() => {
			f1Calls++;
			return notesStore.getNoteCount('f1');
		});
		const f2Count = $derived.by(() => {
			f2Calls++;
			return notesStore.getNoteCount('f2');
		});

		expect(f1Count).toBe(1);
		expect(f2Count).toBe(0);
		expect(f1Calls).toBe(1);
		expect(f2Calls).toBe(1);

		// Move note
		notesStore.updateNote(noteId, { folderId: 'f2' });

		expect(f1Count).toBe(0);
		expect(f2Count).toBe(1);
		expect(f1Calls).toBe(2);
		expect(f2Calls).toBe(2);
	});
});
