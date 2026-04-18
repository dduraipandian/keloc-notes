import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { notesStore } from '../../src/lib/stores/notes.svelte';
import { notesRepository, settingsRepository } from '../../src/lib/stores/repositories';
import { SvelteMap } from 'svelte/reactivity';

vi.mock('../../src/lib/stores/repositories', () => ({
	foldersRepository: { list: vi.fn(), save: vi.fn() },
	notesRepository: { 
		list: vi.fn(), 
		saveMeta: vi.fn().mockResolvedValue(undefined),
		saveContent: vi.fn().mockResolvedValue(undefined)
	},
	settingsRepository: { getAll: vi.fn(), save: vi.fn() }
}));

describe('NotesStore flushAllPendingWrites', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		(notesStore as any).notes = new SvelteMap();
		(notesStore as any).selectedNoteID = null;
		(notesStore as any).onPersistError = null;
		(notesStore as any).isInitialized = true;
		(notesStore as any).inFlightWrites = new Set();

		notesStore.notes.set(
			'n1',
			{
				id: 'n1',
				title: 'Initial Title',
				content: 'Initial Content',
				folderId: null,
				updatedAt: '2021-01-01T00:00:00.000Z',
				deletedAt: null,
				deletedBatchId: null,
				isContentLoaded: true
			} as any
		);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('flushes a pending debounced write and waits for the save to settle', async () => {
		let resolveSave!: () => void;
		(notesRepository.saveContent as any).mockReturnValue(
			new Promise<void>((resolve) => {
				resolveSave = resolve;
			})
		);

		notesStore.updateNote('n1', { content: 'Flushed content' });
		expect(notesRepository.saveMeta).not.toHaveBeenCalled();
		expect(notesRepository.saveContent).not.toHaveBeenCalled();

		const flushPromise = notesStore.flushAllPendingWrites();
		await vi.advanceTimersByTimeAsync(400);

		expect(notesRepository.saveMeta).toHaveBeenCalledTimes(1);
		expect(notesRepository.saveContent).toHaveBeenCalledTimes(1);
		expect((notesRepository.saveContent as any).mock.calls[0][1]).toBe('Flushed content');

		let settled = false;
		void flushPromise.then(() => {
			settled = true;
		});
		await Promise.resolve();
		expect(settled).toBe(false);

		resolveSave();
		await flushPromise;
		expect(settled).toBe(true);
	});

	it('resolves immediately when there are no pending writes', async () => {
		await expect(notesStore.flushAllPendingWrites()).resolves.toBeUndefined();
		expect(notesRepository.saveMeta).not.toHaveBeenCalled();
		expect(notesRepository.saveContent).not.toHaveBeenCalled();
	});
});
