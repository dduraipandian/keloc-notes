import { describe, it, expect, beforeEach, vi } from 'vitest';
import { notesStore, type NoteItem } from '../../src/lib/stores/notes.svelte';
import { folderStore, type FolderItem } from '../../src/lib/stores/folders.svelte';
import { noteService, trashService } from '../../src/lib/stores/services';
import { selectionStore } from '../../src/lib/stores/selection.svelte';
import { SvelteMap } from 'svelte/reactivity';
import { notesRepository } from '../../src/lib/stores/repositories';

// Mock IDBR module
vi.mock('../../src/lib/stores/repositories', () => ({
	foldersRepository: { list: vi.fn(), save: vi.fn() },
	notesRepository: { list: vi.fn(), save: vi.fn() },
	settingsRepository: { getAll: vi.fn(), save: vi.fn() },
	trashRepository: { permanentlyDeleteFolderTree: vi.fn(), permanentlyDeleteNote: vi.fn() }
}));

// Mock crypto.randomUUID
global.crypto.randomUUID = vi.fn(() => 'test-uuid' as any);

describe('NotesStore (Flat Recovery)', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();
		(notesStore as any).notes = new SvelteMap();
		(notesStore as any).selectedNoteID = null;
		(notesStore as any).isInitialized = true;
		(folderStore as any).items = [];
		(folderStore as any).folders = new SvelteMap();
		(folderStore as any).isInitialized = true;
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

	it('should recover a note to Home (null) if parent is deleted', () => {
		const parent: FolderItem = { id: 'f1', title: 'Deleted Folder', deletedAt: 123 };
		folderStore.folders.set('f1', parent);

		addNoteToStore({ id: 'n1', folderId: 'f1', deletedAt: 123 });

		trashService.recoverNote('n1');

		expect(notesStore.notes.get('n1')?.deletedAt).toBeNull();
		expect(notesStore.notes.get('n1')?.folderId).toBeNull(); // Ejected to Home
		expect(selectionStore.selectedFolderID).toBeNull();
	});

	it('should recover a note to its folder if parent is active', () => {
		const parent: FolderItem = { id: 'f1', title: 'Active Folder', deletedAt: null };
		folderStore.folders.set('f1', parent);
		folderStore.items.push('f1');

		addNoteToStore({ id: 'n1', folderId: 'f1', deletedAt: 123 });

		trashService.recoverNote('n1');

		expect(notesStore.notes.get('n1')?.deletedAt).toBeNull();
		expect(notesStore.notes.get('n1')?.folderId).toBe('f1'); // Preserved parent
		expect(selectionStore.selectedFolderID).toBe('f1');
	});

	it('should recover a note to Home (null) if parent is MISSING', () => {
		// No parent in folderStore
		addNoteToStore({ id: 'n1', folderId: 'missing-id', deletedAt: 123 });

		trashService.recoverNote('n1');

		expect(notesStore.notes.get('n1')?.deletedAt).toBeNull();
		expect(notesStore.notes.get('n1')?.folderId).toBeNull(); // Ejected to Home
	});
});
