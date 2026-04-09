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

	it('should return all notes when folderType is "all"', () => {
		const n1: NoteItem = { id: '1', folderId: 'f1', title: 'N1', content: '', updatedAt: '' };
		const n2: NoteItem = { id: '2', folderId: 'f2', title: 'N2', content: '', updatedAt: '' };
		notesStore.allNotes = [n1, n2];

		const notes = notesStore.getNotesForFolder('some-id', 'all');
		expect(notes.length).toBe(2);
		expect(notes.map(n => n.id)).toContain('1');
		expect(notes.map(n => n.id)).toContain('2');
	});

	it('should return correct note count for a folder', () => {
		const n1: NoteItem = { id: '1', folderId: 'f1', title: 'N1', content: '', updatedAt: '' };
		const n2: NoteItem = { id: '2', folderId: 'f1', title: 'N2', content: '', updatedAt: '' };
		const n3: NoteItem = { id: '3', folderId: 'f2', title: 'N3', content: '', updatedAt: '' };
		notesStore.allNotes = [n1, n2, n3];

		expect(notesStore.getNoteCountForFolder('f1')).toBe(2);
		expect(notesStore.getNoteCountForFolder('f2')).toBe(1);
		expect(notesStore.getNoteCountForFolder('f1', 'all')).toBe(3);
	});

	it('should update counts dynamically when notes are created, updated, or deleted', () => {
		// Initial state
		(notesStore as any).isInitialized = true;
		expect(notesStore.getNoteCountForFolder('f1')).toBe(0);
		expect(notesStore.getNoteCountForFolder('all', 'all')).toBe(0);

		// 1. Create note
		notesStore.createNote('f1');
		expect(notesStore.getNoteCountForFolder('f1')).toBe(1);
		expect(notesStore.getNoteCountForFolder('all', 'all')).toBe(1);

		// 2. Move note to another folder
		const noteId = notesStore.allNotes[0].id;
		notesStore.updateNote(noteId, { folderId: 'f2' });
		expect(notesStore.getNoteCountForFolder('f1')).toBe(0);
		expect(notesStore.getNoteCountForFolder('f2')).toBe(1);
		expect(notesStore.getNoteCountForFolder('all', 'all')).toBe(1);

		// 3. Delete note
		notesStore.deleteNote(noteId);
		expect(notesStore.getNoteCountForFolder('f2')).toBe(0);
		expect(notesStore.getNoteCountForFolder('all', 'all')).toBe(0);
	});

	it('should correctly handle notes with null folderIds', () => {
		const n1: NoteItem = { id: '1', folderId: null, title: 'Orphan', content: '', updatedAt: '' };
		const n2: NoteItem = { id: '2', folderId: 'some-folder', title: 'Folder Note', content: '', updatedAt: '' };
		notesStore.allNotes = [n1, n2];

		expect(notesStore.getNoteCountForFolder(null)).toBe(1);
		expect(notesStore.getNoteCountForFolder('all', 'all')).toBe(2);
		expect(notesStore.getNotesForFolder(null).length).toBe(1);
	});

	it('should fallback to default folder when creating a note in root or smart folder', () => {
		// Mock folder store to have a 'notes' folder
		const defaultFolder: FolderItem = { id: 'notes-folder', title: 'Notes', url: '#' };
		vi.spyOn(folderStore, 'getDefaultFolderId').mockReturnValue('notes-folder');
		vi.spyOn(folderStore, 'findItemById').mockImplementation((items, id) => {
			if (id === 'smart-all-id') return { id: 'smart-all-id', title: 'All', url: '#', type: 'all' };
			return null;
		});

		// Create note in root
		notesStore.createNote(null);
		expect(notesStore.allNotes[0].folderId).toBe('notes-folder');

		// Create note in 'all' folder
		notesStore.createNote('smart-all-id');
		expect(notesStore.allNotes[0].folderId).toBe('notes-folder');
	});

	it('should verify that allNotes snapshot includes new properties', () => {
		const n1: NoteItem = { id: '1', folderId: 'f1', title: 'T1', content: 'C1', updatedAt: '2025-01-01T00:00:00Z' };
		notesStore.allNotes = [n1];
		(notesStore as any).isInitialized = true;

		const snapshot = (notesStore as any).allNotes;
		expect(snapshot[0]).toHaveProperty('folderId', 'f1');
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
