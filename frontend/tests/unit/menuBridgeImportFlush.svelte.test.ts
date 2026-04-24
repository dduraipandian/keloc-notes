import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initMenuBridge } from '$lib/menu/menuBridge.svelte';
import { EventsOn } from '$lib/wailsjs/runtime/runtime';
import { ThemeStore } from '$lib/stores/theme.svelte';
import { UIStateStore } from '$lib/stores/uiState.svelte';
import { FolderStore } from '$lib/stores/folders.svelte';
import { NotesStore } from '$lib/stores/notes.svelte';
import { SelectionStore } from '$lib/stores/selection.svelte';
import * as AppModule from '$lib/wailsjs/go/main/App';
import { importBackup } from '$lib/backup/backup';

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

vi.mock('$lib/backup/backup', () => ({
	exportBackup: vi.fn(),
	importBackup: vi.fn()
}));

describe('menu bridge import flush policy', () => {
	const mockFolderService = {
		create: vi.fn(),
		ensurePath: vi.fn(),
		getPlainFolderPath: vi.fn()
	};
	const mockNoteService = {
		create: vi.fn(),
		update: vi.fn(),
		getNotesForExport: vi.fn()
	};
	const mockTrashService = {
		emptyTrash: vi.fn()
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
	let markdownImportHandler: (() => Promise<void>) | undefined;
	let backupImportHandler: (() => Promise<void>) | undefined;

	beforeEach(() => {
		vi.clearAllMocks();
		uiState = new UIStateStore();
		folders = new FolderStore();
		notes = new NotesStore();
		selection = new SelectionStore(folders);
		markdownImportHandler = undefined;
		backupImportHandler = undefined;

		vi.spyOn(notes, 'flushAllPendingWrites').mockResolvedValue(undefined);
		vi.mocked(mockFolderService.ensurePath).mockReturnValue('folder-1');
		vi.mocked(mockNoteService.create).mockReturnValue({ id: 'new-note-id' } as any);
		vi.mocked(importBackup).mockResolvedValue(undefined);

		vi.mocked(EventsOn).mockImplementation((event, handler) => {
			if (event === 'menu:import-markdown') {
				markdownImportHandler = handler as () => Promise<void>;
			}
			if (event === 'menu:import-backup') {
				backupImportHandler = handler as () => Promise<void>;
			}
			return () => {};
		});
	});

	function initBridge() {
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
	}

	it('flushes imported markdown note writes before the import handler settles', async () => {
		vi.mocked(AppModule.ImportNotesZip).mockResolvedValue([
			{
				Title: 'Imported Note',
				Content: '# Imported',
				FolderPath: '',
				Assets: []
			}
		] as any);

		initBridge();
		await markdownImportHandler?.();

		expect(mockNoteService.update).toHaveBeenCalledWith('new-note-id', {
			title: 'Imported Note',
			content: '# Imported'
		});
		expect(notes.flushAllPendingWrites).toHaveBeenCalledTimes(1);
	});

	it('flushes pending writes before backup import reads and restores a backup file', async () => {
		vi.mocked(AppModule.ReadBackupFile).mockResolvedValue('{"schemaVersion":1}');

		initBridge();
		await backupImportHandler?.();

		expect(notes.flushAllPendingWrites).toHaveBeenCalledBefore(AppModule.ReadBackupFile as any);
		expect(importBackup).toHaveBeenCalledWith('{"schemaVersion":1}', folders, notes);
	});
});
