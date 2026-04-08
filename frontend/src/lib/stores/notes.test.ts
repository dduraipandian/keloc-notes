import { describe, it, expect, beforeEach, vi } from 'vitest';
import { notesStore, type NoteItem } from './notes.svelte';
import * as idb from './idb';

// Mock IDB module
vi.mock('./idb', () => ({
	loadNotesState: vi.fn(),
	saveNotesState: vi.fn(),
	initDB: vi.fn(),
	getDB: vi.fn()
}));

// Mock crypto.randomUUID
global.crypto.randomUUID = vi.fn(() => 'test-uuid' as any);

describe('NotesStore', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset store
		(notesStore as any).allNotes = [];
		(notesStore as any).selectedNoteId = null;
		(notesStore as any).isInitialized = false;
	});

	it('should create a note for a folder', () => {
		notesStore.createNote('folder-1');

		expect(notesStore.allNotes.length).toBe(1);
		expect(notesStore.allNotes[0].folderId).toBe('folder-1');
		expect(notesStore.allNotes[0].title).toBe('Untitled Note');
		expect(notesStore.selectedNoteId).toBe('test-uuid');
	});

	it('should get notes for a specific folder sorted by date', () => {
		const n1: NoteItem = { id: '1', folderId: 'f1', title: 'Old', content: '', updatedAt: '2020-01-01T00:00:00Z' };
		const n2: NoteItem = { id: '2', folderId: 'f1', title: 'New', content: '', updatedAt: '2025-01-01T00:00:00Z' };
		const n3: NoteItem = { id: '3', folderId: 'f2', title: 'Other', content: '', updatedAt: '2025-01-01T00:00:00Z' };
		
		notesStore.allNotes = [n1, n2, n3];

		const notes = notesStore.getNotesForFolder('f1');
		expect(notes.length).toBe(2);
		expect(notes[0].id).toBe('2'); // Newest first
		expect(notes[1].id).toBe('1');
	});

	it('should update a note and refresh its updatedAt timestamp', () => {
		const note: NoteItem = { id: '1', folderId: 'f1', title: 'Test', content: '', updatedAt: '2020-01-01T00:00:00Z' };
		notesStore.allNotes = [note];
		(notesStore as any).isInitialized = true;

		notesStore.updateNote('1', { title: 'Updated' });

		expect(notesStore.allNotes[0].title).toBe('Updated');
		expect(new Date(notesStore.allNotes[0].updatedAt).getTime()).toBeGreaterThan(new Date('2020-01-01T00:00:00Z').getTime());
	});

	it('should delete a note and clear selection if deleted was active', () => {
		notesStore.allNotes = [{ id: '1', folderId: 'f1', title: 'Test', content: '', updatedAt: '' }];
		notesStore.selectedNoteId = '1';
		(notesStore as any).isInitialized = true;

		notesStore.deleteNote('1');

		expect(notesStore.allNotes.length).toBe(0);
		expect(notesStore.selectedNoteId).toBeNull();
	});

	describe('Persistence', () => {
		it('should load notes on init', async () => {
			const savedNotes = [{ id: '1', folderId: 'f1', title: 'Saved', content: '', updatedAt: '' }];
			vi.mocked(idb.loadNotesState).mockResolvedValue({
				notes: savedNotes,
				selectedNoteId: '1'
			});

			await notesStore.init();

			expect(notesStore.allNotes).toEqual(savedNotes);
			expect(notesStore.selectedNoteId).toBe('1');
		});

		it('should save notes on createNote', async () => {
			(notesStore as any).isInitialized = true;
			notesStore.createNote('f1');
			expect(idb.saveNotesState).toHaveBeenCalled();
		});

		it('should save notes on updateNote', async () => {
			const note = { id: '1', folderId: 'f1', title: 'Test', content: '', updatedAt: '' };
			notesStore.allNotes = [note];
			(notesStore as any).isInitialized = true;
			
			notesStore.updateNote('1', { content: 'New Content' });
			expect(idb.saveNotesState).toHaveBeenCalled();
		});
	});
});
