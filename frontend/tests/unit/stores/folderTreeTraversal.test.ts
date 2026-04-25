import { describe, it, expect, vi } from 'vitest';
import { FolderTreeHelper } from '../../../src/lib/stores/domain/folderTree';

/**
 * Build a FolderStoreLike mock from a plain adjacency map.
 * folderMap[id] = child IDs (may contain duplicates to test dedup logic).
 */
function makeFolderMock(
	folderMap: Record<string, string[]>
): { findItemById: ReturnType<typeof vi.fn>; items: string[]; folders: Map<string, unknown>; trashItems: string[] } {
	const findItemById = vi.fn((id: string) => {
		if (!(id in folderMap)) return null;
		return {
			id,
			title: id,
			items: folderMap[id],
			parentId: null,
			deletedAt: null,
			isFavorite: false,
			profile: 'regular'
		};
	});
	return {
		findItemById,
		items: Object.keys(folderMap),
		folders: new Map(Object.entries(folderMap).map(([id]) => [id, { id }])),
		trashItems: []
	} as any;
}

// ─────────────────────────────────────────────────────────────────────────────
// collectFolderSubtree
// ─────────────────────────────────────────────────────────────────────────────

describe('FolderTreeHelper.collectFolderSubtree()', () => {
	it('returns all nodes in a linear chain without duplicates', () => {
		const mock = makeFolderMock({ f0: ['f1'], f1: ['f2'], f2: [] });
		const helper = new FolderTreeHelper(mock);

		const result = helper.collectFolderSubtree('f0');

		expect(result.map((f) => f.id)).toEqual(expect.arrayContaining(['f0', 'f1', 'f2']));
		expect(result).toHaveLength(3);
	});

	it('returns empty array when the root folder does not exist', () => {
		const mock = makeFolderMock({});
		const helper = new FolderTreeHelper(mock);

		expect(helper.collectFolderSubtree('missing')).toEqual([]);
	});

	it('returns all nodes in a branching tree', () => {
		const mock = makeFolderMock({ root: ['a', 'b'], a: ['c'], b: [], c: [] });
		const helper = new FolderTreeHelper(mock);

		const result = helper.collectFolderSubtree('root');

		expect(result.map((f) => f.id)).toEqual(expect.arrayContaining(['root', 'a', 'b', 'c']));
		expect(result).toHaveLength(4);
	});

	// ── RED tests: duplicate child IDs ──────────────────────────────────────

	it('does not return duplicate entries when a child ID appears more than once in items', () => {
		// f0.items has f1 listed twice — malformed but possible
		const mock = makeFolderMock({ f0: ['f1', 'f1'], f1: [] });
		const helper = new FolderTreeHelper(mock);

		const result = helper.collectFolderSubtree('f0');

		// Must be exactly 2 entries (f0 + f1), not 3 (f0 + f1 + f1)
		expect(result).toHaveLength(2);
		expect(result.map((f) => f.id)).toEqual(expect.arrayContaining(['f0', 'f1']));
	});

	it('calls findItemById exactly once per unique folder even with duplicate child IDs', () => {
		const mock = makeFolderMock({ f0: ['f1', 'f1'], f1: [] });
		const helper = new FolderTreeHelper(mock);

		helper.collectFolderSubtree('f0');

		const f1Calls = (mock.findItemById as ReturnType<typeof vi.fn>).mock.calls.filter(
			([id]) => id === 'f1'
		).length;
		expect(f1Calls).toBe(1);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// getFolderSubtreeIds
// ─────────────────────────────────────────────────────────────────────────────

describe('FolderTreeHelper.getFolderSubtreeIds()', () => {
	it('returns a Set containing all IDs in a linear chain', () => {
		const mock = makeFolderMock({ f0: ['f1'], f1: ['f2'], f2: [] });
		const helper = new FolderTreeHelper(mock);

		const result = helper.getFolderSubtreeIds('f0');

		expect(result).toEqual(new Set(['f0', 'f1', 'f2']));
	});

	it('returns a Set containing all IDs in a branching tree', () => {
		const mock = makeFolderMock({ root: ['a', 'b'], a: ['c'], b: [], c: [] });
		const helper = new FolderTreeHelper(mock);

		const result = helper.getFolderSubtreeIds('root');

		expect(result).toEqual(new Set(['root', 'a', 'b', 'c']));
	});

	// ── RED tests: duplicate child IDs ──────────────────────────────────────

	it('calls findItemById exactly once per unique folder even with duplicate child IDs', () => {
		const mock = makeFolderMock({ f0: ['f1', 'f1'], f1: [] });
		const helper = new FolderTreeHelper(mock);

		helper.getFolderSubtreeIds('f0');

		const f1Calls = (mock.findItemById as ReturnType<typeof vi.fn>).mock.calls.filter(
			([id]) => id === 'f1'
		).length;
		expect(f1Calls).toBe(1);
	});

	it('returns a Set with no duplicates when a child ID appears more than once in items', () => {
		const mock = makeFolderMock({ f0: ['f1', 'f2', 'f1'], f1: [], f2: [] });
		const helper = new FolderTreeHelper(mock);

		const result = helper.getFolderSubtreeIds('f0');

		expect(result.size).toBe(3);
		expect(result).toEqual(new Set(['f0', 'f1', 'f2']));
	});
});
