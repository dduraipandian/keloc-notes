import { describe, it, expect, beforeEach, vi } from 'vitest';
import { notesStore, type NoteItem } from './notes.svelte';
import * as idbr from './idbr';
import { folderStore } from './folders.svelte';
import { SvelteMap } from 'svelte/reactivity';

// Mock IDBR module
vi.mock('./idbr', () => ({
	loadNotesState: vi.fn(),
	saveNotesState: vi.fn(),
	putNote: vi.fn(),
	getAllNotes: vi.fn(),
	putSetting: vi.fn(),
	getAllSettings: vi.fn(),
	initDB: vi.fn(),
	getDB: vi.fn()
}));

// Mock crypto.randomUUID
global.crypto.randomUUID = vi.fn(() => 'test-uuid' as any);

describe('NotesStore', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset store
		(notesStore as any).notes = new SvelteMap();
		(notesStore as any).folderNotes = new SvelteMap();
		(notesStore as any).selectedNoteID = null;
		(notesStore as any).isInitialized = false;
	});

	// Helper to add notes correctly for tests that don't use createNote
	const addNoteToStore = (note: NoteItem) => {
		notesStore.notes.set(note.id, $state(note));
		(notesStore as any).addToIndex(note.folderId, note.id);
	};

	it('should create a note for a folder', () => {
		(notesStore as any).isInitialized = true;
		notesStore.createNote('folder-1');

		expect(notesStore.notes.size).toBe(1);
		const note = notesStore.notes.get('test-uuid');
		expect(note?.folderId).toBe('folder-1');
		expect(notesStore.selectedNoteID).toBe('test-uuid');
		expect((notesStore as any).folderNotes.get('folder-1')).toContain('test-uuid');
		expect(idbr.putNote).toHaveBeenCalled();
	});

	it('should get notes for a specific folder sorted by date', () => {
		const n1: NoteItem = {
			id: '1',
			folderId: 'f1',
			title: 'Old',
			content: '',
			updatedAt: '2020-01-01T00:00:00Z'
		};
		const n2: NoteItem = {
			id: '2',
			folderId: 'f1',
			title: 'New',
			content: '',
			updatedAt: '2025-01-01T00:00:00Z'
		};
		
		addNoteToStore(n1);
		addNoteToStore(n2);

		const notes = notesStore.getNotesForFolder('f1');
		expect(notes.length).toBe(2);
		expect(notes[0].id).toBe('2'); // Newest first
		expect(notes[1].id).toBe('1');
	});

	it('should return correct note count for a folder using index', () => {
		addNoteToStore({ id: '1', folderId: 'f1' } as any);
		addNoteToStore({ id: '2', folderId: 'f1' } as any);
		addNoteToStore({ id: '3', folderId: 'f2' } as any);

		expect(notesStore.getNoteCountForFolder('f1')).toBe(2);
		expect(notesStore.getNoteCountForFolder('f2')).toBe(1);
		expect(notesStore.getNoteCountForFolder('f1', 'all')).toBe(3);
	});

	it('should correctly handle notes with null folderIds', () => {
		addNoteToStore({ id: '1', folderId: null, title: 'Orphan', content: '', updatedAt: '' } as any);
		addNoteToStore({ id: '2', folderId: 'some-folder', title: 'Folder Note', content: '', updatedAt: '' } as any);

		expect(notesStore.getNoteCountForFolder(null)).toBe(1);
		expect(notesStore.getNotesForFolder(null).length).toBe(1);
	});

	it('should update a note and refresh its updatedAt timestamp', () => {
		const note: NoteItem = {
			id: '1',
			folderId: 'f1',
			title: 'Test',
			content: '',
			updatedAt: '2020-01-01T00:00:00Z'
		};
		addNoteToStore(note);
		(notesStore as any).isInitialized = true;

		notesStore.updateNote('1', { title: 'Updated' });

		const updated = notesStore.notes.get('1');
		expect(updated?.title).toBe('Updated');
		expect(new Date(updated!.updatedAt).getTime()).toBeGreaterThan(
			new Date('2020-01-01T00:00:00Z').getTime()
		);
		expect(idbr.putNote).toHaveBeenCalled();
	});

	it('should delete a note and clear selection if deleted was active', () => {
		addNoteToStore({ id: '1', folderId: 'f1', title: 'Test', content: '', updatedAt: '' } as any);
		notesStore.selectedNoteID = '1';
		(notesStore as any).isInitialized = true;

		notesStore.deleteNote('1');

		expect(notesStore.notes.size).toBe(0);
		expect(notesStore.selectedNoteID).toBeNull();
	});

	describe('Index Management', () => {
		it('should update index when note is moved between folders', () => {
			const noteID = 'move-me';
			(notesStore as any).isInitialized = true;
			addNoteToStore({ id: noteID, folderId: 'f1', title: 'T' } as any);
			
			expect(notesStore.getNoteCountForFolder('f1')).toBe(1);
			expect(notesStore.getNoteCountForFolder('f2')).toBe(0);

			notesStore.updateNote(noteID, { folderId: 'f2' });

			expect(notesStore.getNoteCountForFolder('f1')).toBe(0);
			expect(notesStore.getNoteCountForFolder('f2')).toBe(1);
			expect((notesStore as any).folderNotes.get('f2')).toContain(noteID);
		});

		it('should remove note from index on delete', () => {
			addNoteToStore({ id: 'del-me', folderId: 'f1' } as any);
			expect(notesStore.getNoteCountForFolder('f1')).toBe(1);

			notesStore.deleteNote('del-me');

			expect(notesStore.getNoteCountForFolder('f1')).toBe(0);
			expect((notesStore as any).folderNotes.get('f1')?.length).toBe(0);
		});

		it('should use "root" key for notes with null folderId', () => {
			addNoteToStore({ id: 'orphan', folderId: null } as any);
			
			expect(notesStore.getNoteCountForFolder(null)).toBe(1);
			expect((notesStore as any).folderNotes.get('root')).toContain('orphan');
		});
	});

	describe('Persistence', () => {
		it('should rebuild index on init', async () => {
			const savedNotes = [
				{ id: '1', folderId: 'f1', title: 'N1' },
				{ id: '2', folderId: 'f1', title: 'N2' }
			];
			vi.mocked(idbr.getAllNotes).mockResolvedValue(savedNotes as any);
			vi.mocked(idbr.getAllSettings).mockResolvedValue({ selectedNoteID: '1' } as any);

			await notesStore.init();

			expect(notesStore.getNoteCountForFolder('f1')).toBe(2);
			expect((notesStore as any).folderNotes.get('f1')).toEqual(['1', '2']);
		});

		it('should save notes on createNote', async () => {
			(notesStore as any).isInitialized = true;
			notesStore.createNote('f1');
			expect(idbr.putNote).toHaveBeenCalled();
		});

		it('should save notes on updateNote', async () => {
			const note = { id: '1', folderId: 'f1', title: 'Test', content: '', updatedAt: '' };
			addNoteToStore(note);
			(notesStore as any).isInitialized = true;

			notesStore.updateNote('1', { content: 'New Content' });
			expect(idbr.putNote).toHaveBeenCalled();
		});

		it('should save selectedNoteID on selectNote', async () => {
			(notesStore as any).isInitialized = true;
			addNoteToStore({ id: '1', title: 'T' } as any);
			
			notesStore.selectNote('1');
			
			expect(notesStore.selectedNoteID).toBe('1');
			expect(idbr.putSetting).toHaveBeenCalledWith('selectedNoteID', '1');
		});
	});
});
