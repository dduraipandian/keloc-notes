import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NotesStore } from '../../../src/lib/stores/notes.svelte';
import { FolderStore } from '../../../src/lib/stores/folders.svelte';
import { SelectionStore } from '../../../src/lib/stores/selection.svelte';
import { notesRepository, settingsRepository } from '../../../src/lib/infrastructure/repositories';
import { SvelteMap } from 'svelte/reactivity';

vi.mock('../../../src/lib/infrastructure/repositories', () => ({
	foldersRepository: { list: vi.fn(), save: vi.fn() },
	notesRepository: { 
		list: vi.fn(), 
		save: vi.fn().mockResolvedValue(undefined),
		saveMeta: vi.fn().mockResolvedValue(undefined),
		saveContent: vi.fn().mockResolvedValue(undefined)
	},
	settingsRepository: { getAll: vi.fn(), save: vi.fn() }
}));

describe('NotesStore flushAllPendingWrites', () => {
    let mockFolderStore: FolderStore;
    let selectionStore: SelectionStore;
    let mockNotesStore: NotesStore;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
        
        mockFolderStore = new FolderStore();
        selectionStore = new SelectionStore(mockFolderStore);
        mockNotesStore = new NotesStore();

		(mockNotesStore as any).isInitialized = true;
		(mockFolderStore as any).isInitialized = true;

		mockNotesStore.notes.set(
			'n1',
			{
				id: 'n1',
				title: 'Initial Title',
				content: 'Initial Content',
				summary: 'Initial Content',
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
		(notesRepository.save as any).mockReturnValue(
			new Promise<void>((resolve) => {
				resolveSave = resolve;
			})
		);

		mockNotesStore.updateNote('n1', { content: 'Flushed content' });
		expect(notesRepository.save).not.toHaveBeenCalled();
		expect(notesRepository.saveMeta).not.toHaveBeenCalled();
		expect(notesRepository.saveContent).not.toHaveBeenCalled();

		const flushPromise = mockNotesStore.flushAllPendingWrites();
		await vi.advanceTimersByTimeAsync(400);

		expect(notesRepository.save).toHaveBeenCalledTimes(1);
		expect((notesRepository.save as any).mock.calls[0][0]).toMatchObject({
			id: 'n1',
			content: 'Flushed content',
			summary: 'Flushed content'
		});
		expect(notesRepository.saveMeta).not.toHaveBeenCalled();
		expect(notesRepository.saveContent).not.toHaveBeenCalled();
		expect(mockNotesStore.getNote('n1')?.summary).toBe('Flushed content');

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
		await expect(mockNotesStore.flushAllPendingWrites()).resolves.toBeUndefined();
		expect(notesRepository.save).not.toHaveBeenCalled();
		expect(notesRepository.saveMeta).not.toHaveBeenCalled();
		expect(notesRepository.saveContent).not.toHaveBeenCalled();
	});
});
