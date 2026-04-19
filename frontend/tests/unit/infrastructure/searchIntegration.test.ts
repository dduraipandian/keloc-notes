import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NoteListView } from '../../../src/lib/views/noteListView.svelte';
import { NoteService } from '../../../src/lib/stores/services/noteService';
import { SearchService } from '../../../src/lib/stores/searchService.svelte';
import { notesRepository } from '../../../src/lib/infrastructure/repositories';
import { FolderStore } from '../../../src/lib/stores/folders.svelte';
import { NotesStore } from '../../../src/lib/stores/notes.svelte';
import { SelectionStore } from '../../../src/lib/stores/selection.svelte';

const NOW = new Date().toISOString();

describe('Search Integration (Phase 2)', () => {
	let noteListView: NoteListView;
	let mockSearchService: SearchService;
	let mockNoteService: NoteService;
	let mockFolderStore: FolderStore;
	let mockNotesStore: NotesStore;
	let mockSelectionStore: SelectionStore;

	beforeEach(() => {
		mockFolderStore = new FolderStore();
		mockSelectionStore = new SelectionStore(mockFolderStore);
		mockNotesStore = new NotesStore();
		mockNoteService = new NoteService(mockFolderStore, mockNotesStore, mockSelectionStore);
		mockSearchService = new SearchService(mockFolderStore, mockNotesStore, mockNoteService);
		noteListView = new NoteListView(
			{ selection: mockSelectionStore },
			mockFolderStore,
			mockNotesStore,
			{} as any,
			mockNoteService,
			mockSearchService
		);
		vi.resetAllMocks();
	});

	it('should find notes by content (Full Text Search)', async () => {
		const noteId = 'note-1';
		const noteTitle = 'Welcome';
		const noteContent = 'This is a special secret word: Xylophone';
		const folderId = 'root';

		// 1. Setup Data Layer Mocks
		const mockNote = { id: noteId, title: noteTitle, summary: '', updatedAt: '', folderId };
		vi.spyOn(mockNoteService, 'getNotesForFolder').mockReturnValue([mockNote as any]);
		vi.spyOn(mockNotesStore, 'getNote').mockReturnValue(mockNote as any);
		vi.spyOn(mockNotesStore, 'listNotes').mockReturnValue([mockNote as any]);
		vi.spyOn(mockFolderStore, 'findItemById').mockReturnValue({ id: folderId, items: [] } as any);
		
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
		vi.spyOn(mockNoteService, 'getNotesForFolder').mockReturnValue([mockNote as any]);
		vi.spyOn(mockNotesStore, 'getNote').mockReturnValue(mockNote as any);
		vi.spyOn(mockNotesStore, 'listNotes').mockReturnValue([mockNote as any]);
		vi.spyOn(mockFolderStore, 'findItemById').mockReturnValue({ id: folderId, items: [] } as any);
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
