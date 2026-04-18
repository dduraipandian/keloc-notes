import { describe, it, expect, vi, beforeEach } from 'vitest';
import { notesStore } from '../../src/lib/stores/notes.svelte';
import { folderStore } from '../../src/lib/stores/folders.svelte';
import { folderService, noteService } from '../../src/lib/stores/services';
import { EventsOn } from '../../src/lib/wailsjs/runtime/runtime';

vi.mock('../../src/lib/wailsjs/runtime/runtime', () => ({
	EventsOn: vi.fn(),
	EventsEmit: vi.fn()
}));

vi.mock('../../src/lib/stores/services', () => ({
	folderService: {
		create: vi.fn(),
		rename: vi.fn()
	},
	noteService: {
		create: vi.fn(),
		update: vi.fn()
	},
	trashService: {}
}));

vi.mock('../../src/lib/stores/folders.svelte', () => ({
	folderStore: {
		folders: new Map(),
		findItemById: vi.fn(),
		getPathForFolder: vi.fn()
	}
}));

describe('Import Mismatch Bug (RED)', () => {
	it('should pass the string ID to noteService.update, not the full object', async () => {
		const handlers: Record<string, Function> = {};
		vi.mocked(EventsOn).mockImplementation((event, handler) => {
			handlers[event] = handler;
			return () => {};
		});

		// Mock the App.ImportNotesZip import
		vi.doMock('../../src/lib/wailsjs/go/main/App', () => ({
			ImportNotesZip: vi.fn().mockResolvedValue([
				{
					Title: 'Imported Note',
					Content: 'Imported Content',
					FolderPath: ''
				}
			])
		}));

		// Mock NoteService.create to return an OBJECT (as it currently does in real implementation)
		const mockNote = { id: 'new-id-123', title: 'Untitled Note' };
		vi.mocked(noteService.create).mockReturnValue(mockNote as any);

		const { initMenuBridge } = await import('../../src/lib/menu/menuBridge.svelte');
		initMenuBridge();

		// Trigger import
		await handlers['menu:import-markdown']();

		// EXPECTATION: The bug is that we pass mockNote (object) instead of mockNote.id (string)
		// This assertion is designed to fail if the bug is present.
		expect(noteService.update).toHaveBeenCalledWith('new-id-123', expect.objectContaining({
			title: 'Imported Note'
		}));

		// Verify silent mode is used for scalability
		expect(noteService.create).toHaveBeenCalledWith(null, expect.objectContaining({ silent: true }));
	});
});
