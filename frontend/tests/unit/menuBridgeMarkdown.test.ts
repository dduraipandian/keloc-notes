import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initMenuBridge } from '$lib/menu/menuBridge.svelte';
import { EventsOn } from '$lib/wailsjs/runtime/runtime';
import { noteService } from '$lib/stores/services';
import { notesStore } from '$lib/stores/notes.svelte';
import { ExportNoteToFile, ExportNotesZip } from '$lib/wailsjs/go/main/App';

vi.mock('$lib/wailsjs/runtime/runtime', () => ({
	EventsOn: vi.fn()
}));

vi.mock('$lib/stores/services', () => ({
	noteService: {
		getNotesForExport: vi.fn(),
		create: vi.fn(),
		update: vi.fn()
	},
	folderService: {
		ensurePath: vi.fn()
	},
	trashService: {}
}));

vi.mock('$lib/wailsjs/go/main/App', () => ({
	ExportNoteToFile: vi.fn(),
	ExportNotesZip: vi.fn(),
	UpdateMenuState: vi.fn(),
	SaveBackupFile: vi.fn(),
	ReadBackupFile: vi.fn(),
	ImportNotesZip: vi.fn()
}));

describe('Menu Bridge - Markdown Export', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

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
		expect(ExportNoteToFile).toHaveBeenCalledWith('T1', 'C1');
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
		expect(ExportNotesZip).toHaveBeenCalledWith(exportDtos);
	});
});
