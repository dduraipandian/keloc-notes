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

describe('TrashService vacuum after batch deletes', () => {
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

	it('emptyTrash() calls vacuumSearchIndex after successful deletion', async () => {
		vi.mocked(trashRepository.permanentlyDeleteFolderTree).mockResolvedValue(undefined as any);
		const vacuumSpy = vi
			.spyOn(notesStore, 'vacuumSearchIndex')
			.mockResolvedValue(undefined);

		await trashService.emptyTrash();

		expect(vacuumSpy).toHaveBeenCalledOnce();
	});

	it('emptyTrash() does not call vacuumSearchIndex when the trash operation fails', async () => {
		vi.mocked(trashRepository.permanentlyDeleteFolderTree).mockRejectedValueOnce(
			new Error('DB error')
		);
		const vacuumSpy = vi
			.spyOn(notesStore, 'vacuumSearchIndex')
			.mockResolvedValue(undefined);

		await expect(trashService.emptyTrash()).rejects.toThrow('DB error');

		expect(vacuumSpy).not.toHaveBeenCalled();
	});

	// ─────────────────────────────────────────────────────────────────────────
	// permanentlyDeleteFolder
	// ─────────────────────────────────────────────────────────────────────────

	it('permanentlyDeleteFolder() calls vacuumSearchIndex after successful deletion', async () => {
		folderStore.folders.set('f1', {
			id: 'f1',
			title: 'Folder 1',
			deletedAt: 123,
			deletedBatchId: 'batch-1',
			items: [],
			parentId: null,
			isFavorite: false
		} as any);
		vi.mocked(trashRepository.permanentlyDeleteFolderTree).mockResolvedValue(undefined as any);
		const vacuumSpy = vi
			.spyOn(notesStore, 'vacuumSearchIndex')
			.mockResolvedValue(undefined);

		await trashService.permanentlyDeleteFolder('f1');

		expect(vacuumSpy).toHaveBeenCalledOnce();
	});

	// ─────────────────────────────────────────────────────────────────────────
	// permanentlyDeleteNote — single note; autoVacuum handles it
	// ─────────────────────────────────────────────────────────────────────────

	it('permanentlyDeleteNote() does not call vacuumSearchIndex', async () => {
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
		const vacuumSpy = vi
			.spyOn(notesStore, 'vacuumSearchIndex')
			.mockResolvedValue(undefined);

		await trashService.permanentlyDeleteNote('n1');

		expect(vacuumSpy).not.toHaveBeenCalled();
	});
});
