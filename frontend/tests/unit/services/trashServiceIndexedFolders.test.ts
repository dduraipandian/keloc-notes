import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TrashService } from '../../../src/lib/stores/services/trashService';
import { FolderStore } from '../../../src/lib/stores/folders.svelte';
import { NotesStore } from '../../../src/lib/stores/notes.svelte';
import { SelectionStore } from '../../../src/lib/stores/selection.svelte';
import { trashRepository } from '../../../src/lib/infrastructure/repositories';

vi.mock('../../../src/lib/infrastructure/repositories', () => ({
	foldersRepository: { list: vi.fn(), save: vi.fn() },
	notesRepository: {
		list: vi.fn(),
		save: vi.fn().mockResolvedValue(undefined),
		getContent: vi.fn()
	},
	trashRepository: {
		permanentlyDeleteFolderTree: vi.fn(),
		permanentlyDeleteNote: vi.fn()
	},
	settingsRepository: { getAll: vi.fn(), save: vi.fn().mockResolvedValue(undefined) }
}));

describe('TrashService folder index cleanup after permanent deletion', () => {
	let folderStore: FolderStore;
	let notesStore: NotesStore;
	let selectionStore: SelectionStore;
	let trashService: TrashService;

	beforeEach(() => {
		vi.clearAllMocks();

		folderStore = new FolderStore();
		notesStore = new NotesStore();
		selectionStore = new SelectionStore(folderStore);

		(notesStore as any).isInitialized = true;
		(folderStore as any).isInitialized = true;

		trashService = new TrashService(
			folderStore as any,
			notesStore as any,
			selectionStore as any,
			trashRepository as any
		);
	});

	// ─────────────────────────────────────────────────────────────────────────
	// emptyTrash
	// ─────────────────────────────────────────────────────────────────────────

	it('emptyTrash() calls removeFolderFromSearchIndex for each deleted folder', async () => {
		folderStore.folders.set('f1', {
			id: 'f1',
			title: 'Folder 1',
			deletedAt: 123,
			deletedBatchId: 'batch-1',
			items: [],
			parentId: null,
			profile: 'regular',
			isFavorite: false
		} as any);
		vi.mocked(trashRepository.permanentlyDeleteFolderTree).mockResolvedValue(undefined as any);
		const removeSpy = vi.spyOn(folderStore, 'removeFolderFromSearchIndex');

		await trashService.emptyTrash();

		expect(removeSpy).toHaveBeenCalledWith('f1');
	});

	// ─────────────────────────────────────────────────────────────────────────
	// permanentlyDeleteFolder
	// ─────────────────────────────────────────────────────────────────────────

	it('permanentlyDeleteFolder() calls removeFolderFromSearchIndex for each folder in the subtree', async () => {
		folderStore.folders.set('parent', {
			id: 'parent',
			title: 'Parent',
			deletedAt: 123,
			deletedBatchId: 'batch-1',
			items: ['child'],
			parentId: null,
			profile: 'regular',
			isFavorite: false
		} as any);
		folderStore.folders.set('child', {
			id: 'child',
			title: 'Child',
			deletedAt: 123,
			deletedBatchId: 'batch-1',
			items: [],
			parentId: 'parent',
			profile: 'regular',
			isFavorite: false
		} as any);
		vi.mocked(trashRepository.permanentlyDeleteFolderTree).mockResolvedValue(undefined as any);
		const removeSpy = vi.spyOn(folderStore, 'removeFolderFromSearchIndex');

		await trashService.permanentlyDeleteFolder('parent');

		expect(removeSpy).toHaveBeenCalledWith('parent');
		expect(removeSpy).toHaveBeenCalledWith('child');
	});

	it('permanentlyDeleteFolder() does not call removeFolderFromSearchIndex when deletion fails', async () => {
		folderStore.folders.set('f1', {
			id: 'f1',
			title: 'Folder 1',
			deletedAt: 123,
			deletedBatchId: 'batch-1',
			items: [],
			parentId: null,
			profile: 'regular',
			isFavorite: false
		} as any);
		vi.mocked(trashRepository.permanentlyDeleteFolderTree).mockRejectedValueOnce(
			new Error('DB error')
		);
		const removeSpy = vi.spyOn(folderStore, 'removeFolderFromSearchIndex');

		await expect(trashService.permanentlyDeleteFolder('f1')).rejects.toThrow('DB error');

		expect(removeSpy).not.toHaveBeenCalled();
	});

	// ─────────────────────────────────────────────────────────────────────────
	// permanentlyDeleteNote — folder index not involved
	// ─────────────────────────────────────────────────────────────────────────

	it('permanentlyDeleteNote() does not call removeFolderFromSearchIndex', async () => {
		notesStore.notes.set('n1', {
			id: 'n1',
			title: 'Note 1',
			content: '',
			summary: '',
			folderId: null,
			isFavorite: false,
			deletedAt: null,
			deletedBatchId: null,
			updatedAt: new Date().toISOString(),
			isContentLoaded: true
		});
		vi.mocked(trashRepository.permanentlyDeleteNote).mockResolvedValue(undefined as any);
		const removeSpy = vi.spyOn(folderStore, 'removeFolderFromSearchIndex');

		await trashService.permanentlyDeleteNote('n1');

		expect(removeSpy).not.toHaveBeenCalled();
	});
});
