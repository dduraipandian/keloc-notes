import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushSync } from 'svelte';
import { notesStore, type NoteItem } from './notes.svelte';
import * as idbr from './idbr';
import { folderStore, type FolderItem } from './folders.svelte';
import { PROTECTED_NOTES_FOLDER_ID, TRASH_VIEW_ID } from './sources/constants';

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
		vi.restoreAllMocks();
		vi.clearAllMocks();
		notesStore.__resetForTest();
		folderStore.__resetForTest();
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
		// Folder must exist in store for createNote to use it
		vi.spyOn(folderStore, 'findItemById').mockReturnValue({ id: 'folder-1', deletedAt: null } as any);
		notesStore.createNote('folder-1');

		expect(notesStore.notes.size).toBe(1);
		const note = notesStore.notes.get('test-uuid');
		expect(note?.folderId).toBe('folder-1');
		expect(notesStore.selectedNoteID).toBe('test-uuid');
		expect(idbr.putNote).toHaveBeenCalled();
	});

	it('should fall back to the protected notes folder when createNote receives a null folderId', () => {
		(notesStore as any).isInitialized = true;
		notesStore.createNote(null);

		const note = notesStore.notes.get('test-uuid');
		expect(note?.folderId).toBe(PROTECTED_NOTES_FOLDER_ID);
	});

	it('should store notes with correct folderId and sorted order is visible via notes map', () => {
		// Sorting by date is handled by NoteSource.getNotes() — verify notes are stored correctly
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

		const f1Notes = Array.from(notesStore.notes.values()).filter(
			(n) => n.folderId === 'f1' && n.deletedAt == null
		);
		expect(f1Notes.length).toBe(2);
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
		addNoteToStore({ id: '1', folderId: 'f1' });
		notesStore.selectedNoteID = '1';
		(notesStore as any).isInitialized = true;

		const stamp = 12345;
		notesStore.deleteNote('1', stamp);

		expect(notesStore.notes.get('1')?.deletedAt).toBe(stamp);
		expect(notesStore.selectedNoteID).toBeNull();
		// Note is soft-deleted: no longer active in f1, now counted as deleted
		const f1Active = Array.from(notesStore.notes.values()).filter(
			(n) => n.folderId === 'f1' && n.deletedAt == null
		);
		const deleted = Array.from(notesStore.notes.values()).filter((n) => n.deletedAt != null);
		expect(f1Active).toHaveLength(0);
		expect(deleted).toHaveLength(1);
		expect(idbr.putNote).toHaveBeenCalledWith(expect.objectContaining({ deletedAt: stamp }));
		expect(idbr.putSetting).toHaveBeenCalledWith('selectedNoteID', null);
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

		notesStore.recoverNote('1');

		expect(notesStore.notes.get('1')?.deletedAt).toBeNull();
		expect(notesStore.notes.get('1')?.folderId).toBe('f1');
		expect(idbr.putNote).toHaveBeenCalledWith(expect.objectContaining({ deletedAt: null }));
	});

	it('should support prompted recovery of note and folder hierarchy', () => {
		(notesStore as any).isInitialized = true;
		const epoch = 123;

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
		vi.spyOn(folderStore, 'findTopDeletedAncestor').mockReturnValue(a);
		const recoverSpy = vi.spyOn(folderStore, 'recoverFolderAndChildren');

		notesStore.recoverNote('note-x', true);

		expect(recoverSpy).toHaveBeenCalledWith('A');
		expect(notesStore.notes.get('note-x')?.deletedAt).toBeNull();
		expect(notesStore.notes.get('note-x')?.folderId).toBe('A');
	});

	it('should recover note alone — lands in protected notes folder, not original deleted folder', () => {
		(notesStore as any).isInitialized = true;
		const epoch = 123;

		const note: NoteItem = {
			id: 'note-x',
			folderId: 'A',
			title: 'X',
			content: '',
			updatedAt: '',
			deletedAt: epoch
		};
		addNoteToStore(note);

		const a: FolderItem = { id: 'A', title: 'A', url: '#', parentId: null, items: [], deletedAt: epoch };
		vi.spyOn(folderStore, 'findItemById').mockReturnValue(a);

		notesStore.recoverNote('note-x', false);

		expect(notesStore.notes.get('note-x')?.deletedAt).toBeNull();
		// Lands in protected Notes folder, not left floating with null folderId
		expect(notesStore.notes.get('note-x')?.folderId).toBe(PROTECTED_NOTES_FOLDER_ID);
	});

	it('should land note in protected notes folder if parent folder is missing during recovery', () => {
		const note = { id: 'orphan', folderId: 'non-existent', deletedAt: 123 };
		addNoteToStore(note as any);
		(notesStore as any).isInitialized = true;

		vi.spyOn(folderStore, 'findItemById').mockReturnValue(null);

		notesStore.recoverNote('orphan');

		expect(notesStore.notes.get('orphan')?.deletedAt).toBeNull();
		expect(notesStore.notes.get('orphan')?.folderId).toBe(PROTECTED_NOTES_FOLDER_ID);
	});

	it('should only recover notes in a folder that match the target batch epoch', () => {
		(notesStore as any).isInitialized = true;
		const epoch = 5000;
		const olderEpoch = 1000;

		addNoteToStore({ id: 'n1', folderId: 'f1', deletedAt: epoch } as any);
		addNoteToStore({ id: 'n2', folderId: 'f1', deletedAt: olderEpoch } as any);

		notesStore.recoverNotesInFolder('f1', epoch);

		expect(notesStore.notes.get('n1')?.deletedAt).toBeNull();
		expect(notesStore.notes.get('n2')?.deletedAt).toBe(olderEpoch);
	});

	describe('Index Management', () => {
		// flushSync is required in Node tests before reading $derived.by values —
		// flushSync is required in Node tests before reading $derived.by values —
		// Svelte 5 batches signal updates and only flushes in a browser reactive cycle.
		const count = (folderId: string) => notesStore.folderCountIndex.get(folderId) ?? 0;

		it('should update index when note is moved between folders', () => {
			const noteID = 'move-me';
			(notesStore as any).isInitialized = true;
			addNoteToStore({ id: noteID, folderId: 'f1' });
			flushSync();

			expect(count('f1')).toBe(1);
			expect(count('f2')).toBe(0);

			notesStore.updateNote(noteID, { folderId: 'f2' });
			flushSync();

			expect(count('f1')).toBe(0);
			expect(count('f2')).toBe(1);
		});

		it('should hide soft deleted notes from folder count', () => {
			addNoteToStore({ id: 'del-me', folderId: 'f1' });
			flushSync();
			expect(count('f1')).toBe(1);

			notesStore.deleteNote('del-me');
			flushSync();

			expect(count('f1')).toBe(0);
		});

		it('should redirect createNote to default folder when the target is a virtual view (no folder match)', () => {
			(notesStore as any).isInitialized = true;
			// Virtual view IDs (e.g. TRASH_VIEW_ID) are not in folderStore,
			// so findItemById returns null → falls back to default.
			vi.spyOn(folderStore, 'findItemById').mockReturnValue(null);
			vi.spyOn(folderStore, 'getDefaultFolderId').mockReturnValue('default-folder');

			notesStore.createNote(TRASH_VIEW_ID);
			flushSync();

			const note = notesStore.notes.get('test-uuid');
			expect(note?.folderId).toBe('default-folder');
			expect(count('default-folder')).toBe(1);
			expect(count(TRASH_VIEW_ID)).toBe(0);
		});

		it('should recover a note back to its original specific folder logically', () => {
			const note = { id: 'orig', folderId: 'special-folder', deletedAt: 999, updatedAt: '' };
			addNoteToStore(note as any);
			flushSync();
			(notesStore as any).isInitialized = true;

			vi.spyOn(folderStore, 'findItemById').mockReturnValue({ id: 'special-folder', deletedAt: null } as any);

			notesStore.recoverNote('orig');
			flushSync();

			expect(count(TRASH_VIEW_ID)).toBe(0);
			expect(count('special-folder')).toBe(1);
			expect(notesStore.notes.get('orig')?.deletedAt).toBeNull();
		});
	});

	describe('Persistence', () => {
		it('should rebuild index on init — active and deleted notes counted correctly', async () => {
			const savedNotes = [
				{ id: '1', folderId: 'f1', title: 'Active' },
				{ id: '2', folderId: 'f1', title: 'Deleted', deletedAt: 444 }
			];
			vi.mocked(idbr.getAllNotes).mockResolvedValue(savedNotes as any);
			vi.mocked(idbr.getAllSettings).mockResolvedValue({ selectedNoteID: '1' } as any);

			await notesStore.init();
			flushSync();

			expect(notesStore.folderCountIndex.get('f1')).toBe(1);
			expect(notesStore.folderCountIndex.get(TRASH_VIEW_ID)).toBe(1);
		});

		it('init migrates null-folderId active notes to the protected notes folder', async () => {
			const savedNotes = [
				{ id: 'orphan', folderId: null, title: 'Orphan' }
			];
			vi.mocked(idbr.getAllNotes).mockResolvedValue(savedNotes as any);
			vi.mocked(idbr.getAllSettings).mockResolvedValue({} as any);

			await notesStore.init();

			expect(notesStore.notes.get('orphan')?.folderId).toBe(PROTECTED_NOTES_FOLDER_ID);
			// Should have persisted the migrated note
			expect(idbr.putNote).toHaveBeenCalledWith(expect.objectContaining({ folderId: PROTECTED_NOTES_FOLDER_ID }));
		});

		it('init does not migrate already-deleted orphan notes', async () => {
			const savedNotes = [
				{ id: 'dead', folderId: null, title: 'Dead Orphan', deletedAt: 999 }
			];
			vi.mocked(idbr.getAllNotes).mockResolvedValue(savedNotes as any);
			vi.mocked(idbr.getAllSettings).mockResolvedValue({} as any);

			await notesStore.init();

			// Already deleted orphans keep their folderId as-is (migration is for active only)
			expect(notesStore.notes.get('dead')?.folderId).toBeNull();
			expect(idbr.putNote).not.toHaveBeenCalled();
		});

		it('should save notes on createNote', async () => {
			(notesStore as any).isInitialized = true;
			vi.spyOn(folderStore, 'findItemById').mockReturnValue({ id: 'f1', deletedAt: null } as any);
			notesStore.createNote('f1');
			expect(idbr.putNote).toHaveBeenCalled();
		});

		it('should save selectedNoteID on selectNote', async () => {
			(notesStore as any).isInitialized = true;
			addNoteToStore({ id: '1' });

			notesStore.selectNote('1');

			expect(notesStore.selectedNoteID).toBe('1');
			expect(idbr.putSetting).toHaveBeenCalledWith('selectedNoteID', '1');
		});

		it('should persist null selectedNoteID when deselecting', async () => {
			(notesStore as any).isInitialized = true;
			addNoteToStore({ id: '1' });
			notesStore.selectNote('1');
			vi.clearAllMocks();

			notesStore.selectNote(null);

			expect(notesStore.selectedNoteID).toBeNull();
			expect(idbr.putSetting).toHaveBeenCalledWith('selectedNoteID', null);
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
			expect(notesStore.notes.get('n3')?.deletedAt).toBeNull();
			expect(notesStore.selectedNoteID).toBeNull();
			expect(idbr.putSetting).toHaveBeenCalledWith('selectedNoteID', null);
		});
	});
});
