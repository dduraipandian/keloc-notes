import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushSync } from 'svelte';
import { initMenuBridge, initMenuStateEffect } from '$lib/menu/menuBridge.svelte';
import { EventsOn } from '$lib/wailsjs/runtime/runtime';
import { folderService, noteService } from '$lib/stores/services';
import { notesStore } from '$lib/stores/notes.svelte';
import { themeStore } from '$lib/stores/theme.svelte';
import * as AppModule from '$lib/wailsjs/go/main/App';

// --- Mocks ---

vi.mock('$lib/wailsjs/runtime/runtime', () => ({
	EventsOn: vi.fn()
}));

vi.mock('$lib/stores/services', () => ({
	folderService: {
		create: vi.fn(),
		rename: vi.fn(),
		ensurePath: vi.fn()
	},
	noteService: {
		create: vi.fn(),
		update: vi.fn(),
		getNotesForExport: vi.fn()
	},
	trashService: {}
}));

vi.mock('$lib/stores/folders.svelte', () => ({
	folderStore: {
		folders: new Map(),
		findItemById: vi.fn(),
		getPathForFolder: vi.fn()
	}
}));

vi.mock('$lib/stores/selection.svelte', () => ({
	selectionStore: {
		selectedFolderID: null
	}
}));

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
	beforeEach(() => {
		vi.clearAllMocks();
		// Mock Wails runtime for unit tests
		(window as any).runtime = {};
		notesStore.notes.clear();
		notesStore.selectedNoteID = null;
		notesStore.trashCount = 0;
		themeStore.init('system');
	});

	describe('Initialization', () => {
		it('should initialize the bridge and register handlers', () => {
			initMenuBridge();
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

			vi.mocked(folderService.ensurePath).mockReturnValue('target-folder-id');
			vi.mocked(noteService.create).mockReturnValue({ id: 'new-note-id' } as any);

			initMenuBridge();
			await importHandler();

			expect(folderService.ensurePath).toHaveBeenCalledWith('Folder A/Sub B');
			expect(noteService.create).toHaveBeenCalledWith('target-folder-id', { silent: true });
			expect(noteService.update).toHaveBeenCalledWith('new-note-id', {
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

			notesStore.selectedNoteID = 'n1';
			vi.mocked(noteService.getNotesForExport).mockResolvedValue([
				{ title: 'T1', content: 'C1', folderPath: '', updatedAt: '' }
			]);

			initMenuBridge();
			await exportNoteHandler();

			expect(noteService.getNotesForExport).toHaveBeenCalledWith(['n1']);
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
			notesStore.notes.set('1', note1 as any);
			
			const exportDtos = [{ title: 'Note 1', content: 'C1', folderPath: 'F1', updatedAt: '' }];
			vi.mocked(noteService.getNotesForExport).mockResolvedValue(exportDtos);

			initMenuBridge();
			await exportAllHandler();

			expect(noteService.getNotesForExport).toHaveBeenCalledWith(['1']);
			expect(AppModule.ExportNotesZip).toHaveBeenCalledWith(exportDtos);
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
			cleanup = initMenuStateEffect();
			flushSync();

			expect(AppModule.UpdateMenuState).toHaveBeenCalled();
			const call = (AppModule.UpdateMenuState as any).mock.calls[0];
			const menuState = call[0];
			expect(menuState.HasSelectedNote).toBe(false);
		});

		it('calls UpdateMenuState with HasSelectedNote true when note selected', async () => {
			const testNote = { id: 'note-1', deletedAt: null };
			notesStore.notes.set('note-1', testNote as any);
			notesStore.selectedNoteID = 'note-1';

			cleanup = initMenuStateEffect();
			flushSync();

			expect(AppModule.UpdateMenuState).toHaveBeenCalled();
			const calls = (AppModule.UpdateMenuState as any).mock.calls;
			const lastCall = calls[calls.length - 1];
			const menuState = lastCall[0];
			expect(menuState.HasSelectedNote).toBe(true);
		});

		it('calls UpdateMenuState with SelectedNoteInTrash true when selected note is deleted', async () => {
			const testNote = { id: 'note-1', deletedAt: Date.now() };
			notesStore.notes.set('note-1', testNote as any);
			notesStore.selectedNoteID = 'note-1';
			notesStore.trashCount = 1;

			cleanup = initMenuStateEffect();
			flushSync();

			const calls = (AppModule.UpdateMenuState as any).mock.calls;
			const menuState = calls[calls.length - 1][0];
			expect(menuState.SelectedNoteInTrash).toBe(true);
		});

		it('calls UpdateMenuState with TrashHasItems true when trash count > 0', async () => {
			notesStore.trashCount = 2;

			cleanup = initMenuStateEffect();
			flushSync();

			const calls = (AppModule.UpdateMenuState as any).mock.calls;
			const menuState = calls[calls.length - 1][0];
			expect(menuState.TrashHasItems).toBe(true);
		});

		it('calls UpdateMenuState with correct theme', async () => {
			themeStore.init('dark');

			cleanup = initMenuStateEffect();
			flushSync();

			const calls = (AppModule.UpdateMenuState as any).mock.calls;
			const menuState = calls[calls.length - 1][0];
			expect(menuState.Theme).toBe('dark');
		});
	});
});
