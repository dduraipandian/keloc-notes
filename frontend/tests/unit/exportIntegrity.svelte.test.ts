import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NoteService } from '../../src/lib/stores/services/noteService';
import { notesStore } from '../../src/lib/stores/notes.svelte';
import { notesRepository } from '../../src/lib/stores/repositories';

vi.mock('../../src/lib/stores/repositories', () => ({
	notesRepository: {
		getBulkContents: vi.fn(),
		saveMeta: vi.fn(),
		saveContent: vi.fn(),
		list: vi.fn(),
		getContent: vi.fn()
	}
}));

vi.mock('../../src/lib/stores/folders.svelte', () => ({
	folderStore: {
		folders: new Map(),
		findItemById: vi.fn(),
		getPathForFolder: vi.fn(),
		getDefaultFolderId: vi.fn()
	}
}));

vi.mock('../../src/lib/stores/selection.svelte', () => ({
	selectionStore: {
		getSelectedFolder: vi.fn(),
		selectedFolderID: null,
		selectFolder: vi.fn()
	}
}));

describe('NoteService Export Harvesting (TDD)', () => {
	let noteService: NoteService;

	beforeEach(() => {
		vi.resetAllMocks();
		notesStore.notes.clear();
		noteService = new NoteService();
	});

	it('should merge content from repository when content is missing in memory (RED)', async () => {
		const noteId = 'target-id';
		notesStore.notes.set(noteId, {
			id: noteId,
			title: 'Test Note',
			content: '', // Empty in memory
			updatedAt: new Date().toISOString(),
			isContentLoaded: false,
			folderId: null,
			summary: 'Summary'
		});

		// Mock repository to return the actual content
		vi.mocked(notesRepository.getBulkContents).mockResolvedValue({
			[noteId]: 'Actual Content from IDB'
		});

		const exportData = await noteService.getExportData([noteId]);

		// This is expected to fail with the current stub
		expect(exportData[0].content).toBe('Actual Content from IDB');
	});
});
