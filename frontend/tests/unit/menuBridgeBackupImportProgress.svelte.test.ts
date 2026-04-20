import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initMenuBridge } from '$lib/menu/menuBridge.svelte';
import { EventsOn } from '$lib/wailsjs/runtime/runtime';
import { UIStateStore } from '$lib/stores/uiState.svelte';
import { ThemeStore } from '$lib/stores/theme.svelte';
import { FolderStore } from '$lib/stores/folders.svelte';
import { NotesStore } from '$lib/stores/notes.svelte';
import { SelectionStore } from '$lib/stores/selection.svelte';
import * as AppModule from '$lib/wailsjs/go/main/App';
import { importBackup } from '$lib/backup/backup';

vi.mock('$lib/wailsjs/runtime/runtime', () => ({
	EventsOn: vi.fn()
}));

vi.mock('$lib/wailsjs/go/main/App', () => ({
	ReadBackupFile: vi.fn()
}));

vi.mock('$lib/backup/backup', () => ({
	importBackup: vi.fn()
}));

describe('Menu bridge backup import progress', () => {
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
	let reloadSpy: () => void;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		uiState = new UIStateStore();
		folders = new FolderStore();
		notes = new NotesStore();
		selection = new SelectionStore(folders);
		reloadSpy = vi.fn();
		importHandler = undefined;

		vi.mocked(EventsOn).mockImplementation((event, handler) => {
			if (event === 'menu:import-backup') {
				importHandler = handler as () => Promise<void>;
			}
			return () => {};
		});
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('shows importing and reloading states before reloading on successful backup import', async () => {
		vi.mocked(AppModule.ReadBackupFile).mockResolvedValue(
			JSON.stringify({
				schemaVersion: 1,
				exportedAt: '2025-04-01T00:00:00.000Z',
				appVersion: '1.0.0',
				folders: [],
				notes: [],
				settings: {}
			})
		);

		initMenuBridge(
			{
				uiState,
				theme: new ThemeStore(),
				ui: mockUIStore as any,
				selection,
				folders,
				notes,
				folderService: mockFolderService as any,
				noteService: mockNoteService as any,
				trashService: mockTrashService as any
			},
			{
				onReload: reloadSpy
			}
		);

		const runImport = importHandler?.();
		await Promise.resolve();
		expect(uiState.backupImportStatus).toEqual({
			active: true,
			title: 'Importing backup...',
			description: 'Rebuilding your library. The app will reopen when finished.'
		});

		await runImport;
		expect(uiState.backupImportStatus).toEqual({
			active: true,
			title: 'Import complete',
			description: 'Reloading your library...'
		});

		await vi.advanceTimersByTimeAsync(200);

		expect(reloadSpy).toHaveBeenCalledTimes(1);
	});

	it('ignores repeated backup import requests while one is already in progress', async () => {
		let resolveImport: (() => void) | undefined;
		vi.mocked(importBackup).mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					resolveImport = resolve;
				})
		);

		initMenuBridge(
			{
				uiState,
				theme: new ThemeStore(),
				ui: mockUIStore as any,
				selection,
				folders,
				notes,
				folderService: mockFolderService as any,
				noteService: mockNoteService as any,
				trashService: mockTrashService as any
			},
			{
				onReload: reloadSpy
			}
		);

		const firstImport = importHandler?.();
		await Promise.resolve();
		await importHandler?.();

		expect(AppModule.ReadBackupFile).toHaveBeenCalledTimes(1);

		if (resolveImport) {
			resolveImport();
		}
		await firstImport;
	});
});
