import { describe, it, expect, beforeEach, vi } from 'vitest';
import { folderStore, type FolderItem } from '../folders.svelte';
import { notesStore, type NoteItem } from '../notes.svelte';
import { SvelteMap } from 'svelte/reactivity';
import { createFolderSource } from './FolderSource';
import { PROTECTED_NOTES_FOLDER_ID } from './constants';

vi.mock('../idbr', () => ({
	putFolder: vi.fn(),
	getAllFolders: vi.fn(),
	putNote: vi.fn(),
	getAllNotes: vi.fn(),
	putSetting: vi.fn(),
	getAllSettings: vi.fn(),
	initDB: vi.fn(),
	getDB: vi.fn()
}));

const addFolder = (f: Partial<FolderItem> & { id: string }) => {
	const folder: FolderItem = { title: 'Folder', url: '#', items: [], parentId: null, deletedAt: null, ...f };
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

describe('FolderSource', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();
		(folderStore as any).items = [];
		(folderStore as any).folders = new SvelteMap();
		(notesStore as any).notes = new SvelteMap();
	});

	it('getNotes returns only active notes for the folder', () => {
		addFolder({ id: 'f1', title: 'Work' });
		addNote({ id: 'n1', folderId: 'f1' });
		addNote({ id: 'n2', folderId: 'f1' });
		addNote({ id: 'n3', folderId: 'f1', deletedAt: Date.now() });
		addNote({ id: 'n4', folderId: 'other' });

		const source = createFolderSource('f1');
		const notes = source.getNotes();

		expect(notes.map((n) => n.id)).toEqual(expect.arrayContaining(['n1', 'n2']));
		expect(notes).toHaveLength(2);
	});

	it('getNotes returns empty array for unknown folder', () => {
		const source = createFolderSource('nonexistent');
		expect(source.getNotes()).toEqual([]);
	});

	it('getChildren returns non-deleted subfolder ids', () => {
		addFolder({ id: 'parent', items: ['child1', 'child2'] });
		addFolder({ id: 'child1', parentId: 'parent' });
		addFolder({ id: 'child2', parentId: 'parent', deletedAt: Date.now() });

		const source = createFolderSource('parent');
		expect(source.getChildren()).toEqual(['child1']);
	});

	it('getChildren returns [] when folder has no items', () => {
		addFolder({ id: 'leaf', items: [] });
		const source = createFolderSource('leaf');
		expect(source.getChildren()).toEqual([]);
	});

	it('kind is folder', () => {
		addFolder({ id: 'f1' });
		expect(createFolderSource('f1').kind).toBe('folder');
	});

	it('title reflects the folder title', () => {
		addFolder({ id: 'f1', title: 'My Folder' });
		expect(createFolderSource('f1').title).toBe('My Folder');
	});

	describe('capabilities — normal folder', () => {
		it('allows rename, delete, create subfolder, create note', () => {
			addFolder({ id: 'f1' });
			const caps = createFolderSource('f1').capabilities;
			expect(caps.canRename).toBe(true);
			expect(caps.canDelete).toBe(true);
			expect(caps.canCreateSubfolder).toBe(true);
			expect(caps.canCreateNote).toBe(true);
			expect(caps.showsDeletedNotes).toBe(false);
		});
	});

	describe('capabilities — protected folder', () => {
		it('blocks rename and delete but allows subfolder and note creation', () => {
			addFolder({ id: PROTECTED_NOTES_FOLDER_ID, isProtected: true });
			const caps = createFolderSource(PROTECTED_NOTES_FOLDER_ID).capabilities;
			expect(caps.canRename).toBe(false);
			expect(caps.canDelete).toBe(false);
			expect(caps.canCreateSubfolder).toBe(true);
			expect(caps.canCreateNote).toBe(true);
			expect(caps.showsDeletedNotes).toBe(false);
		});
	});

	describe('capabilities — deleted folder', () => {
		it('blocks all mutations and sets showsDeletedNotes', () => {
			addFolder({ id: 'f1', deletedAt: Date.now() });
			const caps = createFolderSource('f1').capabilities;
			expect(caps.canRename).toBe(false);
			expect(caps.canDelete).toBe(false);
			expect(caps.canCreateSubfolder).toBe(false);
			expect(caps.canCreateNote).toBe(false);
			expect(caps.showsDeletedNotes).toBe(true);
		});
	});

	it('iconKey is notes-home for the protected notes folder', () => {
		addFolder({ id: PROTECTED_NOTES_FOLDER_ID });
		expect(createFolderSource(PROTECTED_NOTES_FOLDER_ID).iconKey).toBe('notes-home');
	});

	it('iconKey is folder for regular folders', () => {
		addFolder({ id: 'f1' });
		expect(createFolderSource('f1').iconKey).toBe('folder');
	});
});
