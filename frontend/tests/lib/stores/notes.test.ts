import { describe, it, expect, beforeEach, vi } from 'vitest';
import { notesStore, type NoteItem } from '$lib/stores/notes.svelte';
import { folderStore, type FolderItem } from '$lib/stores/folders.svelte';
import { folderService, noteService, trashService } from '$lib/stores/services';
import { selectionStore } from '$lib/stores/selection.svelte';
import { SvelteMap } from 'svelte/reactivity';
import { notesRepository, settingsRepository } from '$lib/stores/repositories';
import { PROTECTED_NOTES_FOLDER_ID } from '$lib/stores/sources/constants';

// Mock IDBR module
vi.mock('$lib/stores/repositories', () => ({
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
		folderStore.folders.set('folder-1', { id: 'folder-1', title: 'Folder', url: '#' });
		notesStore.createNote('folder-1');

		expect(notesStore.notes.size).toBe(1);
		const note = notesStore.notes.get('test-uuid');
		expect(note?.folderId).toBe('folder-1');
		expect(notesStore.selectedNoteID).toBe('test-uuid');
		expect(notesRepository.save).toHaveBeenCalled();
	});

	it('should move new notes into notes when the target folder is missing', () => {
		(notesStore as any).isInitialized = true;

		notesStore.createNote('missing-folder');

		expect(notesStore.notes.get('test-uuid')?.folderId).toBe(PROTECTED_NOTES_FOLDER_ID);
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

	it('should toggle a note favorite flag', () => {
		addNoteToStore({ id: '1', folderId: 'f1', isFavorite: false });
		(notesStore as any).isInitialized = true;

		notesStore.setFavorite('1', true);

		expect(notesStore.notes.get('1')?.isFavorite).toBe(true);
		expect(notesRepository.save).toHaveBeenCalledWith(expect.objectContaining({ isFavorite: true }));
	});

	it('should preserve a note favorite flag across delete and restore', () => {
		addNoteToStore({ id: '1', folderId: 'f1', isFavorite: true });
		(notesStore as any).isInitialized = true;

		notesStore.deleteNote('1', 123);
		notesStore.restoreNote('1');

		expect(notesStore.notes.get('1')?.deletedAt).toBeNull();
		expect(notesStore.notes.get('1')?.isFavorite).toBe(true);
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
		folderStore.folders.set('f1', { id: 'f1', title: 'Folder', url: '#' });

		vi.spyOn(folderStore, 'findItemById').mockReturnValue({ id: 'f1', deletedAt: null } as any);

		trashService.recoverNote('1');

		expect(notesStore.notes.get('1')?.deletedAt).toBeNull();
		expect(notesStore.notes.get('1')?.folderId).toBe('f1'); // Remains in f1 if f1 is active
		expect(selectionStore.selectedFolderID).toBe('f1');
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
		folderStore.folders.set('A', a);
		vi.spyOn(folderStore, 'findItemById').mockReturnValue(a);
		vi.spyOn(folderService, 'findTopDeletedAncestor').mockReturnValue(a);
		const recoverSpy = vi.spyOn(trashService, 'recoverFolder');

		// Recover with folder
		trashService.recoverNote('note-x');

		expect(recoverSpy).toHaveBeenCalledWith('A');
		expect(notesStore.notes.get('note-x')?.deletedAt).toBeNull();
		expect(notesStore.notes.get('note-x')?.folderId).toBe('A');
		expect(selectionStore.selectedFolderID).toBe('A');
		expect(notesStore.selectedNoteID).toBe('note-x');
	});

	it('should support prompted recovery of note alone by moving it to notes', () => {
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
		expect(notesStore.notes.get('note-x')?.folderId).toBe(PROTECTED_NOTES_FOLDER_ID);
		expect(selectionStore.selectedFolderID).toBe(PROTECTED_NOTES_FOLDER_ID);
		expect(notesStore.selectedNoteID).toBe('note-x');
	});

	it('should move the note to notes if parent folder metadata is missing during recovery', () => {
		const note = { id: 'orphan', folderId: 'non-existent', deletedAt: 123 };
		addNoteToStore(note as any);
		(notesStore as any).isInitialized = true;
		folderStore.getDefaultFolderId();

		// Mock folderStore to return null for this ID (missing from system)
		vi.spyOn(folderStore, 'findItemById').mockImplementation((id: string) =>
			id === 'non-existent' ? null : folderStore.folders.get(id) ?? null
		);

		trashService.recoverNote('orphan');

		expect(notesStore.notes.get('orphan')?.deletedAt).toBeNull();
		expect(notesStore.notes.get('orphan')?.folderId).toBe(PROTECTED_NOTES_FOLDER_ID);
		expect(selectionStore.selectedFolderID).toBe(PROTECTED_NOTES_FOLDER_ID);
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
		folderStore.folders.set('special-folder', {
			id: 'special-folder',
			title: 'Special',
			url: '#',
			deletedAt: null
		});

		vi.spyOn(folderStore, 'findItemById').mockReturnValue({ id: 'special-folder', deletedAt: null } as any);

			trashService.recoverNote('orig');

			expect(noteService.getNoteCountForFolder('deleted-notes')).toBe(0);
			expect(noteService.getNoteCountForFolder('special-folder')).toBe(1);
			expect(notesStore.notes.get('orig')?.deletedAt).toBeNull();
			expect(selectionStore.selectedFolderID).toBe('special-folder');
			expect(notesStore.selectedNoteID).toBe('orig');
		});

		it('should use "root" key for notes with null folderId', () => {
			addNoteToStore({ id: 'orphan', folderId: null });

			expect(noteService.getNoteCountForFolder(null)).toBe(1);
		});
	});

	describe('Persistence', () => {
		it('should rebuild index on init and globally unified index notes regardless of deleted status', async () => {
			folderStore.folders.set('f1', { id: 'f1', title: 'Folder', url: '#' });
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

		it('should migrate active orphan notes into notes on init', async () => {
			vi.mocked(notesRepository.list).mockResolvedValue([{ id: '1', folderId: null, title: 'Orphan' }] as any);
			vi.mocked(settingsRepository.getAll).mockResolvedValue({} as any);

			await notesStore.init();

			expect(notesStore.notes.get('1')?.folderId).toBe(PROTECTED_NOTES_FOLDER_ID);
			expect(notesRepository.save).toHaveBeenCalledWith(
				expect.objectContaining({ id: '1', folderId: PROTECTED_NOTES_FOLDER_ID })
			);
		});

		it('should save notes on createNote', async () => {
			(notesStore as any).isInitialized = true;
			folderStore.folders.set('f1', { id: 'f1', title: 'Folder', url: '#' });
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
