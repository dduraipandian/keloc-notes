import { describe, it, expect, beforeEach, vi } from 'vitest';
import { selectionStore } from './selection.svelte';
import { folderStore, type FolderItem } from './folders.svelte';
import { notesStore, type NoteItem } from './notes.svelte';
import { SvelteMap } from 'svelte/reactivity';
import { PROTECTED_NOTES_FOLDER_ID, TRASH_VIEW_ID } from './sources/constants';

vi.mock('./idbr', () => ({
	putFolder: vi.fn(),
	getAllFolders: vi.fn(),
	putNote: vi.fn(),
	getAllNotes: vi.fn(),
	putSetting: vi.fn(),
	getAllSettings: vi.fn(),
	initDB: vi.fn(),
	getDB: vi.fn()
}));

import * as idbr from './idbr';

const addFolder = (f: Partial<FolderItem> & { id: string }) => {
	const folder: FolderItem = {
		title: 'Folder',
		url: '#',
		items: [],
		parentId: null,
		deletedAt: null,
		...f
	};
	folderStore.folders.set(f.id, folder);
	if (!folder.parentId) folderStore.items.push(f.id);
};

const addNote = (n: Partial<NoteItem> & { id: string }) => {
	const note: NoteItem = {
		folderId: null,
		title: 'Untitled',
		content: '',
		updatedAt: new Date().toISOString(),
		deletedAt: null,
		...n
	};
	notesStore.notes.set(n.id, note);
};

describe('SelectionStore', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();

		selectionStore.__resetForTest();
		// Clear in place rather than replacing — $derived.by in selectionStore
		// tracks a reactive dependency on folderStore.folders. Replacing the
		// SvelteMap instance breaks that tracked reference; clearing it preserves it.
		folderStore.folders.clear();
		(folderStore as any).items = [];
		(notesStore as any).notes = new SvelteMap();
	});

	// Note on $derived.by in tests: Svelte 5's $derived.by only re-runs when a
	// tracked reactive dependency actually *changes*. Tests must trigger a real
	// state transition (non-null → null, or id-A → id-B) to force recomputation.
	// Simply calling select(null) when the store is already null is a no-op.
	describe('currentSource', () => {
		it('returns null when no protected folder exists and no selection', () => {
			// No folders seeded — registry returns null for everything.
			// Trigger a transition: trash → null so the derived re-runs.
			selectionStore.select(TRASH_VIEW_ID);
			selectionStore.select(null);
			expect(selectionStore.currentSource).toBeNull();
		});

		it('resolves to the protected notes folder when selection is null', () => {
			addFolder({ id: PROTECTED_NOTES_FOLDER_ID, isProtected: true });
			// Transition from a known id so the derived re-runs with the folder present.
			selectionStore.select(TRASH_VIEW_ID);
			selectionStore.select(null);
			expect(selectionStore.currentSource?.id).toBe(PROTECTED_NOTES_FOLDER_ID);
		});

		it('resolves a real folder id', () => {
			addFolder({ id: 'f1', title: 'Work' });
			selectionStore.select('f1');
			expect(selectionStore.currentSource?.id).toBe('f1');
			expect(selectionStore.currentSource?.kind).toBe('folder');
		});

		it('resolves the trash virtual view', () => {
			selectionStore.select(TRASH_VIEW_ID);
			expect(selectionStore.currentSource?.id).toBe(TRASH_VIEW_ID);
			expect(selectionStore.currentSource?.kind).toBe('view');
		});

		it('falls back to protected notes folder for unknown id', () => {
			addFolder({ id: PROTECTED_NOTES_FOLDER_ID, isProtected: true });
			selectionStore.select('stale-or-deleted-id');
			expect(selectionStore.currentSource?.id).toBe(PROTECTED_NOTES_FOLDER_ID);
		});

		it('old "deleted-notes" string falls back to the protected notes folder', () => {
			// Old DB persisted 'deleted-notes' as selectedFolderID. It's not in the
			// registry as a virtual view (TRASH_VIEW_ID is 'trash'), so it falls back
			// to the protected notes folder.
			addFolder({ id: PROTECTED_NOTES_FOLDER_ID, isProtected: true });
			selectionStore.select('deleted-notes');
			expect(selectionStore.currentSource?.id).toBe(PROTECTED_NOTES_FOLDER_ID);
		});
	});

	describe('currentNotes', () => {
		it('returns notes for the selected folder', () => {
			addFolder({ id: 'f1' });
			addNote({ id: 'n1', folderId: 'f1' });
			addNote({ id: 'n2', folderId: 'f1' });
			addNote({ id: 'n3', folderId: 'other' });

			selectionStore.select('f1');
			expect(selectionStore.currentNotes).toHaveLength(2);
		});

		it('returns deleted notes when trash is selected', () => {
			addNote({ id: 'n1', deletedAt: Date.now() });
			addNote({ id: 'n2' });

			selectionStore.select(TRASH_VIEW_ID);
			expect(selectionStore.currentNotes).toHaveLength(1);
			expect(selectionStore.currentNotes[0].id).toBe('n1');
		});

		it('returns empty array when currentSource is null', () => {
			// No folders seeded
			expect(selectionStore.currentNotes).toEqual([]);
		});
	});

	describe('select + persist', () => {
		it('updates selectedSourceId', () => {
			addFolder({ id: 'f1' });
			selectionStore.select('f1');
			expect(selectionStore.selectedSourceId).toBe('f1');
		});

		it('does not persist before init', () => {
			selectionStore.select('f1');
			expect(idbr.putSetting).not.toHaveBeenCalled();
		});

		it('persists after init', async () => {
			vi.mocked(idbr.getAllSettings).mockResolvedValue({} as any);
			await selectionStore.init();
			selectionStore.select('f1');
			expect(idbr.putSetting).toHaveBeenCalledWith('selectedFolderID', 'f1');
		});
	});

	describe('init', () => {
		it('reads selectedFolderID from settings', async () => {
			addFolder({ id: 'f1' });
			vi.mocked(idbr.getAllSettings).mockResolvedValue({ selectedFolderID: 'f1' } as any);
			await selectionStore.init();
			expect(selectionStore.selectedSourceId).toBe('f1');
		});

		it('leaves selectedSourceId null when settings is empty', async () => {
			vi.mocked(idbr.getAllSettings).mockResolvedValue({} as any);
			await selectionStore.init();
			expect(selectionStore.selectedSourceId).toBeNull();
		});

		it('is idempotent — second init does not re-read settings', async () => {
			vi.mocked(idbr.getAllSettings).mockResolvedValue({ selectedFolderID: 'f1' } as any);
			await selectionStore.init();
			await selectionStore.init();
			expect(idbr.getAllSettings).toHaveBeenCalledTimes(1);
		});
	});
});
