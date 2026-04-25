import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NotesStore } from '../../../src/lib/stores/notes.svelte';
import { notesRepository, settingsRepository } from '../../../src/lib/infrastructure/repositories';

vi.mock('../../../src/lib/infrastructure/repositories', () => ({
	foldersRepository: { list: vi.fn(), save: vi.fn() },
	notesRepository: {
		list: vi.fn(),
		save: vi.fn().mockResolvedValue(undefined),
		getContent: vi.fn()
	},
	settingsRepository: { getAll: vi.fn(), save: vi.fn().mockResolvedValue(undefined) }
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStore(limit: number): NotesStore {
	const s = new NotesStore([], limit);
	(s as any).isInitialized = true;
	return s;
}

function addUnloadedNote(s: NotesStore, id: string): void {
	s.notes.set(id, {
		id,
		title: `Note ${id}`,
		content: '',
		summary: '',
		updatedAt: '2024-01-01T00:00:00.000Z',
		folderId: null,
		isFavorite: false,
		deletedAt: null,
		deletedBatchId: null,
		isContentLoaded: false
	});
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('NotesStore content LRU eviction', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		vi.mocked(notesRepository.getContent).mockImplementation((id) =>
			Promise.resolve(`content of ${id}`)
		);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	// ─────────────────────────────────────────────────────────────────────────
	// Basic eviction
	// ─────────────────────────────────────────────────────────────────────────

	it('does not evict notes while below the cache limit', async () => {
		const store = makeStore(3);
		['a', 'b', 'c'].forEach((id) => addUnloadedNote(store, id));

		await store.loadNoteContent('a');
		await store.loadNoteContent('b');
		await store.loadNoteContent('c');

		expect(store.getNote('a')?.isContentLoaded).toBe(true);
		expect(store.getNote('b')?.isContentLoaded).toBe(true);
		expect(store.getNote('c')?.isContentLoaded).toBe(true);
	});

	it('evicts the least-recently-loaded note when the limit is exceeded', async () => {
		const store = makeStore(3);
		['a', 'b', 'c', 'd'].forEach((id) => addUnloadedNote(store, id));

		await store.loadNoteContent('a');
		await store.loadNoteContent('b');
		await store.loadNoteContent('c');
		await store.loadNoteContent('d'); // fills cache to 4 — evicts 'a' (LRU)

		expect(store.getNote('a')?.isContentLoaded).toBe(false);
		expect(store.getNote('a')?.content).toBe('');
		expect(store.getNote('b')?.isContentLoaded).toBe(true);
		expect(store.getNote('c')?.isContentLoaded).toBe(true);
		expect(store.getNote('d')?.isContentLoaded).toBe(true);
	});

	// ─────────────────────────────────────────────────────────────────────────
	// LRU promotion on re-access
	// ─────────────────────────────────────────────────────────────────────────

	it('re-loading an already-loaded note does not call getContent again', async () => {
		const store = makeStore(3);
		addUnloadedNote(store, 'a');

		await store.loadNoteContent('a');
		vi.clearAllMocks();

		await store.loadNoteContent('a');

		expect(notesRepository.getContent).not.toHaveBeenCalled();
	});

	it('re-loading an already-loaded note promotes it to MRU, protecting it from eviction', async () => {
		const store = makeStore(3);
		['a', 'b', 'c', 'd'].forEach((id) => addUnloadedNote(store, id));

		await store.loadNoteContent('a'); // LRU order: [a]
		await store.loadNoteContent('b'); // LRU order: [a, b]
		await store.loadNoteContent('c'); // LRU order: [a, b, c]
		await store.loadNoteContent('a'); // already loaded — promotes 'a' → [b, c, a]

		await store.loadNoteContent('d'); // 'b' is now LRU — evicts 'b'

		expect(store.getNote('b')?.isContentLoaded).toBe(false);
		expect(store.getNote('b')?.content).toBe('');
		expect(store.getNote('a')?.isContentLoaded).toBe(true);
		expect(store.getNote('c')?.isContentLoaded).toBe(true);
		expect(store.getNote('d')?.isContentLoaded).toBe(true);
	});

	it('an evicted note can be reloaded and re-enters the LRU correctly', async () => {
		const store = makeStore(2);
		['a', 'b', 'c'].forEach((id) => addUnloadedNote(store, id));

		await store.loadNoteContent('a');
		await store.loadNoteContent('b');
		await store.loadNoteContent('c'); // evicts 'a'

		expect(store.getNote('a')?.isContentLoaded).toBe(false);

		// Reload 'a' — it re-enters at MRU; 'b' is now LRU and gets evicted
		await store.loadNoteContent('a');

		expect(store.getNote('a')?.isContentLoaded).toBe(true);
		expect(store.getNote('a')?.content).toBe('content of a');
		expect(store.getNote('b')?.isContentLoaded).toBe(false);
		expect(store.getNote('c')?.isContentLoaded).toBe(true);
	});

	// ─────────────────────────────────────────────────────────────────────────
	// createNote tracking
	// ─────────────────────────────────────────────────────────────────────────

	it('tracks a newly created note in the LRU and evicts the LRU when limit exceeded', async () => {
		const store = makeStore(2);
		['a', 'b'].forEach((id) => addUnloadedNote(store, id));

		await store.loadNoteContent('a');
		await store.loadNoteContent('b'); // LRU order: [a, b], at limit

		global.crypto.randomUUID = vi.fn(() => 'new-note' as any);
		store.createNote(null); // 3rd entry — evicts 'a' (LRU)

		expect(store.getNote('a')?.isContentLoaded).toBe(false);
		expect(store.getNote('b')?.isContentLoaded).toBe(true);
		expect(store.getNote('new-note')?.isContentLoaded).toBe(true);
	});

	// ─────────────────────────────────────────────────────────────────────────
	// updateNote content tracking
	// ─────────────────────────────────────────────────────────────────────────

	it('updating note content promotes the note to MRU', async () => {
		const store = makeStore(2);
		['a', 'b', 'c'].forEach((id) => addUnloadedNote(store, id));

		await store.loadNoteContent('a'); // LRU order: [a]
		await store.loadNoteContent('b'); // LRU order: [a, b]
		store.updateNote('a', { content: 'edited' }); // promotes 'a' → [b, a]

		await store.loadNoteContent('c'); // 'b' is LRU — evicts 'b'

		expect(store.getNote('b')?.isContentLoaded).toBe(false);
		expect(store.getNote('a')?.isContentLoaded).toBe(true);
		expect(store.getNote('c')?.isContentLoaded).toBe(true);
	});

	it('updating note metadata only (no content) does not change LRU order', async () => {
		const store = makeStore(2);
		['a', 'b', 'c'].forEach((id) => addUnloadedNote(store, id));

		await store.loadNoteContent('a'); // LRU order: [a]
		await store.loadNoteContent('b'); // LRU order: [a, b]
		store.updateNote('a', { title: 'Renamed' }); // title-only — LRU order unchanged: [a, b]

		await store.loadNoteContent('c'); // 'a' is still LRU — evicts 'a'

		expect(store.getNote('a')?.isContentLoaded).toBe(false);
		expect(store.getNote('b')?.isContentLoaded).toBe(true);
		expect(store.getNote('c')?.isContentLoaded).toBe(true);
	});

	// ─────────────────────────────────────────────────────────────────────────
	// Dirty note protection
	// ─────────────────────────────────────────────────────────────────────────

	it('skips dirty notes during eviction and evicts the next non-dirty LRU entry', async () => {
		const store = makeStore(2);
		['a', 'b', 'c'].forEach((id) => addUnloadedNote(store, id));

		await store.loadNoteContent('a'); // LRU order: [a, ...], a is LRU
		await store.loadNoteContent('b'); // LRU order: [a, b]

		// Manually mark 'a' (LRU) as having a pending content write
		(store as any).dirtyContentNotes.add('a');

		await store.loadNoteContent('c'); // 'a' is LRU but dirty → skip; evicts 'b' instead

		expect(store.getNote('a')?.isContentLoaded).toBe(true);
		expect(store.getNote('b')?.isContentLoaded).toBe(false);
		expect(store.getNote('c')?.isContentLoaded).toBe(true);
	});

	it('does not evict anything when all cached notes are dirty', async () => {
		const store = makeStore(2);
		['a', 'b', 'c'].forEach((id) => addUnloadedNote(store, id));

		await store.loadNoteContent('a');
		await store.loadNoteContent('b');

		// Mark both as dirty — eviction must not proceed
		(store as any).dirtyContentNotes.add('a');
		(store as any).dirtyContentNotes.add('b');

		await store.loadNoteContent('c'); // all entries dirty — cache grows above limit

		expect(store.getNote('a')?.isContentLoaded).toBe(true);
		expect(store.getNote('b')?.isContentLoaded).toBe(true);
		expect(store.getNote('c')?.isContentLoaded).toBe(true);
	});

	// ─────────────────────────────────────────────────────────────────────────
	// Cleanup integration
	// ─────────────────────────────────────────────────────────────────────────

	it('removeNoteLocally removes the note from LRU tracking, freeing a slot', async () => {
		const store = makeStore(3);
		['a', 'b', 'c', 'd'].forEach((id) => addUnloadedNote(store, id));

		await store.loadNoteContent('a');
		await store.loadNoteContent('b');
		await store.loadNoteContent('c'); // cache [a,b,c] at limit

		store.removeNoteLocally('a'); // removes from notes AND LRU → cache [b,c], size=2

		await store.loadNoteContent('d'); // cache [b,c,d], size=3=limit → no eviction

		expect(store.getNote('b')?.isContentLoaded).toBe(true);
		expect(store.getNote('c')?.isContentLoaded).toBe(true);
		expect(store.getNote('d')?.isContentLoaded).toBe(true);
	});

	it('resetForStartupRetry clears all LRU tracking state', async () => {
		const store = makeStore(3);
		['a', 'b'].forEach((id) => addUnloadedNote(store, id));

		await store.loadNoteContent('a');
		await store.loadNoteContent('b');

		expect((store as any).contentLRU.size).toBe(2);

		store.resetForStartupRetry();

		expect((store as any).contentLRU.size).toBe(0);
	});
});
