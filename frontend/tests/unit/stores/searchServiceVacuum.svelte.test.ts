import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SearchService } from '../../../src/lib/stores/searchService.svelte';
import { NotesStore } from '../../../src/lib/stores/notes.svelte';

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

// ---------------------------------------------------------------------------
// Shared minimal mocks
// ---------------------------------------------------------------------------

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
// SearchService.vacuumIndex()
// ---------------------------------------------------------------------------

describe('SearchService.vacuumIndex()', () => {
	let service: SearchService;

	beforeEach(() => {
		vi.clearAllMocks();
		service = new SearchService(mockFolders, mockNotes, mockNoteQueries);
	});

	it('delegates to the internal MiniSearch index.vacuum() method', async () => {
		const vacuumSpy = vi
			.spyOn((service as any).index, 'vacuum')
			.mockResolvedValue(undefined);

		await service.vacuumIndex();

		expect(vacuumSpy).toHaveBeenCalledOnce();
	});

	it('resolves when the index is empty', async () => {
		await expect(service.vacuumIndex()).resolves.toBeUndefined();
	});

	it('has autoVacuum enabled (not disabled) in the underlying MiniSearch instance', () => {
		// Regression guard: must never be set to false
		expect((service as any).index._options.autoVacuum).not.toBe(false);
	});
});

// ---------------------------------------------------------------------------
// NotesStore.vacuumSearchIndex()
// ---------------------------------------------------------------------------

describe('NotesStore.vacuumSearchIndex()', () => {
	let store: NotesStore;
	let mockSearchService: { vacuumIndex: ReturnType<typeof vi.fn> };

	beforeEach(() => {
		vi.clearAllMocks();
		store = new NotesStore();
		mockSearchService = { vacuumIndex: vi.fn().mockResolvedValue(undefined) };
	});

	it('delegates to searchService.vacuumIndex() when a service is set', async () => {
		store.setSearchService(mockSearchService as any);

		await store.vacuumSearchIndex();

		expect(mockSearchService.vacuumIndex).toHaveBeenCalledOnce();
	});

	it('resolves immediately when no search service is configured', async () => {
		await expect(store.vacuumSearchIndex()).resolves.toBeUndefined();
	});

	it('resolves without throwing even when searchService.vacuumIndex() rejects', async () => {
		mockSearchService.vacuumIndex.mockRejectedValueOnce(new Error('vacuum failed'));
		store.setSearchService(mockSearchService as any);

		await expect(store.vacuumSearchIndex()).resolves.toBeUndefined();
	});
});
