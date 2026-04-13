import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SvelteMap } from 'svelte/reactivity';
import { folderStore, type FolderItem } from '$lib/stores/folders.svelte';
import { notesStore, type NoteItem } from '$lib/stores/notes.svelte';
import { protectedFolderViewCapabilities } from '$lib/stores/sources/builtinViews';
import { PROTECTED_NOTES_FOLDER_ID } from '$lib/stores/sources/constants';
import { createFolderSource } from '$lib/stores/sources/FolderSource';

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

const addFolder = (folder: Partial<FolderItem> & { id: string }) => {
	const value: FolderItem = {
		title: 'Folder',
		url: '#',
		items: [],
		parentId: null,
		deletedAt: null,
		...folder
	};
	folderStore.folders.set(folder.id, value);
	if (!value.parentId) folderStore.items.push(folder.id);
};

const addNote = (note: Partial<NoteItem> & { id: string }) => {
	const value: NoteItem = {
		folderId: null,
		title: 'Untitled',
		content: '',
		updatedAt: new Date().toISOString(),
		deletedAt: null,
		...note
	};
	notesStore.notes.set(note.id, value);
};

describe('FolderSource', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(folderStore as any).items = [];
		(folderStore as any).folders = new SvelteMap<string, FolderItem>();
		(notesStore as any).notes = new SvelteMap<string, NoteItem>();
	});

	it('returns only active notes for a live folder', () => {
		addFolder({ id: 'work' });
		addNote({ id: 'n1', folderId: 'work' });
		addNote({ id: 'n2', folderId: 'work', deletedAt: 123 });

		expect(createFolderSource('work').getNotes().map((note) => note.id)).toEqual(['n1']);
	});

	it('returns deleted subtree notes for a deleted folder', () => {
		addFolder({ id: 'parent', deletedAt: 123, items: ['child'] });
		addFolder({ id: 'child', parentId: 'parent', deletedAt: 123 });
		addNote({ id: 'n1', folderId: 'child', deletedAt: 123 });

		expect(createFolderSource('parent').getNotes().map((note) => note.id)).toEqual(['n1']);
	});

	it('merges capability overrides for pinned folder views', () => {
		addFolder({ id: PROTECTED_NOTES_FOLDER_ID });

		expect(
			createFolderSource(PROTECTED_NOTES_FOLDER_ID, {
				capabilities: protectedFolderViewCapabilities
			}).capabilities
		).toEqual({
			canRename: false,
			canDelete: false,
			canCreateSubfolder: true,
			canCreateNote: true,
			canSetFavorite: false,
			canEmpty: false,
			showsDeletedNotes: false
		});
	});
});
