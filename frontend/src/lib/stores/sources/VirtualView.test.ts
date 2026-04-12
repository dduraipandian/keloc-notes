import { describe, it, expect, beforeEach, vi } from 'vitest';
import { notesStore, type NoteItem } from '../notes.svelte';
import { SvelteMap } from 'svelte/reactivity';
import { createVirtualView } from './VirtualView';
import { trashView } from './builtinViews';
import { TRASH_VIEW_ID } from './constants';

vi.mock('../idbr', () => ({
	putNote: vi.fn(),
	getAllNotes: vi.fn(),
	putSetting: vi.fn(),
	getAllSettings: vi.fn(),
	initDB: vi.fn(),
	getDB: vi.fn()
}));

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

describe('VirtualView', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();
		(notesStore as any).notes = new SvelteMap();
	});

	it('getChildren always returns []', () => {
		const view = createVirtualView({
			id: 'test-view',
			title: 'Test',
			iconKey: 'star',
			predicate: () => true,
			capabilities: {
				canRename: false,
				canDelete: false,
				canCreateSubfolder: false,
				canCreateNote: false,
				showsDeletedNotes: false
			}
		});
		expect(view.getChildren()).toEqual([]);
	});

	it('kind is view', () => {
		const view = createVirtualView({
			id: 'v',
			title: 'V',
			iconKey: 'tag',
			predicate: () => false,
			capabilities: {
				canRename: false,
				canDelete: false,
				canCreateSubfolder: false,
				canCreateNote: false,
				showsDeletedNotes: false
			}
		});
		expect(view.kind).toBe('view');
	});
});

describe('trashView', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();
		(notesStore as any).notes = new SvelteMap();
	});

	it('aggregates all deleted notes across folders', () => {
		addNote({ id: 'n1', folderId: 'f1', deletedAt: Date.now() });
		addNote({ id: 'n2', folderId: 'f2', deletedAt: Date.now() });
		addNote({ id: 'n3', folderId: 'f1' }); // active

		const notes = trashView.getNotes();
		expect(notes.map((n) => n.id)).toEqual(expect.arrayContaining(['n1', 'n2']));
		expect(notes).toHaveLength(2);
	});

	it('returns empty when no notes are deleted', () => {
		addNote({ id: 'n1', folderId: 'f1' });
		expect(trashView.getNotes()).toHaveLength(0);
	});

	it('id is TRASH_VIEW_ID', () => {
		expect(trashView.id).toBe(TRASH_VIEW_ID);
	});

	it('capabilities block all mutations', () => {
		const caps = trashView.capabilities;
		expect(caps.canRename).toBe(false);
		expect(caps.canDelete).toBe(false);
		expect(caps.canCreateSubfolder).toBe(false);
		expect(caps.canCreateNote).toBe(false);
		expect(caps.showsDeletedNotes).toBe(true);
	});

	it('getChildren returns []', () => {
		expect(trashView.getChildren()).toEqual([]);
	});
});
