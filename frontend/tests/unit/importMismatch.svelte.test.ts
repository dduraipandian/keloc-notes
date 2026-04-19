import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initMenuBridge } from '$lib/menu/menuBridge.svelte';
import { EventsOn } from '$lib/wailsjs/runtime/runtime';
import { folderService, noteService } from '$lib/stores/services';
import { ImportNotesZip } from '$lib/wailsjs/go/main/App';

vi.mock('$lib/wailsjs/runtime/runtime', () => ({
	EventsOn: vi.fn(),
	EventsEmit: vi.fn()
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

vi.mock('$lib/wailsjs/go/main/App', () => ({
	ImportNotesZip: vi.fn(),
	ExportNoteToFile: vi.fn(),
	ExportNotesZip: vi.fn(),
	UpdateMenuState: vi.fn(),
	SaveBackupFile: vi.fn(),
	ReadBackupFile: vi.fn()
}));

describe('Import Mismatch Bug (RED)', () => {
	it('should pass the string ID to noteService.update, not the full object', async () => {
		const handlers: Record<string, Function> = {};
		vi.mocked(EventsOn).mockImplementation((event, handler) => {
			handlers[event] = handler;
			return () => {};
		});

		vi.mocked(ImportNotesZip).mockResolvedValue([
			{
				Title: 'Imported Note',
				Content: 'Imported Content',
				FolderPath: ''
			}
		]);

		vi.mocked(folderService.ensurePath).mockReturnValue(null);

		// Mock NoteService.create to return an OBJECT (as it currently does in real implementation)
		const mockNote = { id: 'new-id-123', title: 'Untitled Note' };
		vi.mocked(noteService.create).mockReturnValue(mockNote as any);

		initMenuBridge();

		// Trigger import
		await handlers['menu:import-markdown']();

		// EXPECTATION: The bug is that we pass mockNote (object) instead of mockNote.id (string)
		expect(noteService.update).toHaveBeenCalledWith('new-id-123', expect.objectContaining({
			title: 'Imported Note'
		}));

		// Verify silent mode is used for scalability
		expect(noteService.create).toHaveBeenCalledWith(null, expect.objectContaining({ silent: true }));
	});
});
