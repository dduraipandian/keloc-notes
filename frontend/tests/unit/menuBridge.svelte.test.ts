import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushSync } from 'svelte';
import { initMenuBridge, initMenuStateEffect } from '$lib/menu/menuBridge.svelte';
import { EventsOn } from '$lib/wailsjs/runtime/runtime';
import { SelectionStore } from '$lib/stores/selection.svelte';
import { UIStore } from '$lib/stores/dialog.svelte';
import { NotesStore } from '$lib/stores/notes.svelte';
import { FolderStore } from '$lib/stores/folders.svelte';
import { ThemeStore } from '$lib/stores/theme.svelte';
import { UIStateStore } from '$lib/stores/uiState.svelte';
import * as AppModule from '$lib/wailsjs/go/main/App';

// --- Mocks ---

vi.mock('$lib/wailsjs/runtime/runtime', () => ({
	EventsOn: vi.fn()
}));

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

vi.mock('$lib/wailsjs/go/main/App', () => ({
	ImportNotesZip: vi.fn(),
	ExportNoteToFile: vi.fn(),
	ExportNotesZip: vi.fn(),
	UpdateMenuState: vi.fn(),
	SaveBackupFile: vi.fn(),
	ReadBackupFile: vi.fn()
}));

// --- Tests ---

describe('Menu Bridge System', () => {
    let mockNotesStore: NotesStore;
    let mockFolderStore: FolderStore;
    let mockSelectionStore: SelectionStore;

	beforeEach(() => {
		vi.clearAllMocks();
		// Mock Wails runtime for unit tests
		(window as any).runtime = {};
        mockFolderStore = new FolderStore();
        mockSelectionStore = new SelectionStore(mockFolderStore);
        mockNotesStore = new NotesStore();
	});

	describe('Initialization', () => {
		it('should initialize the bridge and register handlers', () => {
			const theme = new ThemeStore();
			const uiState = new UIStateStore();
			initMenuBridge({ 
				theme, 
				uiState,
				ui: mockUIStore as any,
				selection: mockSelectionStore,
                folders: mockFolderStore,
                notes: mockNotesStore,
				folderService: mockFolderService as any,
				noteService: mockNoteService as any,
				trashService: mockTrashService as any
			});
			expect(EventsOn).toHaveBeenCalled();
		});
	});

	describe('Import Logic', () => {
		it('should delegate path resolution and note creation to services during import', async () => {
			const importHandler = vi.fn();
			vi.mocked(EventsOn).mockImplementation((event, handler) => {
				if (event === 'menu:import-markdown') {
					importHandler.mockImplementation(handler);
				}
				return () => {};
			});

			vi.mocked(AppModule.ImportNotesZip).mockResolvedValue([
				{
					Title: 'Test Note',
					Content: 'Test Content',
					FolderPath: 'Folder A/Sub B'
				}
			]);

			vi.mocked(mockFolderService.ensurePath).mockReturnValue('target-folder-id');
			vi.mocked(mockNoteService.create).mockReturnValue({ id: 'new-note-id' } as any);

			const theme = new ThemeStore();
			const uiState = new UIStateStore();
			initMenuBridge({ 
				theme, 
				uiState,
				ui: mockUIStore as any,
				selection: mockSelectionStore,
                folders: mockFolderStore,
                notes: mockNotesStore,
				folderService: mockFolderService as any,
				noteService: mockNoteService as any,
				trashService: mockTrashService as any
			});
			await importHandler();

			expect(mockFolderService.ensurePath).toHaveBeenCalledWith('Folder A/Sub B');
			expect(mockNoteService.create).toHaveBeenCalledWith('target-folder-id', { silent: true });
			expect(mockNoteService.update).toHaveBeenCalledWith('new-note-id', {
				title: 'Test Note',
				content: 'Test Content'
			});
		});
	});

	describe('Markdown Export', () => {
		it('delegates single note export to service and wails bridge', async () => {
			const exportNoteHandler = vi.fn();
			vi.mocked(EventsOn).mockImplementation((event, handler) => {
				if (event === 'menu:export-note') {
					exportNoteHandler.mockImplementation(handler);
				}
				return () => {};
			});

			mockNotesStore.selectedNoteID = 'n1';
			vi.mocked(mockNoteService.getNotesForExport).mockResolvedValue([
				{ title: 'T1', content: 'C1', folderPath: '', updatedAt: '' }
			]);

			const theme = new ThemeStore();
			const uiState = new UIStateStore();
			initMenuBridge({ 
				theme, 
				uiState,
				ui: mockUIStore as any,
				selection: mockSelectionStore,
                folders: mockFolderStore,
                notes: mockNotesStore,
				folderService: mockFolderService as any,
				noteService: mockNoteService as any,
				trashService: mockTrashService as any
			});
			await exportNoteHandler();

			expect(mockNoteService.getNotesForExport).toHaveBeenCalledWith(['n1']);
			expect(AppModule.ExportNoteToFile).toHaveBeenCalledWith('T1', 'C1');
		});

		it('delegates bulk export to service and wails bridge', async () => {
			const exportAllHandler = vi.fn();
			vi.mocked(EventsOn).mockImplementation((event, handler) => {
				if (event === 'menu:export-all-markdown') {
					exportAllHandler.mockImplementation(handler);
				}
				return () => {};
			});

			const note1 = { id: '1', deletedAt: null };
			mockNotesStore.notes.set('1', note1 as any);
			
			const exportDtos = [{ title: 'Note 1', content: 'C1', folderPath: 'F1', updatedAt: '' }];
			vi.mocked(mockNoteService.getNotesForExport).mockResolvedValue(exportDtos);

			const theme = new ThemeStore();
			const uiState = new UIStateStore();
			initMenuBridge({ 
				theme, 
				uiState,
				ui: mockUIStore as any,
				selection: mockSelectionStore,
                folders: mockFolderStore,
                notes: mockNotesStore,
				folderService: mockFolderService as any,
				noteService: mockNoteService as any,
				trashService: mockTrashService as any
			});
			await exportAllHandler();

			expect(mockNoteService.getNotesForExport).toHaveBeenCalledWith(['1']);
			expect(AppModule.ExportNotesZip).toHaveBeenCalledWith(exportDtos);
		});

		it('surfaces a user-visible error when single note export fails', async () => {
			const exportNoteHandler = vi.fn();
			vi.mocked(EventsOn).mockImplementation((event, handler) => {
				if (event === 'menu:export-note') {
					exportNoteHandler.mockImplementation(handler);
				}
				return () => {};
			});

			mockNotesStore.selectedNoteID = 'n1';
			vi.mocked(mockNoteService.getNotesForExport).mockRejectedValue(new Error('disk full'));

			const theme = new ThemeStore();
			const uiState = new UIStateStore();
			initMenuBridge({
				theme,
				uiState,
				ui: mockUIStore as any,
				selection: mockSelectionStore,
				folders: mockFolderStore,
				notes: mockNotesStore,
				folderService: mockFolderService as any,
				noteService: mockNoteService as any,
				trashService: mockTrashService as any
			});

			await exportNoteHandler();

			expect(mockUIStore.showOperationError).toHaveBeenCalledWith(
				'Export Current Note Failed',
				expect.stringContaining('disk full')
			);
		});
	});

	describe('Backup Import/Export Errors', () => {
		it('flushes pending note writes before backup export reads IndexedDB', async () => {
			const exportBackupHandler = vi.fn();
			vi.mocked(EventsOn).mockImplementation((event, handler) => {
				if (event === 'menu:export-backup') {
					exportBackupHandler.mockImplementation(handler);
				}
				return () => {};
			});
			const flushSpy = vi
				.spyOn(mockNotesStore, 'flushAllPendingWrites')
				.mockResolvedValue(undefined);

			const theme = new ThemeStore();
			const uiState = new UIStateStore();
			initMenuBridge({
				theme,
				uiState,
				ui: mockUIStore as any,
				selection: mockSelectionStore,
				folders: mockFolderStore,
				notes: mockNotesStore,
				folderService: mockFolderService as any,
				noteService: mockNoteService as any,
				trashService: mockTrashService as any
			});

			await exportBackupHandler();

			expect(flushSpy).toHaveBeenCalledOnce();
		});

		it('surfaces a user-visible error when backup export fails', async () => {
			const exportBackupHandler = vi.fn();
			vi.mocked(EventsOn).mockImplementation((event, handler) => {
				if (event === 'menu:export-backup') {
					exportBackupHandler.mockImplementation(handler);
				}
				return () => {};
			});

			const theme = new ThemeStore();
			const uiState = new UIStateStore();
			initMenuBridge({
				theme,
				uiState,
				ui: mockUIStore as any,
				selection: mockSelectionStore,
				folders: mockFolderStore,
				notes: mockNotesStore,
				folderService: mockFolderService as any,
				noteService: mockNoteService as any,
				trashService: mockTrashService as any
			});

			await exportBackupHandler();

			expect(mockUIStore.showOperationError).toHaveBeenCalledWith(
				'Export Backup Failed',
				expect.any(String)
			);
		});

		it('surfaces a user-visible error when backup import fails', async () => {
			const importBackupHandler = vi.fn();
			vi.mocked(EventsOn).mockImplementation((event, handler) => {
				if (event === 'menu:import-backup') {
					importBackupHandler.mockImplementation(handler);
				}
				return () => {};
			});

			vi.mocked(AppModule.ReadBackupFile).mockResolvedValue('{ bad json');

			const theme = new ThemeStore();
			const uiState = new UIStateStore();
			initMenuBridge({
				theme,
				uiState,
				ui: mockUIStore as any,
				selection: mockSelectionStore,
				folders: mockFolderStore,
				notes: mockNotesStore,
				folderService: mockFolderService as any,
				noteService: mockNoteService as any,
				trashService: mockTrashService as any
			});

			await importBackupHandler();

			expect(mockUIStore.showOperationError).toHaveBeenCalledWith(
				'Import Backup Failed',
				expect.stringContaining('Failed to import backup')
			);
		});
	});

	describe('Menu State Effect', () => {
		let cleanup: (() => void) | null = null;

		afterEach(() => {
			if (cleanup) {
				cleanup();
				cleanup = null;
			}
		});

		it('calls UpdateMenuState with HasSelectedNote false when no note selected', async () => {
			const theme = new ThemeStore();
		cleanup = initMenuStateEffect({ theme, notes: mockNotesStore });
			flushSync();

			expect(AppModule.UpdateMenuState).toHaveBeenCalled();
			const call = (AppModule.UpdateMenuState as any).mock.calls[0];
			const menuState = call[0];
			expect(menuState.HasSelectedNote).toBe(false);
		});

		it('calls UpdateMenuState with HasSelectedNote true when note selected', async () => {
			const testNote = { id: 'note-1', deletedAt: null };
			mockNotesStore.notes.set('note-1', testNote as any);
			mockNotesStore.selectedNoteID = 'note-1';

			const theme = new ThemeStore();
		cleanup = initMenuStateEffect({ theme, notes: mockNotesStore });
			flushSync();

			expect(AppModule.UpdateMenuState).toHaveBeenCalled();
			const calls = (AppModule.UpdateMenuState as any).mock.calls;
			const lastCall = calls[calls.length - 1];
			const menuState = lastCall[0];
			expect(menuState.HasSelectedNote).toBe(true);
		});

		it('calls UpdateMenuState with SelectedNoteInTrash true when selected note is deleted', async () => {
			const testNote = { id: 'note-1', deletedAt: Date.now() };
			mockNotesStore.notes.set('note-1', testNote as any);
			mockNotesStore.selectedNoteID = 'note-1';
			mockNotesStore.trashCount = 1;

			const theme = new ThemeStore();
		cleanup = initMenuStateEffect({ theme, notes: mockNotesStore });
			flushSync();

			const calls = (AppModule.UpdateMenuState as any).mock.calls;
			const menuState = calls[calls.length - 1][0];
			expect(menuState.SelectedNoteInTrash).toBe(true);
		});

		it('calls UpdateMenuState with TrashHasItems true when trash count > 0', async () => {
			mockNotesStore.trashCount = 2;

			const theme = new ThemeStore();
		cleanup = initMenuStateEffect({ theme, notes: mockNotesStore });
			flushSync();

			const calls = (AppModule.UpdateMenuState as any).mock.calls;
			const menuState = calls[calls.length - 1][0];
			expect(menuState.TrashHasItems).toBe(true);
		});

		it('calls UpdateMenuState with correct theme', async () => {
			const theme = new ThemeStore();
			theme.init('dark');

			cleanup = initMenuStateEffect({ theme, notes: mockNotesStore });
			flushSync();

			const calls = (AppModule.UpdateMenuState as any).mock.calls;
			const menuState = calls[calls.length - 1][0];
			expect(menuState.Theme).toBe('dark');
		});
	});
});
