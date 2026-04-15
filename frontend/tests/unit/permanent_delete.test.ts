import { describe, it, expect, beforeEach, vi } from 'vitest';
import { folderStore, type FolderItem } from '../../src/lib/stores/folders.svelte';
import { notesStore, type NoteItem } from '../../src/lib/stores/notes.svelte';
import { folderService, trashService } from '../../src/lib/stores/services';
import { SvelteMap } from 'svelte/reactivity';
import { settingsRepository, trashRepository } from '../../src/lib/stores/repositories';

// Mock IDBR module
vi.mock('../../src/lib/stores/repositories', () => ({
	foldersRepository: {
		list: vi.fn(),
		save: vi.fn()
	},
	notesRepository: {
		list: vi.fn(),
		save: vi.fn()
	},
	settingsRepository: {
		getAll: vi.fn(),
		save: vi.fn()
	},
	trashRepository: {
		permanentlyDeleteFolderTree: vi.fn(),
		permanentlyDeleteNote: vi.fn()
	}
}));

// Mock crypto.randomUUID
global.crypto.randomUUID = vi.fn(() => 'test-uuid' as any);

describe('Permanent Deletion with Archival', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();

		// Reset FolderStore
		(folderStore as any).items = [];
		(folderStore as any).folders = new SvelteMap<string, FolderItem>();
		(folderStore as any).isInitialized = true;

		// Reset NotesStore
		(notesStore as any).notes = new SvelteMap<string, NoteItem>();
		(notesStore as any).isInitialized = true;
	});

	const addFolder = (folder: Partial<FolderItem> & { id: string }) => {
		const fullFolder: FolderItem = {
			title: 'Folder',
			items: [],
			parentId: null,
			deletedAt: null,
			deletedBatchId: null,
			...folder
		};
		folderStore.folders.set(fullFolder.id, fullFolder);
		if (!fullFolder.parentId) {
			folderStore.items.push(fullFolder.id);
		}
	};

	const addNote = (note: Partial<NoteItem> & { id: string }) => {
		const fullNote: NoteItem = {
			folderId: null,
			title: 'Note',
			content: '',
			updatedAt: new Date().toISOString(),
			deletedAt: null,
			deletedBatchId: null,
			...note
		};
		notesStore.notes.set(fullNote.id, fullNote);
	};

	describe('Breadcrumb Path Generation', () => {
		it('should build path recursively with name:id format', () => {
			addFolder({ id: 'f1', title: 'Work', parentId: null });
			addFolder({ id: 'f2', title: 'Projects', parentId: 'f1' });

			const path = folderService.getFolderPath('f2');
			expect(path).toBe('Work:f1/Projects:f2');
		});

		it('should return only the segment for root-level folders', () => {
			addFolder({ id: 'f1', title: 'Work', parentId: null });
			const path = folderService.getFolderPath('f1');
			expect(path).toBe('Work:f1');
		});
	});

	describe('Folder Permanent Deletion', () => {
		it('should archive and delete all descendant folders and notes transactional success', async () => {
			const epoch = 12345;
			addFolder({ id: 'parent', title: 'Parent', deletedAt: epoch, deletedBatchId: 'batch-parent', items: ['child'] });
			addFolder({ id: 'child', title: 'Child', deletedAt: epoch, deletedBatchId: 'batch-parent', parentId: 'parent' });
			addNote({ id: 'note-1', title: 'Note 1', folderId: 'child', deletedAt: epoch, deletedBatchId: 'batch-parent' });

			vi.mocked(trashRepository.permanentlyDeleteFolderTree).mockResolvedValue(true as any);

			await trashService.permanentlyDeleteFolder('parent');

			// Verify IDBR called with correct snapshots
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

			// Verify in-memory state is cleared
			expect(folderStore.folders.has('parent')).toBe(false);
			expect(folderStore.folders.has('child')).toBe(false);
			expect(notesStore.notes.has('note-1')).toBe(false);
			expect(folderStore.items).not.toContain('parent');
		});

		it('should ROLLBACK (keep state) if the database transaction fails', async () => {
			const epoch = 12345;
			addFolder({ id: 'f1', title: 'F1', deletedAt: epoch, deletedBatchId: 'batch-f1' });
			addNote({ id: 'n1', title: 'N1', folderId: 'f1', deletedAt: epoch, deletedBatchId: 'batch-f1' });

			// Mock failure
			const dbError = new Error('Disk Full');
			vi.mocked(trashRepository.permanentlyDeleteFolderTree).mockRejectedValue(dbError);

			// We expect the error to be rethrown
			await expect(trashService.permanentlyDeleteFolder('f1')).rejects.toThrow('Disk Full');

			// IMPORTANT: State must still exist in memory!
			expect(folderStore.folders.has('f1')).toBe(true);
			expect(notesStore.notes.has('n1')).toBe(true);
		});
	});

	describe('Empty Trash', () => {
		it('should collect all deleted notes regardless of batch epoch', async () => {
			addFolder({ id: 'f1', title: 'Work', deletedAt: 100, deletedBatchId: 'batch-folder' });
			addNote({ id: 'n1', title: 'N1', folderId: 'f1', deletedAt: 100, deletedBatchId: 'batch-folder' }); // deleted with folder
			addNote({ id: 'n2', title: 'N2', folderId: 'f1', deletedAt: 999, deletedBatchId: 'batch-note-2' }); // deleted independently
			folderStore.items.push('f1');

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
			addNote({ id: 'root-n', title: 'Orphan', folderId: null, deletedAt: 500, deletedBatchId: 'batch-root-n' });

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
			addNote({ id: 'n1', title: 'N1', folderId: 'f1', deletedAt: 123, deletedBatchId: 'batch-f1' });
			folderStore.items.push('f1');

			vi.mocked(trashRepository.permanentlyDeleteFolderTree).mockRejectedValue(new Error('Crash'));

			await expect(trashService.emptyTrash()).rejects.toThrow('Crash');

			expect(folderStore.folders.has('f1')).toBe(true);
			expect(notesStore.notes.has('n1')).toBe(true);
		});
	});

	describe('Note Permanent Deletion', () => {
		it('should archive and delete a single note with its full path', async () => {
			addFolder({ id: 'f1', title: 'Work' });
			addNote({ id: 'n1', title: 'N1', folderId: 'f1', deletedAt: 999, deletedBatchId: 'batch-n1' });

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
			addNote({ id: 'root-note', title: 'Root', folderId: null, deletedAt: 999, deletedBatchId: 'batch-root-note' });

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

			// Still in memory
			expect(notesStore.notes.has('n1')).toBe(true);
		});
	});
});
