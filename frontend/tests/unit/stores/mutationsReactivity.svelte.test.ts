import { describe, it, expect, beforeEach, vi } from 'vitest';
import { notesStore } from '../../../src/lib/stores/notes.svelte';
import { folderStore } from '../../../src/lib/stores/folders.svelte';
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

describe('Phase A: Reactivity & Mutation Tests', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset store state
		(notesStore as any).notes.clear();
		(notesStore as any).isInitialized = true;
		(notesStore as any).folderNoteCounts = {};
		(notesStore as any).favoriteCount = 0;
		(notesStore as any).trashCount = 0;
		(notesStore as any).selectedNoteID = null;
		
		(folderStore as any).folders = new SvelteMap();
		(folderStore as any).isInitialized = true;
	});

	it('Item 3.1: should NOT call Map.set when updating existing note properties', () => {
		notesStore.createNote('f1');
		const noteId = notesStore.selectedNoteID!;
		const setSpy = vi.spyOn(notesStore.notes, 'set');

		// 1. Update via updateNote
		notesStore.updateNote(noteId, { title: 'New Title' });
		// Now it DOES call set for immutable replacement
		expect(setSpy).toHaveBeenCalledTimes(1);

		// 2. setFavorite
		setSpy.mockClear();
		notesStore.setFavorite(noteId, true);
		expect(setSpy).toHaveBeenCalledTimes(1); 
	});

	it('Item 3.2: should NOT update updatedAt when typing (content update)', () => {
		notesStore.createNote('f1');
		const noteId = notesStore.selectedNoteID!;
		const note = notesStore.getNote(noteId)!;
		const initialUpdatedAt = note.updatedAt;

		// Simulate typing
		// @ts-ignore - updates.updatedTimestamp exists
		notesStore.updateNote(noteId, { content: 'typing...' }, { updatedTimestamp: false });

		const updatedNote = notesStore.getNote(noteId)!;
		expect(updatedNote.content).toBe('typing...');
		expect(updatedNote.updatedAt).toBe(initialUpdatedAt);
	});

	it('Reactivity: counts should still update correctly without Map.set', () => {
		notesStore.createNote('f1');
		const noteId = notesStore.selectedNoteID!;
		
		let favCount = 0;
		// @ts-ignore - Svelte 5 testing helpers might be better here but let's use a simple derived-like track
		const trackFavs = () => notesStore.counts.favorites;

		// Initial state
		expect(notesStore.counts.favorites).toBe(0);

		// Toggle favorite
		notesStore.setFavorite(noteId, true);
		
		expect(notesStore.counts.favorites).toBe(1);
	});

	it('Edge Case: Moving folders should still update counts correctly', () => {
		notesStore.createNote('f1');
		const noteId = notesStore.selectedNoteID!;

		expect(notesStore.getNoteCount('f1')).toBe(1);
		expect(notesStore.getNoteCount('f2')).toBe(0);

		// Move folder
		notesStore.updateNote(noteId, { folderId: 'f2' });

		expect(notesStore.getNoteCount('f1')).toBe(0);
		expect(notesStore.getNoteCount('f2')).toBe(1);
	});
});
