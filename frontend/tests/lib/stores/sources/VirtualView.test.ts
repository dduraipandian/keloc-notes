import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SvelteMap } from 'svelte/reactivity';
import { folderStore, type FolderItem } from '$lib/stores/folders.svelte';
import { notesStore, type NoteItem } from '$lib/stores/notes.svelte';
import { favoritesView, trashView } from '$lib/stores/sources/builtinViews';

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

describe('virtual views', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(folderStore as any).folders = new SvelteMap<string, FolderItem>();
		(notesStore as any).notes = new SvelteMap<string, NoteItem>();
	});

	it('trash view aggregates deleted notes and deleted folders', () => {
		addFolder({ id: 'deleted-folder', deletedAt: 123 });
		addNote({ id: 'n1', deletedAt: 123 });

		expect(trashView.getNotes().map((note) => note.id)).toEqual(['n1']);
		expect(trashView.getChildren()).toEqual(['deleted-folder']);
	});

	it('favorites view aggregates favorite notes and folders', () => {
		addFolder({ id: 'work', isFavorite: true });
		addNote({ id: 'n1', isFavorite: true });

		expect(favoritesView.getNotes().map((note) => note.id)).toEqual(['n1']);
		expect(favoritesView.getChildren()).toEqual(['work']);
	});
});
