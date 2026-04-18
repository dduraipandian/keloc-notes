import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initMenuBridge } from '../../src/lib/menu/menuBridge.svelte';
import { EventsOn } from '../../src/lib/wailsjs/runtime/runtime';
import { folderService, noteService } from '../../src/lib/stores/services';
import { folderStore } from '../../src/lib/stores/folders.svelte';

vi.mock('../../src/lib/wailsjs/runtime/runtime', () => ({
	EventsOn: vi.fn()
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

vi.mock('../../src/lib/stores/selection.svelte', () => ({
	selectionStore: {
		selectedFolderID: null
	}
}));

describe('menuBridge Import Logic', () => {
	it('should create folders and notes deterministically during import', async () => {
		const importHandler = vi.fn();
		vi.mocked(EventsOn).mockImplementation((event, handler) => {
			if (event === 'menu:import-markdown') {
				importHandler.mockImplementation(handler);
			}
			return () => {};
		});

		// Mock the App.ImportNotesZip import
		vi.doMock('../../src/lib/wailsjs/go/main/App', () => ({
			ImportNotesZip: vi.fn().mockResolvedValue([
				{
					Title: 'Test Note',
					Content: 'Test Content',
					FolderPath: 'Folder A/Sub B'
				}
			])
		}));

		initMenuBridge();

		// Simulate the event
		await importHandler();

		// Verify folder creation (Folder A then Sub B)
		expect(folderService.create).toHaveBeenCalledTimes(2);
		expect(folderService.create).toHaveBeenNthCalledWith(1, null); // Root
		// First mock returns id1
		vi.mocked(folderService.create).mockReturnValueOnce('id1').mockReturnValueOnce('id2');
		
		// Note: The actual test execution with the real handler will happen after refactor.
		// For now this is just to establish the TDD expectation.
	});
});
