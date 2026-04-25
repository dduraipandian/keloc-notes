import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SearchService } from '../../../src/lib/stores/searchService.svelte';

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

function makeService(folderMap: Record<string, string[]>): SearchService {
	const findItemById = vi.fn((id: string) => {
		if (!(id in folderMap)) return null;
		return { id, items: folderMap[id] };
	});
	const mockFolders = { findItemById, folders: new Map(), items: [] } as any;
	const mockNotes = { getNote: vi.fn().mockReturnValue(null), listNotes: vi.fn().mockReturnValue([]) } as any;
	const mockQueries = { getNotesForFolder: vi.fn().mockReturnValue([]) } as any;
	return new SearchService(mockFolders, mockNotes, mockQueries);
}

// ---------------------------------------------------------------------------
// SearchService.getFolderSubtreeIds() — tested via private access
// ---------------------------------------------------------------------------

describe('SearchService.getFolderSubtreeIds()', () => {
	let service: SearchService;

	beforeEach(() => {
		vi.clearAllMocks();
		service = makeService({ f0: ['f1', 'f2'], f1: ['f3'], f2: [], f3: [] });
	});

	it('returns [\'root\'] when rootId is null', () => {
		const result = (service as any).getFolderSubtreeIds(null);
		expect(result).toEqual(['root']);
	});

	it('returns all folder IDs in a branching tree as an array', () => {
		const result: string[] = (service as any).getFolderSubtreeIds('f0');
		expect(result).toEqual(expect.arrayContaining(['f0', 'f1', 'f2', 'f3']));
		expect(result).toHaveLength(4);
	});

	it('returns just the root ID when it has no children', () => {
		service = makeService({ leaf: [] });
		const result: string[] = (service as any).getFolderSubtreeIds('leaf');
		expect(result).toEqual(['leaf']);
	});

	it('does not include duplicate IDs when the same child appears multiple times', () => {
		// f0 lists f1 twice — should still produce 2 unique IDs
		service = makeService({ f0: ['f1', 'f1'], f1: [] });
		const result: string[] = (service as any).getFolderSubtreeIds('f0');
		expect(result).toHaveLength(2);
		expect(new Set(result).size).toBe(2);
	});

	it('does not revisit nodes in a cycle (terminates without infinite loop)', () => {
		service = makeService({ f0: ['f1'], f1: ['f0'] });
		const result: string[] = (service as any).getFolderSubtreeIds('f0');
		expect(new Set(result).size).toBe(result.length); // no duplicates
		expect(result).toHaveLength(2);
	});
});
