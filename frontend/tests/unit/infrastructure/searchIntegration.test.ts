import { describe, it, expect, beforeEach, vi } from 'vitest';
import { noteListView } from '../../../src/lib/views/noteListView.svelte';
import { noteService, searchService } from '../../../src/lib/stores/services';
import { notesRepository } from '../../../src/lib/stores/repositories';
import { folderStore } from '../../../src/lib/stores/folders.svelte';
import { notesStore } from '../../../src/lib/stores/notes.svelte';

const NOW = new Date().toISOString();

describe('Search Integration (Phase 2)', () => {
	beforeEach(() => {
		vi.resetAllMocks();
		// Reset search service state
		(searchService as any).indexedFolderIds = new Set();
		(searchService as any).index.removeAll();
		(searchService as any).version = 0;
	});

	it('should find notes by content (Full Text Search)', async () => {
		const noteId = 'note-1';
		const noteTitle = 'Welcome';
		const noteContent = 'This is a special secret word: Xylophone';
		const folderId = 'root';

		// 1. Setup Data Layer Mocks
		const mockNote = { id: noteId, title: noteTitle, summary: '', updatedAt: '', folderId };
		vi.spyOn(noteService, 'getNotesForFolder').mockReturnValue([mockNote as any]);
		vi.spyOn(notesStore, 'getNote').mockReturnValue(mockNote as any);
		vi.spyOn(notesStore, 'listNotes').mockReturnValue([mockNote as any]);
		vi.spyOn(folderStore, 'findItemById').mockReturnValue({ id: folderId, items: [] } as any);
		
		// Mock bulk retrieval
		vi.spyOn(notesRepository, 'getBulkContents').mockResolvedValue({
			[noteId]: noteContent
		});

		// 2. Perform Search
		noteListView.setSearchQuery('Xylophone');
		
		// Wait for debounce 
		await new Promise(r => setTimeout(r, 200));

		// 3. Trigger filtering (which triggers indexing in Phase 2)
		const results = noteListView.getFilteredNotes();
		
		// Since indexing is async, we may need to wait for the indexer
		// or check if it triggered.
		
		// In our implementation, ensuring index is async, but results populate
		// when indexing completes. Let's wait a bit for the async indexing.
		await new Promise(r => setTimeout(r, 100));
		
		// Now re-run filtering to get results from the indexed version
		const finalResults = noteListView.getFilteredNotes();
		
		expect(finalResults.map(n => n.id)).toContain(noteId);
	});

	it('should NOT find "good" when searching for "God" (strictly match)', async () => {
		const noteId = 'note-2';
		const noteTitle = 'Notes';
		const noteContent = 'This is a good day';
		const folderId = 'root';

		const mockNote = { id: noteId, title: noteTitle, summary: '', updatedAt: NOW, folderId };
		vi.spyOn(noteService, 'getNotesForFolder').mockReturnValue([mockNote as any]);
		vi.spyOn(notesStore, 'getNote').mockReturnValue(mockNote as any);
		vi.spyOn(notesStore, 'listNotes').mockReturnValue([mockNote as any]);
		vi.spyOn(folderStore, 'findItemById').mockReturnValue({ id: folderId, items: [] } as any);
		vi.spyOn(notesRepository, 'getBulkContents').mockResolvedValue({ [noteId]: noteContent });

		noteListView.setSearchQuery('God');
		await new Promise(r => setTimeout(r, 200));
		
		// Trigger filtering
		noteListView.getFilteredNotes();
		await new Promise(r => setTimeout(r, 100));
		
		const finalResults = noteListView.getFilteredNotes();
		
		// This should be empty if fuzzy is disabled
		expect(finalResults.map(n => n.id)).not.toContain(noteId);
	});
});
