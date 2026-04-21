import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initMenuBridge } from '$lib/menu/menuBridge.svelte';
import { EventsOn } from '$lib/wailsjs/runtime/runtime';
import { ThemeStore } from '$lib/stores/theme.svelte';
import { UIStateStore } from '$lib/stores/uiState.svelte';
import { FolderStore } from '$lib/stores/folders.svelte';
import { NotesStore } from '$lib/stores/notes.svelte';
import { SelectionStore } from '$lib/stores/selection.svelte';
import * as AppModule from '$lib/wailsjs/go/main/App';

vi.mock('$lib/wailsjs/runtime/runtime', () => ({
	EventsOn: vi.fn()
}));

vi.mock('$lib/wailsjs/go/main/App', () => ({
	ImportNotesZip: vi.fn(),
	ExportNoteToFile: vi.fn(),
	ExportNotesZip: vi.fn(),
	UpdateMenuState: vi.fn(),
	SaveBackupFile: vi.fn(),
	ReadBackupFile: vi.fn()
}));

describe('menu bridge markdown zip scope', () => {
	const mockFolderService = {
		create: vi.fn(),
		rename: vi.fn(),
		ensurePath: vi.fn(),
		select: vi.fn(),
		getPlainFolderPath: vi.fn()
	};
	const mockNoteService = {
		create: vi.fn(),
		update: vi.fn(),
		getNotesForExport: vi.fn(),
		select: vi.fn()
	};
	const mockTrashService = {
		emptyTrash: vi.fn(),
		recoverNote: vi.fn()
	};
	const mockUIStore = {
		confirmEmptyTrash: vi.fn(),
		confirmNoteDelete: vi.fn(),
		showOperationError: vi.fn()
	};

	let uiState: UIStateStore;
	let folders: FolderStore;
	let notes: NotesStore;
	let selection: SelectionStore;
	let exportHandler: (() => Promise<void>) | undefined;
	let importHandler: (() => Promise<void>) | undefined;

	beforeEach(() => {
		vi.clearAllMocks();
		uiState = new UIStateStore();
		folders = new FolderStore();
		notes = new NotesStore();
		selection = new SelectionStore(folders);
		exportHandler = undefined;
		importHandler = undefined;

		folders.folders.set('folder-1', {
			id: 'folder-1',
			title: 'Projects',
			parentId: null,
			items: ['folder-2'],
			deletedAt: null,
			deletedBatchId: null,
			isFavorite: false
		} as any);
		folders.folders.set('folder-2', {
			id: 'folder-2',
			title: '2025',
			parentId: 'folder-1',
			items: [],
			deletedAt: null,
			deletedBatchId: null,
			isFavorite: false
		} as any);
		folders.items.push('folder-1');

		notes.notes.set('note-a', {
			id: 'note-a',
			folderId: 'folder-1',
			title: 'Parent Note',
			summary: '',
			updatedAt: '2025-01-01T00:00:00.000Z',
			deletedAt: null,
			deletedBatchId: null,
			content: '',
			isFavorite: false,
			isContentLoaded: false
		} as any);
		notes.notes.set('note-b', {
			id: 'note-b',
			folderId: 'folder-2',
			title: 'Child Note',
			summary: '',
			updatedAt: '2025-01-01T00:00:00.000Z',
			deletedAt: null,
			deletedBatchId: null,
			content: '',
			isFavorite: false,
			isContentLoaded: false
		} as any);
		notes.notes.set('note-c', {
			id: 'note-c',
			folderId: null,
			title: 'Root Note',
			summary: '',
			updatedAt: '2025-01-01T00:00:00.000Z',
			deletedAt: null,
			deletedBatchId: null,
			content: '',
			isFavorite: false,
			isContentLoaded: false
		} as any);

		vi.mocked(EventsOn).mockImplementation((event, handler) => {
			if (event === 'menu:export-all-markdown') {
				exportHandler = handler as () => Promise<void>;
			}
			if (event === 'menu:import-markdown') {
				importHandler = handler as () => Promise<void>;
			}
			return () => {};
		});
	});

	it('exports only the selected folder subtree and uses paths relative to that folder', async () => {
		selection.selectedFolderID = 'folder-1';
		vi.mocked(mockNoteService.getNotesForExport).mockResolvedValue([
			{ title: 'Parent Note', content: '# Parent', folderPath: '', updatedAt: '', assets: [] },
			{ title: 'Child Note', content: '# Child', folderPath: '2025', updatedAt: '', assets: [] }
		]);

		initMenuBridge({
			uiState,
			theme: new ThemeStore(),
			ui: mockUIStore as any,
			selection,
			folders,
			notes,
			folderService: mockFolderService as any,
			noteService: mockNoteService as any,
			trashService: mockTrashService as any
		});

		await exportHandler?.();

		expect(mockNoteService.getNotesForExport).toHaveBeenCalledWith(['note-a', 'note-b'], {
			relativeToFolderId: 'folder-1',
			includeAssets: true
		});
		expect(AppModule.ExportNotesZip).toHaveBeenCalledWith([
			{ title: 'Parent Note', content: '# Parent', folderPath: '', updatedAt: '', assets: [] },
			{ title: 'Child Note', content: '# Child', folderPath: '2025', updatedAt: '', assets: [] }
		]);
	});

	it('imports markdown archive relative to the selected folder root', async () => {
		selection.selectedFolderID = 'folder-1';
		vi.mocked(AppModule.ImportNotesZip).mockResolvedValue([
			{
				Title: 'Imported Note',
				Content: '# Imported',
				FolderPath: '2025',
				Assets: []
			}
		] as any);
		vi.mocked(mockFolderService.getPlainFolderPath).mockReturnValue('Projects');
		vi.mocked(mockFolderService.ensurePath).mockReturnValue('folder-2');
		vi.mocked(mockNoteService.create).mockReturnValue({ id: 'new-note-id' } as any);

		initMenuBridge({
			uiState,
			theme: new ThemeStore(),
			ui: mockUIStore as any,
			selection,
			folders,
			notes,
			folderService: mockFolderService as any,
			noteService: mockNoteService as any,
			trashService: mockTrashService as any
		});

		await importHandler?.();

		expect(mockFolderService.ensurePath).toHaveBeenCalledWith('Projects/2025');
	});
});
