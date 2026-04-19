import type { FolderID, FolderItem } from '../folders.svelte';
import type { NoteID, NoteItem } from '../notes.svelte';
import { trashRepository } from '../../infrastructure/repositories';
import type { FolderStoreLike, NotesStoreLike, SelectionStoreLike } from './types';
import { FolderTreeHelper } from '../domain/folderTree';
import { snapshotNote } from './helpers';

export class TrashService {
	private readonly tree: FolderTreeHelper;
	private readonly selection: SelectionStoreLike;

	constructor(
		private readonly folders: FolderStoreLike,
		private readonly notes: NotesStoreLike,
		selection: SelectionStoreLike,
		private readonly trash = trashRepository
	) {
		this.tree = new FolderTreeHelper(folders, notes);
		this.selection = selection;
	}

	recoverFolder(folderId: FolderID, targetBatchId?: string) {
		const folder = this.folders.findItemById(folderId);
		if (!folder || folder.deletedAt == null) return;
		if (!folder.deletedBatchId) return;

		this.folders.rootFolderIfParentMissing(folderId);

		const batchId = targetBatchId ?? folder.deletedBatchId;
		this.restoreFolderTree(folderId, batchId);

		const firstNote =
			typeof this.notes.listNotes === 'function'
				? this.notes
						.listNotes()
						.filter((note) => note.folderId === folderId && note.deletedAt == null)
						.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0] ?? null
				: null;

		this.selection.selectFolder(folderId);
		this.notes.selectNote(firstNote?.id ?? null);
	}

	recoverNote(noteId: NoteID) {
		const note = this.notes.getNote(noteId);
		if (!note) return;

		let restoredFolderId: FolderID | null | undefined = undefined;

		if (note.folderId) {
			const parentFolder = this.folders.findItemById(note.folderId);
			if (!parentFolder || parentFolder.deletedAt != null) {
				restoredFolderId = null;
			}
		}

		// Find neighbor in current view (Trash) before restoring
		const deletedNotes = typeof this.notes.getDeletedNotes === 'function' ? this.notes.getDeletedNotes() : [];
		const currentIndex = deletedNotes.findIndex((n) => n.id === noteId);
		let nextNoteId: NoteID | null = null;

		if (currentIndex >= 0) {
			if (deletedNotes[currentIndex + 1]) {
				nextNoteId = deletedNotes[currentIndex + 1].id;
			} else if (deletedNotes[currentIndex - 1]) {
				nextNoteId = deletedNotes[currentIndex - 1].id;
			}
		}

		this.notes.restoreNote(noteId, restoredFolderId);
		this.notes.selectNote(nextNoteId);
	}

	async permanentlyDeleteFolder(folderId: FolderID, targetBatch?: string) {
		const folder = this.folders.findItemById(folderId);
		if (!folder || folder.deletedAt == null) return;

		const batch = targetBatch ?? folder.deletedBatchId;
		if (!batch) return;
		const foldersToDelete = this.tree.collectFolderSubtree(folderId);
		const notesToDelete = this.collectFolderNotesWithPaths(foldersToDelete, batch);

		try {
			await this.trash.permanentlyDeleteFolderTree(notesToDelete, foldersToDelete, Date.now());
			notesToDelete.forEach(({ note }) => this.notes.removeNoteLocally(note.id));
			this.folders.applyPermanentDeleteState(foldersToDelete);
			this.selection.clearFolderIfSelected(folderId);
		} catch (error) {
			console.error('Failed to permanently delete folder and children:', error);
			throw error;
		}
	}

	async permanentlyDeleteNote(noteId: NoteID) {
		const note = this.notes.getNote(noteId);
		if (!note) return;

		const folderPath = note.folderId ? this.tree.getFolderPath(note.folderId) : 'root';
		const fullPath = note.folderId ? `${folderPath}/${note.title}:${note.id}` : `${note.title}:${note.id}`;

		try {
			await this.trash.permanentlyDeleteNote(snapshotNote(note), fullPath, Date.now());
			this.notes.removeNoteLocally(noteId);
			this.notes.clearSelectionIfSelected(noteId);
		} catch (error) {
			console.error('Failed to permanently delete note:', error);
			throw error;
		}
	}

	async emptyTrash() {
		const foldersToDelete = this.tree.getTrashRootIds().flatMap((id) => this.tree.collectFolderSubtree(id));
		const deletedFolderIds = new Set(foldersToDelete.map((f) => f.id));
		const folderNotes = this.collectFolderNotesWithPaths(foldersToDelete);
		const individualNotes = this.collectAllDeletedNotesWithPaths();
		const seenIds = new Set(folderNotes.map((entry) => entry.note.id));
		const notesToDelete = [
			...folderNotes,
			...individualNotes.filter((entry) => !seenIds.has(entry.note.id))
		];

		try {
			await this.trash.permanentlyDeleteFolderTree(notesToDelete, foldersToDelete, Date.now());
			notesToDelete.forEach(({ note }) => this.notes.removeNoteLocally(note.id));
			this.folders.applyPermanentDeleteState(foldersToDelete);
			deletedFolderIds.forEach((id) => this.selection.clearFolderIfSelected(id));
		} catch (error) {
			console.error('Failed to empty trash:', error);
			throw error;
		}
	}

	private restoreFolderTree(folderId: FolderID, batchId: string) {
		const folder = this.folders.findItemById(folderId);
		if (!folder || folder.deletedBatchId !== batchId) return;

		this.folders.restoreFolder(folderId, batchId);
		this.notes.restoreNotesInFolder(folderId, batchId);

		for (const childId of folder.items ?? []) {
			this.restoreFolderTree(childId, batchId);
		}
	}

	private collectFolderNotesWithPaths(
		folders: FolderItem[],
		batchId?: string
	): { note: NoteItem; path: string }[] {
		return folders.flatMap((folder) => {
			const folderPath = this.tree.getFolderPath(folder.id);
			const notes =
				batchId !== undefined
					? this.notes.getNotesToArchive(folder.id, batchId)
					: this.notes.getDeletedNotes().filter((note) => note.folderId === folder.id);

			return notes.map((note) => ({
				note: snapshotNote(note),
				path: `${folderPath}/${note.title}:${note.id}`
			}));
		});
	}

	private collectAllDeletedNotesWithPaths(): { note: NoteItem; path: string }[] {
		return this.notes.getDeletedNotes().map((note) => {
			const folderPath = note.folderId ? this.tree.getFolderPath(note.folderId) : null;
			const path = folderPath ? `${folderPath}/${note.title}:${note.id}` : `${note.title}:${note.id}`;
			return { note: snapshotNote(note), path };
		});
	}
}
