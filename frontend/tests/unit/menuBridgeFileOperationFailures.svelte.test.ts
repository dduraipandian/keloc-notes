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

describe('menu bridge file operation failure guidance', () => {
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
	let exportNoteHandler: (() => Promise<void>) | undefined;
	let importBackupHandler: (() => Promise<void>) | undefined;

	beforeEach(() => {
		vi.clearAllMocks();
		uiState = new UIStateStore();
		folders = new FolderStore();
		notes = new NotesStore();
		selection = new SelectionStore(folders);
		exportNoteHandler = undefined;
		importBackupHandler = undefined;

		notes.notes.set('note-1', {
			id: 'note-1',
			folderId: null,
			title: 'Roadmap',
			summary: '',
			updatedAt: '2026-04-25T00:00:00.000Z',
			deletedAt: null,
			deletedBatchId: null,
			content: '',
			isFavorite: false,
			isContentLoaded: false
		} as any);
		notes.selectedNoteID = 'note-1';
		vi.spyOn(notes, 'flushAllPendingWrites').mockResolvedValue(undefined);

		vi.mocked(EventsOn).mockImplementation((event, handler) => {
			if (event === 'menu:export-note') {
				exportNoteHandler = handler as () => Promise<void>;
			}
			if (event === 'menu:import-backup') {
				importBackupHandler = handler as () => Promise<void>;
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

	it('shows current-note export failures with local data, file, and retry guidance', async () => {
		vi.mocked(mockNoteService.getNotesForExport).mockResolvedValue([
			{ title: 'Roadmap', content: '# Roadmap', folderPath: '', updatedAt: '', assets: [] }
		]);
		vi.mocked(AppModule.ExportNoteToFile).mockRejectedValue(new Error('permission denied'));

		initBridge();
		await exportNoteHandler?.();

		expect(mockUIStore.showOperationError).toHaveBeenCalledWith(
			'Export Current Note Failed',
			expect.stringContaining('Local notes were not changed.')
		);
		expect(mockUIStore.showOperationError).toHaveBeenCalledWith(
			'Export Current Note Failed',
			expect.stringContaining('The Markdown file may not have been written.')
		);
		expect(mockUIStore.showOperationError).toHaveBeenCalledWith(
			'Export Current Note Failed',
			expect.stringContaining('You can retry')
		);
	});

	it('shows backup import failures with restore safety and retry guidance', async () => {
		vi.mocked(AppModule.ReadBackupFile).mockResolvedValue('{"schemaVersion":999}');

		initBridge();
		await importBackupHandler?.();

		expect(mockUIStore.showOperationError).toHaveBeenCalledWith(
			'Import Backup Failed',
			expect.stringContaining('Local notes remain unchanged')
		);
		expect(mockUIStore.showOperationError).toHaveBeenCalledWith(
			'Import Backup Failed',
			expect.stringContaining('No app-created file is expected from this import.')
		);
		expect(mockUIStore.showOperationError).toHaveBeenCalledWith(
			'Import Backup Failed',
			expect.stringContaining('You can retry')
		);
	});
});
