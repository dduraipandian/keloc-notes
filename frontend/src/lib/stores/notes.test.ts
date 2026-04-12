import { describe, it, expect, beforeEach, vi } from 'vitest';
import { notesStore, type NoteItem } from './notes.svelte';
import { folderStore, type FolderItem } from './folders.svelte';
import { folderService, noteService, trashService } from './services';
import { SvelteMap } from 'svelte/reactivity';
import { notesRepository, settingsRepository } from './repositories';

// Mock IDBR module
vi.mock('./repositories', () => ({
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
	});

	// Helper to add notes correctly for tests that don't use createNote
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

	it('should correctly handle notes with null folderIds', () => {
		addNoteToStore({ id: '1', folderId: null });
		addNoteToStore({
			id: '2',
			folderId: 'some-folder'
		});

		expect(noteService.getNoteCountForFolder(null)).toBe(1);
		expect(noteService.getNotesForFolder(null).length).toBe(1);
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
		expect(notesRepository.save).toHaveBeenCalled();
	});

	it('should soft-delete a note (move to trash) and clear selection', () => {
		addNoteToStore({ id: '1', folderId: 'f1' });
		notesStore.selectedNoteID = '1';
		(notesStore as any).isInitialized = true;

		const stamp = 12345;
		notesStore.deleteNote('1', stamp);

		// Still in map and marked as deleted
		expect(notesStore.notes.get('1')?.deletedAt).toBe(stamp);
		// Selection cleared
		expect(notesStore.selectedNoteID).toBeNull();
		// Index updated semantically
		expect(noteService.getNoteCountForFolder('f1')).toBe(0);
		expect(noteService.getNoteCountForFolder('deleted-notes')).toBe(1);
		// Persistence called with properties
		expect(notesRepository.save).toHaveBeenCalledWith(expect.objectContaining({ deletedAt: stamp }));
		// Cleared selection must be persisted
		expect(settingsRepository.save).toHaveBeenCalledWith('selectedNoteID', null);
	});

	it('should recover a note from trash', () => {
		const note = {
			id: '1',
			folderId: 'f1',
			title: 'T',
			content: '',
			updatedAt: '',
			deletedAt: 123
		};
		addNoteToStore(note as any);
		(notesStore as any).isInitialized = true;

		vi.spyOn(folderStore, 'findItemById').mockReturnValue({ id: 'f1', deletedAt: null } as any);

		trashService.recoverNote('1');

		expect(notesStore.notes.get('1')?.deletedAt).toBeNull();
		expect(notesStore.notes.get('1')?.folderId).toBe('f1'); // Remains in f1 if f1 is active
		expect(folderStore.selectedFolderID).toBe('f1');
		expect(notesStore.selectedNoteID).toBe('1');
		expect(notesRepository.save).toHaveBeenCalledWith(expect.objectContaining({ deletedAt: null }));
	});

	it('should aggregate notes from sub-hierarchies in trash', () => {
		(notesStore as any).isInitialized = true;

		// Setup A (Deleted) -> B (Deleted) -> Note X
		const note: NoteItem = {
			id: 'note-x',
			folderId: 'B',
			title: 'X',
			content: '',
			updatedAt: '',
			deletedAt: 123
		};
		addNoteToStore(note);

		const b: FolderItem = {
			id: 'B',
			title: 'B',
			url: '#',
			parentId: 'A',
			items: [],
			deletedAt: 123
		};
		const a: FolderItem = {
			id: 'A',
			title: 'A',
			url: '#',
			parentId: null,
			items: ['B'],
			deletedAt: 123
		};

		vi.spyOn(folderStore, 'findItemById').mockImplementation((id) => {
			if (id === 'A') return a;
			if (id === 'B') return b;
			return null;
		});

		// Selecting parent A should find notes from child B
		const notes = noteService.getNotesForFolder('A');
		expect(notes).toContainEqual(expect.objectContaining({ id: 'note-x' }));
	});

	it('should support prompted recovery of note and folder hierarchy', () => {
		(notesStore as any).isInitialized = true;
		const epoch = 123;

		// Setup A (Deleted) -> Note X
		const note: NoteItem = {
			id: 'note-x',
			folderId: 'A',
			title: 'X',
			content: '',
			updatedAt: '',
			deletedAt: epoch
		};
		addNoteToStore(note);

		const a: FolderItem = {
			id: 'A',
			title: 'A',
			url: '#',
			parentId: null,
			items: [],
			deletedAt: epoch
		};
		vi.spyOn(folderStore, 'findItemById').mockReturnValue(a);
		vi.spyOn(folderService, 'findTopDeletedAncestor').mockReturnValue(a);
		const recoverSpy = vi.spyOn(trashService, 'recoverFolder');

		// Recover with folder
		trashService.recoverNote('note-x');

		expect(recoverSpy).toHaveBeenCalledWith('A');
		expect(notesStore.notes.get('note-x')?.deletedAt).toBeNull();
		expect(notesStore.notes.get('note-x')?.folderId).toBe('A');
		expect(folderStore.selectedFolderID).toBe('A');
		expect(notesStore.selectedNoteID).toBe('note-x');
	});

	it('should support prompted recovery of note alone (rooting it)', () => {
		(notesStore as any).isInitialized = true;
		const epoch = 123;

		// Setup A (Deleted) -> Note X
		const note: NoteItem = {
			id: 'note-x',
			folderId: 'A',
			title: 'X',
			content: '',
			updatedAt: '',
			deletedAt: epoch
		};
		addNoteToStore(note);

		const a: FolderItem = {
			id: 'A',
			title: 'A',
			url: '#',
			parentId: null,
			items: [],
			deletedAt: epoch
		};
		vi.spyOn(folderStore, 'findItemById').mockReturnValue(a);
		vi.spyOn((trashService as any).tree, 'findTopDeletedAncestor').mockReturnValue(null);

		// Recover note ONLY
		trashService.recoverNote('note-x');

		expect(notesStore.notes.get('note-x')?.deletedAt).toBeNull();
		expect(notesStore.notes.get('note-x')?.folderId).toBeNull(); // Ejected to root
		expect(folderStore.selectedFolderID).toBeNull();
		expect(notesStore.selectedNoteID).toBe('note-x');
	});

	it('should root the note if parent folder metadata is missing during recovery', () => {
		const note = { id: 'orphan', folderId: 'non-existent', deletedAt: 123 };
		addNoteToStore(note as any);
		(notesStore as any).isInitialized = true;

		// Mock folderStore to return null for this ID (missing from system)
		vi.spyOn(folderStore, 'findItemById').mockReturnValue(null);

		trashService.recoverNote('orphan');

		expect(notesStore.notes.get('orphan')?.deletedAt).toBeNull();
		expect(notesStore.notes.get('orphan')?.folderId).toBeNull();
		expect(folderStore.selectedFolderID).toBeNull();
		expect(notesStore.selectedNoteID).toBe('orphan');
	});

	it('should only recover notes in a folder that match the target batch epoch', () => {
		(notesStore as any).isInitialized = true;
		const epoch = 5000;
		const olderEpoch = 1000;

		// n1 was deleted in the same batch as the folder — should be recovered
		addNoteToStore({ id: 'n1', folderId: 'f1', deletedAt: epoch } as any);
		// n2 was deleted earlier independently — should stay deleted
		addNoteToStore({ id: 'n2', folderId: 'f1', deletedAt: olderEpoch } as any);

		notesStore.restoreNotesInFolder('f1', epoch);

		expect(notesStore.notes.get('n1')?.deletedAt).toBeNull();
		expect(notesStore.notes.get('n2')?.deletedAt).toBe(olderEpoch);
	});

	describe('Index Management', () => {
		it('should update index when note is moved between folders', () => {
			const noteID = 'move-me';
			(notesStore as any).isInitialized = true;
			addNoteToStore({ id: noteID, folderId: 'f1' });

			expect(noteService.getNoteCountForFolder('f1')).toBe(1);
			expect(noteService.getNoteCountForFolder('f2')).toBe(0);

			notesStore.updateNote(noteID, { folderId: 'f2' });

			expect(noteService.getNoteCountForFolder('f1')).toBe(0);
			expect(noteService.getNoteCountForFolder('f2')).toBe(1);
		});

		it('should hide soft deleted notes entirely without breaking structural index', () => {
			addNoteToStore({ id: 'del-me', folderId: 'f1' });
			expect(noteService.getNoteCountForFolder('f1')).toBe(1);

			notesStore.deleteNote('del-me');

			expect(noteService.getNoteCountForFolder('f1')).toBe(0);
		});

		it('should redirect createNote to default folder if trash is selected', () => {
			(notesStore as any).isInitialized = true;
			// Mock trash folder
			vi.spyOn(folderStore, 'findItemById').mockReturnValue({
				id: 'deleted-notes',
				type: 'trash'
			} as any);
			vi.spyOn(folderStore, 'getDefaultFolderId').mockReturnValue('default-folder');

			noteService.create('deleted-notes');

			const note = notesStore.notes.get('test-uuid');
			expect(note?.folderId).toBe('default-folder');
			expect(noteService.getNoteCountForFolder('default-folder')).toBe(1);
			expect(noteService.getNoteCountForFolder('deleted-notes')).toBe(0);
		});

		it('should recover a note back to its original specific folder logically', () => {
			const note = { id: 'orig', folderId: 'special-folder', deletedAt: 999, updatedAt: '' };
			addNoteToStore(note as any);
			(notesStore as any).isInitialized = true;

			vi.spyOn(folderStore, 'findItemById').mockReturnValue({ id: 'special-folder', deletedAt: null } as any);

			trashService.recoverNote('orig');

			expect(noteService.getNoteCountForFolder('deleted-notes')).toBe(0);
			expect(noteService.getNoteCountForFolder('special-folder')).toBe(1);
			expect(notesStore.notes.get('orig')?.deletedAt).toBeNull();
			expect(folderStore.selectedFolderID).toBe('special-folder');
			expect(notesStore.selectedNoteID).toBe('orig');
		});

		it('should use "root" key for notes with null folderId', () => {
			addNoteToStore({ id: 'orphan', folderId: null });

			expect(noteService.getNoteCountForFolder(null)).toBe(1);
		});
	});

	describe('Persistence', () => {
		it('should rebuild index on init and globally unified index notes regardless of deleted status', async () => {
			const savedNotes = [
				{ id: '1', folderId: 'f1', title: 'Active' },
				{ id: '2', folderId: 'f1', title: 'Deleted', deletedAt: 444 }
			];
			vi.mocked(notesRepository.list).mockResolvedValue(savedNotes as any);
			vi.mocked(settingsRepository.getAll).mockResolvedValue({ selectedNoteID: '1' } as any);

			await notesStore.init();

			expect(noteService.getNoteCountForFolder('f1')).toBe(1);
			expect(noteService.getNoteCountForFolder('deleted-notes')).toBe(1);
		});

		it('should save notes on createNote', async () => {
			(notesStore as any).isInitialized = true;
			notesStore.createNote('f1');
			expect(notesRepository.save).toHaveBeenCalled();
		});

		it('should save selectedNoteID on selectNote', async () => {
			(notesStore as any).isInitialized = true;
			addNoteToStore({ id: '1' });

			notesStore.selectNote('1');

			expect(notesStore.selectedNoteID).toBe('1');
			expect(settingsRepository.save).toHaveBeenCalledWith('selectedNoteID', '1');
		});

		it('should persist null selectedNoteID when deselecting', async () => {
			(notesStore as any).isInitialized = true;
			addNoteToStore({ id: '1' });
			notesStore.selectNote('1');
			vi.clearAllMocks();

			notesStore.selectNote(null);

			expect(notesStore.selectedNoteID).toBeNull();
			expect(settingsRepository.save).toHaveBeenCalledWith('selectedNoteID', null);
		});

		it('should persist null selectedNoteID when deleting notes in a folder', () => {
			(notesStore as any).isInitialized = true;
			addNoteToStore({ id: 'n1', folderId: 'f1' });
			addNoteToStore({ id: 'n2', folderId: 'f1' });
			addNoteToStore({ id: 'n3', folderId: 'f2' });
			notesStore.selectedNoteID = 'n1';

			notesStore.deleteNotesInFolder('f1', 9999);

			expect(notesStore.notes.get('n1')?.deletedAt).toBe(9999);
			expect(notesStore.notes.get('n2')?.deletedAt).toBe(9999);
			expect(notesStore.notes.get('n3')?.deletedAt).toBeNull(); // sibling folder untouched
			expect(notesStore.selectedNoteID).toBeNull();
			expect(settingsRepository.save).toHaveBeenCalledWith('selectedNoteID', null);
		});
	});
});
