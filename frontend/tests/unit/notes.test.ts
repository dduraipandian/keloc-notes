import { describe, it, expect, beforeEach, vi } from 'vitest';
import { notesStore, type NoteItem } from '../../src/lib/stores/notes.svelte';
import { folderStore, type FolderItem } from '../../src/lib/stores/folders.svelte';
import { folderService, noteService, trashService } from '../../src/lib/stores/services';
import { selectionStore } from '../../src/lib/stores/selection.svelte';
import { SvelteMap } from 'svelte/reactivity';
import { notesRepository, settingsRepository } from '../../src/lib/stores/repositories';

// Mock IDBR module
vi.mock('../../src/lib/stores/repositories', () => ({
	foldersRepository: {
		list: vi.fn(),
		save: vi.fn()
	},
	notesRepository: {
		list: vi.fn(),
		save: vi.fn()
	},
	settingsRepository: {
		getAll: vi.fn(),
		save: vi.fn()
	},
	trashRepository: {
		permanentlyDeleteFolderTree: vi.fn(),
		permanentlyDeleteNote: vi.fn()
	}
}));

// Mock crypto.randomUUID
global.crypto.randomUUID = vi.fn(() => 'test-uuid' as any);

describe('NotesStore', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();
		// Reset stores
		(notesStore as any).notes = new SvelteMap();
		(notesStore as any).selectedNoteID = null;
		(notesStore as any).isInitialized = false;

		// Clear singleton FolderStore to prevent cross-test pollution
		(folderStore as any).items = [];
		(folderStore as any).folders = new SvelteMap();
		(folderStore as any).isInitialized = false;
		selectionStore.__resetForTest();
	});

	const addNoteToStore = (note: Partial<NoteItem> & { id: string }) => {
		const fullNote: NoteItem = {
			folderId: null,
			title: 'Untitled',
			content: '',
			updatedAt: new Date().toISOString(),
			deletedAt: null,
			...note
		};
		notesStore.notes.set(fullNote.id, fullNote);
	};

	it('should create a note for a folder', () => {
		(notesStore as any).isInitialized = true;
		notesStore.createNote('folder-1');

		expect(notesStore.notes.size).toBe(1);
		const note = notesStore.notes.get('test-uuid');
		expect(note?.folderId).toBe('folder-1');
		expect(notesStore.selectedNoteID).toBe('test-uuid');
		expect(notesRepository.save).toHaveBeenCalled();
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

		const notes = noteService.getNotesForFolder('f1');
		expect(notes.length).toBe(2);
		expect(notes[0].id).toBe('2'); // Newest first
		expect(notes[1].id).toBe('1');
	});

	it('should correctly handle notes in root (home view)', () => {
		addNoteToStore({ id: '1', folderId: null });
		addNoteToStore({ id: '2', folderId: 'some-folder' });

		// home view shows notes with folderId: null
		expect(noteService.getNoteCountForFolder(null, 'home')).toBe(1);
		expect(noteService.getNotesForFolder(null, 'home').length).toBe(1);
	});

	it('should soft-delete a note and reflect in Recently Deleted', () => {
		addNoteToStore({ id: '1', folderId: 'f1' });
		notesStore.selectedNoteID = '1';
		(notesStore as any).isInitialized = true;

		const stamp = 12345;
		notesStore.deleteNote('1', stamp);

		expect(notesStore.notes.get('1')?.deletedAt).toBe(stamp);
		expect(noteService.getNoteCountForFolder('f1')).toBe(0);
		expect(noteService.getNoteCountForFolder('deleted-notes', 'trash')).toBe(1);
	});

	it('should recover a note from trash and return it to its folder', () => {
		const note = { id: '1', folderId: 'f1', deletedAt: 123 };
		addNoteToStore(note as any);
		(notesStore as any).isInitialized = true;
		vi.spyOn(folderStore, 'findItemById').mockReturnValue({ id: 'f1', deletedAt: null, kind: 'regular' } as any);

		trashService.recoverNote('1');

		expect(notesStore.notes.get('1')?.deletedAt).toBeNull();
		expect(selectionStore.selectedFolderID).toBe('f1');
	});

	it('should redirect createNote to default folder if trash is selected', () => {
		(notesStore as any).isInitialized = true;
		vi.spyOn(folderStore, 'findItemById').mockReturnValue({ id: 'deleted-notes', kind: 'trash' } as any);
		vi.spyOn(folderStore, 'getDefaultFolderId').mockReturnValue('default');

		noteService.create('deleted-notes');

		expect(notesStore.notes.get('test-uuid')?.folderId).toBe('default');
	});

	it('should allow creating a note in the Home view', () => {
		(notesStore as any).isInitialized = true;
		vi.spyOn(folderStore, 'findItemById').mockReturnValue({ id: 'home', kind: 'home' } as any);
		
		noteService.create('home');

		expect(notesStore.notes.get('test-uuid')?.folderId).toBe('home');
	});
});
