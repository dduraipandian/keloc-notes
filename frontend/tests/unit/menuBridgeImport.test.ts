import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initMenuBridge } from '$lib/menu/menuBridge.svelte';
import { EventsOn } from '$lib/wailsjs/runtime/runtime';
import { folderService, noteService } from '$lib/stores/services';

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

describe('menuBridge Import Logic', () => {
	it('should delegate path resolution and note creation to services during import', async () => {
		const importHandler = vi.fn();
		vi.mocked(EventsOn).mockImplementation((event, handler) => {
			if (event === 'menu:import-markdown') {
				importHandler.mockImplementation(handler);
			}
			return () => {};
		});

		const { ImportNotesZip } = await import('../../src/lib/wailsjs/go/main/App');
		vi.mocked(ImportNotesZip).mockResolvedValue([
			{
				Title: 'Test Note',
				Content: 'Test Content',
				FolderPath: 'Folder A/Sub B'
			}
		]);

		vi.mocked(folderService.ensurePath).mockReturnValue('target-folder-id');
		vi.mocked(noteService.create).mockReturnValue({ id: 'new-note-id' } as any);

		initMenuBridge();

		// Simulate the event
		await importHandler();

		// Verify bridge delegates to ensurePath
		expect(folderService.ensurePath).toHaveBeenCalledWith('Folder A/Sub B');
		
		// Verify bridge delegates note creation to target folder
		expect(noteService.create).toHaveBeenCalledWith('target-folder-id', { silent: true });
		
		// Verify bridge updates note content
		expect(noteService.update).toHaveBeenCalledWith('new-note-id', {
			title: 'Test Note',
			content: 'Test Content'
		});
	});
});
