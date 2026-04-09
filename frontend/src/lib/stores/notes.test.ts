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
		(notesStore as any).selectedNoteID = null;
		(notesStore as any).isInitialized = false;
	});

	it('should create a note for a folder', () => {
		(notesStore as any).isInitialized = true;
		notesStore.createNote('folder-1');

		expect(notesStore.notes.size).toBe(1);
		const note = notesStore.notes.get('test-uuid');
		expect(note?.folderId).toBe('folder-1');
		expect(note?.title).toBe('Untitled Note');
		expect(notesStore.selectedNoteID).toBe('test-uuid');
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
		const n3: NoteItem = {
			id: '3',
			folderId: 'f2',
			title: 'Other',
			content: '',
			updatedAt: '2025-01-01T00:00:00Z'
		};

		notesStore.notes.set('1', n1);
		notesStore.notes.set('2', n2);
		notesStore.notes.set('3', n3);

		const notes = notesStore.getNotesForFolder('f1');
		expect(notes.length).toBe(2);
		expect(notes[0].id).toBe('2'); // Newest first
		expect(notes[1].id).toBe('1');
	});

	it('should return all notes when folderType is "all"', () => {
		const n1: NoteItem = { id: '1', folderId: 'f1', title: 'N1', content: '', updatedAt: '' };
		const n2: NoteItem = { id: '2', folderId: 'f2', title: 'N2', content: '', updatedAt: '' };
		notesStore.notes.set('1', n1);
		notesStore.notes.set('2', n2);

		const notes = notesStore.getNotesForFolder('some-id', 'all');
		expect(notes.length).toBe(2);
		expect(notes.map((n) => n.id)).toContain('1');
		expect(notes.map((n) => n.id)).toContain('2');
	});

	it('should return correct note count for a folder', () => {
		const n1: NoteItem = { id: '1', folderId: 'f1', title: 'N1', content: '', updatedAt: '' };
		const n2: NoteItem = { id: '2', folderId: 'f1', title: 'N2', content: '', updatedAt: '' };
		const n3: NoteItem = { id: '3', folderId: 'f2', title: 'N3', content: '', updatedAt: '' };
		notesStore.notes.set('1', n1);
		notesStore.notes.set('2', n2);
		notesStore.notes.set('3', n3);

		expect(notesStore.getNoteCountForFolder('f1')).toBe(2);
		expect(notesStore.getNoteCountForFolder('f2')).toBe(1);
		expect(notesStore.getNoteCountForFolder('f1', 'all')).toBe(3);
	});

	it('should correctly handle notes with null folderIds', () => {
		const n1: NoteItem = { id: '1', folderId: null, title: 'Orphan', content: '', updatedAt: '' };
		const n2: NoteItem = {
			id: '2',
			folderId: 'some-folder',
			title: 'Folder Note',
			content: '',
			updatedAt: ''
		};
		notesStore.notes.set('1', n1);
		notesStore.notes.set('2', n2);

		expect(notesStore.getNoteCountForFolder(null)).toBe(1);
		expect(notesStore.getNotesForFolder(null).length).toBe(1);
	});

	it('should fallback to default folder when creating a note in root or smart folder', () => {
		(notesStore as any).isInitialized = true;
		// Mock folder store to have a 'notes' folder
		vi.spyOn(folderStore, 'getDefaultFolderId').mockReturnValue('notes-folder');
		vi.spyOn(folderStore, 'findItemById').mockImplementation((id) => {
			if (id === 'smart-all-id') return { id: 'smart-all-id', title: 'All', url: '#', type: 'all' } as any;
			return null;
		});

		// Create note in root
		notesStore.createNote(null);
		expect(notesStore.notes.get('test-uuid')?.folderId).toBe('notes-folder');

		// Create note in 'all' folder
		notesStore.createNote('smart-all-id');
		expect(notesStore.notes.get('test-uuid')?.folderId).toBe('notes-folder');
	});

	it('should update a note and refresh its updatedAt timestamp', () => {
		const note: NoteItem = {
			id: '1',
			folderId: 'f1',
			title: 'Test',
			content: '',
			updatedAt: '2020-01-01T00:00:00Z'
		};
		notesStore.notes.set('1', note);
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
		notesStore.notes.set('1', { id: '1', folderId: 'f1', title: 'Test', content: '', updatedAt: '' });
		notesStore.selectedNoteID = '1';
		(notesStore as any).isInitialized = true;

		notesStore.deleteNote('1');

		expect(notesStore.notes.size).toBe(0);
		expect(notesStore.selectedNoteID).toBeNull();
	});

	describe('Persistence', () => {
		it('should load notes on init', async () => {
			const savedNotes = [{ id: '1', folderId: 'f1', title: 'Saved', content: '', updatedAt: '' }];
			vi.mocked(idbr.getAllNotes).mockResolvedValue(savedNotes as any);
			vi.mocked(idbr.getAllSettings).mockResolvedValue({
				selectedNoteID: '1',
				selectedFolderID: 'f1'
			});

			await notesStore.init();

			expect(notesStore.notes.has('1')).toBe(true);
			expect(notesStore.selectedNoteID).toBe('1');
		});

		it('should save notes on createNote', async () => {
			(notesStore as any).isInitialized = true;
			notesStore.createNote('f1');
			expect(idbr.putNote).toHaveBeenCalled();
		});

		it('should save notes on updateNote', async () => {
			const note = { id: '1', folderId: 'f1', title: 'Test', content: '', updatedAt: '' };
			notesStore.notes.set('1', note);
			(notesStore as any).isInitialized = true;

			notesStore.updateNote('1', { content: 'New Content' });
			expect(idbr.putNote).toHaveBeenCalled();
		});

		it('should save selectedNoteID on selectNote', async () => {
			(notesStore as any).isInitialized = true;
			notesStore.notes.set('1', { id: '1', title: 'T' } as any);
			
			notesStore.selectNote('1');
			
			expect(notesStore.selectedNoteID).toBe('1');
			expect(idbr.putSetting).toHaveBeenCalledWith('selectedNoteID', '1');
		});
	});
});
