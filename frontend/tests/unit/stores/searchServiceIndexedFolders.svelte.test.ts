import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SearchService } from '../../../src/lib/stores/searchService.svelte';
import { FolderStore } from '../../../src/lib/stores/folders.svelte';
import { notesRepository } from '../../../src/lib/infrastructure/repositories';

vi.mock('../../../src/lib/infrastructure/repositories', () => ({
	foldersRepository: { list: vi.fn(), save: vi.fn() },
	notesRepository: {
		list: vi.fn(),
		save: vi.fn().mockResolvedValue(undefined),
		getContent: vi.fn(),
		getBulkContents: vi.fn().mockResolvedValue({})
	},
	settingsRepository: { getAll: vi.fn(), save: vi.fn().mockResolvedValue(undefined) }
}));

const mockFolders = {
	findItemById: vi.fn().mockReturnValue({ id: 'f1', items: [] }),
	folders: new Map(),
	items: []
} as any;

const mockNotes = {
	getNote: vi.fn().mockReturnValue(null),
	listNotes: vi.fn().mockReturnValue([])
} as any;

const mockNoteQueries = {
	getNotesForFolder: vi.fn().mockReturnValue([])
} as any;

// ---------------------------------------------------------------------------
// SearchService.removeFolderIndex()
// ---------------------------------------------------------------------------

describe('SearchService.removeFolderIndex()', () => {
	let service: SearchService;

	beforeEach(() => {
		vi.clearAllMocks();
		service = new SearchService(mockFolders, mockNotes, mockNoteQueries);
	});

	it('removes a previously-indexed folder from indexedFolderIds', async () => {
		await service.ensureFolderIndexed('f1');
		expect((service as any).indexedFolderIds.has('f1')).toBe(true);

		service.removeFolderIndex('f1');

		expect((service as any).indexedFolderIds.has('f1')).toBe(false);
	});

	it('is a no-op for a folder that was never indexed', () => {
		expect(() => service.removeFolderIndex('never-indexed')).not.toThrow();
		expect((service as any).indexedFolderIds.has('never-indexed')).toBe(false);
	});

	it('after removal, ensureFolderIndexed re-indexes the folder', async () => {
		const mockNote = { id: 'n1', title: 'Note 1' };
		mockNoteQueries.getNotesForFolder.mockReturnValue([mockNote]);
		vi.mocked(notesRepository.getBulkContents).mockResolvedValue({ n1: 'content' });

		await service.ensureFolderIndexed('f1');
		expect(notesRepository.getBulkContents).toHaveBeenCalledTimes(1);

		// Simulate the real permanent-deletion sequence: notes are removed from
		// MiniSearch via removeNoteIndex before the folder tracking is cleared.
		service.removeNoteIndex('n1');
		service.removeFolderIndex('f1');
		await service.ensureFolderIndexed('f1');

		expect(notesRepository.getBulkContents).toHaveBeenCalledTimes(2);
		expect((service as any).indexedFolderIds.has('f1')).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// FolderStore.removeFolderFromSearchIndex()
// ---------------------------------------------------------------------------

describe('FolderStore.removeFolderFromSearchIndex()', () => {
	let store: FolderStore;
	let mockSearchService: { removeFolderIndex: ReturnType<typeof vi.fn> };

	beforeEach(() => {
		vi.clearAllMocks();
		store = new FolderStore();
		mockSearchService = { removeFolderIndex: vi.fn() };
	});

	it('delegates to searchService.removeFolderIndex() when a service is set', () => {
		store.setSearchService(mockSearchService as any);

		store.removeFolderFromSearchIndex('f1');

		expect(mockSearchService.removeFolderIndex).toHaveBeenCalledOnce();
		expect(mockSearchService.removeFolderIndex).toHaveBeenCalledWith('f1');
	});

	it('is a no-op when no search service is configured', () => {
		expect(() => store.removeFolderFromSearchIndex('f1')).not.toThrow();
	});
});
