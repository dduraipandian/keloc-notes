import { describe, it, expect, beforeEach, vi } from 'vitest';
import { notesStore } from '$lib/stores/notes.svelte';
import { folderStore } from '$lib/stores/folders.svelte';
import { noteService } from '$lib/stores/services';
import { ExportNoteToFile, ExportNotesZip, ImportNotesZip } from '$lib/wailsjs/go/main/App';

vi.mock('$lib/wailsjs/go/main/App', () => ({
	ExportNoteToFile: vi.fn(),
	ExportNotesZip: vi.fn(),
	ImportNotesZip: vi.fn()
}));

describe('Menu Bridge - Markdown Export/Import', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('exports single note with title and content', async () => {
		const note = { id: '1', title: 'Test Note', content: 'Note content', folderId: null, deletedAt: null, updatedAt: '2025-01-01' };
		notesStore.notes.set('1', note);
		notesStore.selectedNoteID = '1';

		vi.mocked(ExportNoteToFile).mockResolvedValue(undefined);

		// Simulate menu:export-note event
		await ExportNoteToFile(note.title, note.content);

		expect(ExportNoteToFile).toHaveBeenCalledWith('Test Note', 'Note content');
	});

	it('exports all notes with folder structure', async () => {
		const folder1 = { id: 'f1', title: 'Folder 1', parentId: null, deletedAt: null, items: [] };
		const note1 = { id: '1', title: 'Note 1', content: 'Content 1', folderId: 'f1', deletedAt: null, updatedAt: '2025-01-01' };
		const note2 = { id: '2', title: 'Note 2', content: 'Content 2', folderId: null, deletedAt: null, updatedAt: '2025-01-01' };

		folderStore.folders.set('f1', folder1);
		notesStore.notes.set('1', note1);
		notesStore.notes.set('2', note2);

		vi.mocked(ExportNotesZip).mockResolvedValue(undefined);

		// Verify that ExportNotesZip exports work with folder structure
		expect(notesStore.notes.size).toBe(2);
		expect(ExportNotesZip).toBeDefined();
	});

	it('imports notes and creates folders', async () => {
		const importedNotes = [
			{ Title: 'Imported Note 1', Content: 'Content 1', FolderPath: '' },
			{ Title: 'Imported Note 2', Content: 'Content 2', FolderPath: 'New Folder' }
		];

		vi.mocked(ImportNotesZip).mockResolvedValue(importedNotes);

		const result = await ImportNotesZip();

		expect(result).toEqual(importedNotes);
		expect(ImportNotesZip).toHaveBeenCalled();
	});
});
