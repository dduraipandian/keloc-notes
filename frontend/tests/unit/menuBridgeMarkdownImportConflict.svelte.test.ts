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

describe('menu bridge markdown import conflict flow', () => {
	const mockFolderService = {
		create: vi.fn(),
		rename: vi.fn(),
		ensurePath: vi.fn(),
		select: vi.fn()
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
	let importHandler: (() => Promise<void>) | undefined;

	beforeEach(() => {
		vi.clearAllMocks();
		uiState = new UIStateStore();
		folders = new FolderStore();
		notes = new NotesStore();
		selection = new SelectionStore(folders);
		importHandler = undefined;

		folders.folders.set('folder-1', {
			id: 'folder-1',
			title: 'Projects',
			parentId: null,
			items: [],
			deletedAt: null,
			deletedBatchId: null,
			isFavorite: false
		} as any);
		folders.items.push('folder-1');

		notes.notes.set('note-1', {
			id: 'note-1',
			folderId: 'folder-1',
			title: 'Roadmap',
			summary: '',
			updatedAt: '2025-01-01T00:00:00.000Z',
			deletedAt: null,
			deletedBatchId: null,
			isFavorite: false,
			content: '',
			isContentLoaded: false
		} as any);

		vi.mocked(EventsOn).mockImplementation((event, handler) => {
			if (event === 'menu:import-markdown') {
				importHandler = handler as () => Promise<void>;
			}
			return () => {};
		});
	});

	it('opens a conflict dialog and does not write until the user confirms', async () => {
		vi.mocked(AppModule.ImportNotesZip).mockResolvedValue([
			{
				Title: 'Roadmap',
				Content: 'Imported body',
				FolderPath: 'Projects'
			}
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

		await importHandler?.();

		expect(uiState.markdownImportConflictDialog?.open).toBe(true);
		expect(uiState.markdownImportConflictDialog?.conflicts).toEqual([
			{
				importIndex: 0,
				title: 'Roadmap',
				folderPath: 'Projects',
				existingNoteId: 'note-1'
			}
		]);
		expect(mockNoteService.create).not.toHaveBeenCalled();
		expect(mockNoteService.update).not.toHaveBeenCalled();
	});

	it('overwrites conflicting notes after explicit confirmation', async () => {
		vi.mocked(AppModule.ImportNotesZip).mockResolvedValue([
			{
				Title: 'Roadmap',
				Content: 'Imported body',
				FolderPath: 'Projects'
			}
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

		await importHandler?.();
		uiState.setMarkdownImportResolution('overwrite');
		await uiState.confirmMarkdownImportConflictDialog();

		expect(mockNoteService.update).toHaveBeenCalledWith('note-1', {
			title: 'Roadmap',
			content: 'Imported body'
		});
		expect(mockNoteService.create).not.toHaveBeenCalled();
		expect(uiState.markdownImportConflictDialog).toBeNull();
	});

	it('creates renamed copies when the user chooses keep both', async () => {
		vi.mocked(AppModule.ImportNotesZip).mockResolvedValue([
			{
				Title: 'Roadmap',
				Content: 'Imported body',
				FolderPath: 'Projects'
			}
		]);
		vi.mocked(mockFolderService.ensurePath).mockReturnValue('folder-1');
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
		uiState.setMarkdownImportResolution('keep-both');
		await uiState.confirmMarkdownImportConflictDialog();

		expect(mockFolderService.ensurePath).toHaveBeenCalledWith('Projects');
		expect(mockNoteService.create).toHaveBeenCalledWith('folder-1', { silent: true });
		expect(mockNoteService.update).toHaveBeenCalledWith('new-note-id', {
			title: 'Roadmap (Imported)',
			content: 'Imported body'
		});
		expect(uiState.markdownImportConflictDialog).toBeNull();
	});
});
