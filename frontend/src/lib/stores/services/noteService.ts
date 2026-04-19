import type { FolderID } from '../folders.svelte';
import type { NoteID, NoteItem } from '../notes.svelte';
import type { FolderStoreLike, NotesStoreLike, SelectionStoreLike } from './types';
import { FolderTreeHelper } from '../domain/folderTree';
import { resolveProfile } from '../domain/profiles';

export class NoteService {
	private readonly tree: FolderTreeHelper;
	private readonly selection: SelectionStoreLike;

	constructor(
		private readonly folders: FolderStoreLike,
		private readonly notes: NotesStoreLike,
		selection: SelectionStoreLike
	) {
		this.tree = new FolderTreeHelper(folders, notes);
		this.selection = selection;
	}

	create(folderId: FolderID | null, { silent = false }: { silent?: boolean } = {}) {
		const actualFolderId = (folderId === 'home' || folderId === null) ? null : folderId;
		const folder = actualFolderId ? this.folders.findItemById(actualFolderId) : this.folders.findItemById('home');

		if (!folder || !resolveProfile(folder).capabilities.createNote) {
			const defaultId = this.folders.getDefaultFolderId();
			if (!silent) this.selection.selectFolder(defaultId);
			return this.notes.createNote(defaultId);
		} else {
			if (!silent) this.selection.selectFolder(folderId);
			return this.notes.createNote(folderId);
		}
	}

	update(noteId: NoteID, updates: Partial<Omit<NoteItem, 'id'>>, opts?: { updatedTimestamp?: boolean }) {
		this.notes.updateNote(noteId, updates, opts);
	}

	select(noteId: NoteID | null) {
		this.notes.selectNote(noteId);
	}

	delete(noteId: NoteID, deletedBatchId?: string) {
		const currentFolder = this.selection.getSelectedFolder();
		const visibleNotes = this.tree.getNotesForFolder(
			this.selection.selectedFolderID ?? null,
			currentFolder?.profile
		);
		const currentIndex = visibleNotes.findIndex((note) => note.id === noteId);
		let nextNoteId: NoteID | null = null;

		if (currentIndex >= 0) {
			if (visibleNotes[currentIndex + 1]) {
				nextNoteId = visibleNotes[currentIndex + 1].id;
			} else if (visibleNotes[currentIndex - 1]) {
				nextNoteId = visibleNotes[currentIndex - 1].id;
			}
		}

		this.notes.deleteNote(noteId, Date.now(), deletedBatchId);
		this.notes.selectNote(nextNoteId);
	}

	setFavorite(noteId: NoteID, isFavorite: boolean) {
		this.notes.setFavorite(noteId, isFavorite);
	}

	getNotesForFolder(folderId: FolderID | null, folderProfile?: string) {
		return this.tree.getNotesForFolder(folderId, folderProfile);
	}

	getNoteCountForFolder(folderId: FolderID | null, folderProfile?: string) {
		return this.notes.getNoteCount(folderId, folderProfile);
	}

	async getExportData(ids: NoteID[]) {
		if (ids.length === 0) return [];

		const results: Array<{
			title: string;
			content: string;
			updatedAt: string;
			folderId: string | null;
		}> = [];

		// Chunk processing for scalability and main-thread stability
		const CHUNK_SIZE = 50;
		for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
			const chunkIds = ids.slice(i, i + CHUNK_SIZE);
			const contents = await this.notes.getBulkNoteContents(chunkIds);

			chunkIds.forEach((id) => {
				const note = this.notes.getNote(id);
				if (note) {
					results.push({
						title: note.title,
						content: contents[id] ?? note.content,
						updatedAt: note.updatedAt,
						folderId: note.folderId
					});
				}
			});
		}

		return results;
	}

	async getNotesForExport(ids: NoteID[]) {
		const harvested = await this.getExportData(ids);
		return harvested.map((note) => {
			let folderPath = '';
			if (note.folderId) {
				folderPath = this.tree.getPlainFolderPath(note.folderId);
			}

			return {
				title: note.title,
				content: note.content,
				folderPath,
				updatedAt: new Date(note.updatedAt ?? 0).toISOString()
			};
		});
	}
}
