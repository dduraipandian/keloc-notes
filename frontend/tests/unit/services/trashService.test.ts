import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { TrashService } from '../../../src/lib/stores/services/trashService';
import { FolderStore } from '../../../src/lib/stores/folders.svelte';
import { NotesStore } from '../../../src/lib/stores/notes.svelte';
import { SelectionStore } from '../../../src/lib/stores/selection.svelte';
import { trashRepository, settingsRepository } from '../../../src/lib/infrastructure/repositories';
import {
	initDB,
	putNoteMeta,
	putNoteContent,
	getNoteMeta,
	permanentDeleteNoteTransactionally,
	permanentDeleteFolderTransactionally
} from '../../../src/lib/infrastructure/idbr';

vi.mock('../../../src/lib/infrastructure/repositories', () => ({
	foldersRepository: {
		list: vi.fn(),
		save: vi.fn()
	},
	notesRepository: {
		list: vi.fn(),
		saveMeta: vi.fn(),
		saveContent: vi.fn()
	},
	trashRepository: {
		permanentlyDeleteFolderTree: vi.fn(),
		permanentlyDeleteNote: vi.fn()
	},
	settingsRepository: {
		save: vi.fn()
	}
}));

describe('TrashService', () => {
	let trashService: TrashService;
	let folderStore: FolderStore;
	let notesStore: NotesStore;
	let selectionStore: SelectionStore;

	beforeEach(async () => {
		vi.clearAllMocks();

		folderStore = new FolderStore();
		selectionStore = new SelectionStore(folderStore);
		notesStore = new NotesStore(folderStore, selectionStore);

		(notesStore as any).isInitialized = true;
		(folderStore as any).isInitialized = true;

		trashService = new TrashService(
			folderStore as any,
			notesStore as any,
			selectionStore as any,
			trashRepository as any
		);
	});

	function addFolder(opts: any) {
		const folder = {
			items: [],
			deletedAt: null,
			deletedBatchId: null,
			parentId: null,
			profile: 'regular',
			...opts
		};
		folderStore.folders.set(folder.id, folder);
		if (!folder.parentId) {
			folderStore.items.push(folder.id);
		}
	}

	function addNote(opts: any) {
		notesStore.notes.set(opts.id, {
			folderId: null,
			title: 'Note',
			deletedAt: null,
			deletedBatchId: null,
			isContentLoaded: true,
			...opts
		} as any);
	}

	describe('Soft Recovery Logic', () => {
		it('should recover a note to Home (null) if parent folder is deleted', () => {
			addFolder({ id: 'folder-a', deletedAt: 123 });
			addNote({ id: 'note-1', folderId: 'folder-a', deletedAt: 123 });

			trashService.recoverNote('note-1');

			const note = notesStore.notes.get('note-1');
			expect(note?.deletedAt).toBeNull();
			expect(note?.folderId).toBeNull();
		});

		it('should recover a note to its original folder if parent is active', () => {
			addFolder({ id: 'folder-a', deletedAt: null });
			addNote({ id: 'note-1', folderId: 'folder-a', deletedAt: 123 });

			trashService.recoverNote('note-1');

			const note = notesStore.notes.get('note-1');
			expect(note?.deletedAt).toBeNull();
			expect(note?.folderId).toBe('folder-a');
		});

		it('should root the folder if its parent is deleted during recovery', () => {
			addFolder({
				id: 'folder-1',
				deletedAt: 123,
				deletedBatchId: 'batch-1',
				parentId: 'parent-missing'
			});

			trashService.recoverFolder('folder-1', 'batch-1');

			const folder = folderStore.folders.get('folder-1');
			expect(folder?.deletedAt).toBeNull();
			expect(folder?.parentId).toBeNull();
			expect(selectionStore.selectedFolderID).toBe('folder-1');
		});
	});

	describe('Permanent Deletion Logic', () => {
		it('should delegate permanent folder deletion and manage state', async () => {
			addFolder({ id: 'folder-1', title: 'Folder', deletedAt: 123, deletedBatchId: 'batch-1' });
			vi.mocked(trashRepository.permanentlyDeleteFolderTree).mockResolvedValue(undefined as any);

			await trashService.permanentlyDeleteFolder('folder-1', 'batch-1');

			expect(trashRepository.permanentlyDeleteFolderTree).toHaveBeenCalled();
			expect(folderStore.folders.has('folder-1')).toBe(false);
		});

		it('should archive and delete all descendant folders and notes transactional success', async () => {
			const epoch = 12345;
			addFolder({
				id: 'parent',
				title: 'Parent',
				deletedAt: epoch,
				deletedBatchId: 'batch-parent',
				items: ['child']
			});
			addFolder({
				id: 'child',
				title: 'Child',
				deletedAt: epoch,
				deletedBatchId: 'batch-parent',
				parentId: 'parent'
			});
			addNote({
				id: 'note-1',
				title: 'Note 1',
				folderId: 'child',
				deletedAt: epoch,
				deletedBatchId: 'batch-parent'
			});

			vi.mocked(trashRepository.permanentlyDeleteFolderTree).mockResolvedValue(true as any);

			await trashService.permanentlyDeleteFolder('parent');

			expect(trashRepository.permanentlyDeleteFolderTree).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({
						path: 'Parent:parent/Child:child/Note 1:note-1'
					})
				]),
				expect.arrayContaining([
					expect.objectContaining({ id: 'parent' }),
					expect.objectContaining({ id: 'child' })
				]),
				expect.any(Number)
			);

			expect(folderStore.folders.has('parent')).toBe(false);
			expect(notesStore.notes.has('note-1')).toBe(false);
		});

		it('should ROLLBACK (keep state) if the database transaction fails', async () => {
			addFolder({ id: 'folder-1', title: 'Folder', deletedAt: 123, deletedBatchId: 'batch-1' });
			vi.mocked(trashRepository.permanentlyDeleteFolderTree).mockRejectedValue(new Error('Abort'));

			await expect(trashService.permanentlyDeleteFolder('folder-1', 'batch-1')).rejects.toThrow(
				'Abort'
			);

			expect(folderStore.folders.has('folder-1')).toBe(true);
		});

		it('should archive and delete a single note with its full path', async () => {
			addFolder({ id: 'f1', title: 'Work', parentId: null });
			addNote({ id: 'n1', title: 'N1', folderId: 'f1', deletedAt: 999 });

			vi.mocked(trashRepository.permanentlyDeleteNote).mockResolvedValue(true as any);

			await trashService.permanentlyDeleteNote('n1');

			expect(trashRepository.permanentlyDeleteNote).toHaveBeenCalledWith(
				expect.objectContaining({ id: 'n1' }),
				'Work:f1/N1:n1',
				expect.any(Number)
			);

			expect(notesStore.notes.has('n1')).toBe(false);
		});

		it('should handle root-level notes (no folderId) correctly', async () => {
			addNote({ id: 'root-note', title: 'Root', folderId: null, deletedAt: 999 });

			vi.mocked(trashRepository.permanentlyDeleteNote).mockResolvedValue(true as any);

			await trashService.permanentlyDeleteNote('root-note');

			expect(trashRepository.permanentlyDeleteNote).toHaveBeenCalledWith(
				expect.anything(),
				'Root:root-note',
				expect.any(Number)
			);
		});

		it('should persist null selectedNoteID to settings when selected note is permanently deleted', async () => {
			addNote({ id: 'n1', title: 'N1', deletedAt: 999 });
			(notesStore as any).selectedNoteID = 'n1';

			vi.mocked(trashRepository.permanentlyDeleteNote).mockResolvedValue(true as any);

			await trashService.permanentlyDeleteNote('n1');

			expect(notesStore.selectedNoteID).toBeNull();
			expect(settingsRepository.save).toHaveBeenCalledWith('selectedNoteID', null);
		});

		it('should ROLLBACK (keep state) if the note transaction fails', async () => {
			addNote({ id: 'n1', title: 'N1', deletedAt: 999 });
			vi.mocked(trashRepository.permanentlyDeleteNote).mockRejectedValue(new Error('Abort'));

			await expect(trashService.permanentlyDeleteNote('n1')).rejects.toThrow('Abort');

			expect(notesStore.notes.has('n1')).toBe(true);
		});
	});

	describe('Empty Trash', () => {
		it('should collect all deleted notes regardless of batch epoch', async () => {
			addFolder({ id: 'f1', title: 'Work', deletedAt: 100, deletedBatchId: 'batch-folder' });
			addNote({
				id: 'n1',
				title: 'N1',
				folderId: 'f1',
				deletedAt: 100,
				deletedBatchId: 'batch-folder'
			});
			addNote({
				id: 'n2',
				title: 'N2',
				folderId: 'f1',
				deletedAt: 999,
				deletedBatchId: 'batch-note-2'
			});

			vi.mocked(trashRepository.permanentlyDeleteFolderTree).mockResolvedValue(true as any);

			await trashService.emptyTrash();

			expect(trashRepository.permanentlyDeleteFolderTree).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({ note: expect.objectContaining({ id: 'n1' }) }),
					expect.objectContaining({ note: expect.objectContaining({ id: 'n2' }) })
				]),
				expect.arrayContaining([expect.objectContaining({ id: 'f1' })]),
				expect.any(Number)
			);

			expect(notesStore.notes.has('n1')).toBe(false);
			expect(notesStore.notes.has('n2')).toBe(false);
			expect(folderStore.folders.has('f1')).toBe(false);
		});

		it('should include root-level deleted notes (no folder)', async () => {
			addNote({
				id: 'root-n',
				title: 'Orphan',
				folderId: null,
				deletedAt: 500,
				deletedBatchId: 'batch-root-n'
			});

			vi.mocked(trashRepository.permanentlyDeleteFolderTree).mockResolvedValue(true as any);

			await trashService.emptyTrash();

			expect(trashRepository.permanentlyDeleteFolderTree).toHaveBeenCalledWith(
				expect.arrayContaining([expect.objectContaining({ path: 'Orphan:root-n' })]),
				[],
				expect.any(Number)
			);

			expect(notesStore.notes.has('root-n')).toBe(false);
		});

		it('should ROLLBACK if the transaction fails', async () => {
			addFolder({ id: 'f1', title: 'F1', deletedAt: 123, deletedBatchId: 'batch-f1' });
			addNote({
				id: 'n1',
				title: 'N1',
				folderId: 'f1',
				deletedAt: 123,
				deletedBatchId: 'batch-f1'
			});

			vi.mocked(trashRepository.permanentlyDeleteFolderTree).mockRejectedValue(new Error('Crash'));

			await expect(trashService.emptyTrash()).rejects.toThrow('Crash');

			expect(folderStore.folders.has('f1')).toBe(true);
			expect(notesStore.notes.has('n1')).toBe(true);
		});
	});

	describe('Breadcrumb Path Generation', () => {
		it('should build path recursively with name:id format', () => {
			addFolder({ id: 'f1', title: 'Work', parentId: null });
			addFolder({ id: 'f2', title: 'Projects', parentId: 'f1' });

			// Testing the internal Helper via the tree property
			const path = (trashService as any).tree.getFolderPath('f2');
			expect(path).toBe('Work:f1/Projects:f2');
		});

		it('should return only the segment for root-level folders', () => {
			addFolder({ id: 'f1', title: 'Work', parentId: null });
			const path = (trashService as any).tree.getFolderPath('f1');
			expect(path).toBe('Work:f1');
		});
	});
});
