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
		const ns = $state(note);
		notesStore.notes.set(note.id, ns);
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

	it('should correctly handle notes with null folderIds', () => {
		addNoteToStore({ id: '1', folderId: null, title: 'Orphan', content: '', updatedAt: '' } as any);
		addNoteToStore({
			id: '2',
			folderId: 'some-folder',
			title: 'Folder Note',
			content: '',
			updatedAt: ''
		} as any);

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

	it('should soft-delete a note (move to trash) and clear selection', () => {
		addNoteToStore({ id: '1', folderId: 'f1', title: 'T', content: '', updatedAt: '' } as any);
		notesStore.selectedNoteID = '1';
		(notesStore as any).isInitialized = true;

		notesStore.deleteNote('1');

		// Still in map and marked as deleted
		expect(notesStore.notes.get('1')?._deleted).toBe(true);
		// Selection cleared
		expect(notesStore.selectedNoteID).toBeNull();
		// Index updated
		expect(notesStore.getNoteCountForFolder('f1')).toBe(0);
		expect(notesStore.getNoteCountForFolder('deleted-notes')).toBe(1);
		// Persistence called with true
		expect(idbr.putNote).toHaveBeenCalledWith(expect.objectContaining({ _deleted: true }));
	});

	it('should recover a note from trash', () => {
		const note = {
			id: '1',
			folderId: 'f1',
			title: 'T',
			content: '',
			updatedAt: '',
			_deleted: true
		};
		addNoteToStore(note as any);
		// Manually move to trash index for setup
		(notesStore as any).removeFromIndex('f1', '1');
		(notesStore as any).addToIndex('deleted-notes', '1');
		(notesStore as any).isInitialized = true;

		notesStore.recoverNote('1');

		expect(notesStore.notes.get('1')?._deleted).toBe(false);
		expect(notesStore.getNoteCountForFolder('deleted-notes')).toBe(0);
		expect(notesStore.getNoteCountForFolder('f1')).toBe(1);
		expect(idbr.putNote).toHaveBeenCalledWith(expect.objectContaining({ _deleted: false }));
	});

	describe('Index Management', () => {
		it('should update index when note is moved between folders', () => {
			const noteID = 'move-me';
			(notesStore as any).isInitialized = true;
			addNoteToStore({ id: noteID, folderId: 'f1', title: 'T', content: '', updatedAt: '' });

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

		it('should redirect createNote to default folder if trash is selected', () => {
			(notesStore as any).isInitialized = true;
			// Mock trash folder
			vi.spyOn(folderStore, 'findItemById').mockReturnValue({
				id: 'deleted-notes',
				type: 'trash'
			} as any);
			vi.spyOn(folderStore, 'getDefaultFolderId').mockReturnValue('default-folder');

			notesStore.createNote('deleted-notes');

			const note = notesStore.notes.get('test-uuid');
			expect(note?.folderId).toBe('default-folder');
			expect(notesStore.getNoteCountForFolder('default-folder')).toBe(1);
			expect(notesStore.getNoteCountForFolder('deleted-notes')).toBe(0);
		});

		it('should recover a note back to its original specific folder', () => {
			const note = { id: 'orig', folderId: 'special-folder', _deleted: true, updatedAt: '' };
			addNoteToStore(note as any);
			// Manually move to trash index for setup
			(notesStore as any).removeFromIndex('special-folder', 'orig');
			(notesStore as any).addToIndex('deleted-notes', 'orig');
			(notesStore as any).isInitialized = true;

			notesStore.recoverNote('orig');

			expect(notesStore.getNoteCountForFolder('deleted-notes')).toBe(0);
			expect(notesStore.getNoteCountForFolder('special-folder')).toBe(1);
			expect(notesStore.notes.get('orig')?.folderId).toBe('special-folder');
		});

		it('should use "root" key for notes with null folderId', () => {
			addNoteToStore({ id: 'orphan', folderId: null } as any);

			expect(notesStore.getNoteCountForFolder(null)).toBe(1);
			expect((notesStore as any).folderNotes.get('root')).toContain('orphan');
		});
	});

	describe('Persistence', () => {
		it('should rebuild index on init and partition deleted notes', async () => {
			const savedNotes = [
				{ id: '1', folderId: 'f1', title: 'Active' },
				{ id: '2', folderId: 'f1', title: 'Deleted', _deleted: true }
			];
			vi.mocked(idbr.getAllNotes).mockResolvedValue(savedNotes as any);
			vi.mocked(idbr.getAllSettings).mockResolvedValue({ selectedNoteID: '1' } as any);

			await notesStore.init();

			expect(notesStore.getNoteCountForFolder('f1')).toBe(1);
			expect(notesStore.getNoteCountForFolder('deleted-notes')).toBe(1);
			expect((notesStore as any).folderNotes.get('f1')).toEqual(['1']);
			expect((notesStore as any).folderNotes.get('deleted-notes')).toEqual(['2']);
		});

		it('should save notes on createNote', async () => {
			(notesStore as any).isInitialized = true;
			notesStore.createNote('f1');
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
