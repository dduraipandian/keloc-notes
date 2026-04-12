import { groupNotesByDate } from '$lib/utils';
import { folderStore, type FolderID, type FolderItem, type FolderType } from './folders.svelte';
import { notesStore, type NoteItem } from './notes.svelte';
import { folderService, noteService } from './services';
import { selectionStore } from './selection.svelte';

type FolderStoreLike = {
	items: FolderID[];
	selectedFolderID: FolderID | null;
	editingId?: FolderID | null;
	getSelectedFolder(): FolderItem | null;
	folders: Map<FolderID, FolderItem>;
};

type NotesStoreLike = {
	selectedNote: NoteItem | null;
	selectedNoteID: string | null;
};

type SelectionStoreLike = {
	selectedFolderID: FolderID | null;
	getSelectedFolder(): FolderItem | null;
};

type FolderServiceLike = {
	findTopDeletedAncestor(folderId: FolderID): FolderItem | null;
	getTrashRootIds(): FolderID[];
};

type NoteServiceLike = {
	getNotesForFolder(folderId: FolderID | null, folderType?: FolderType): NoteItem[];
	getNoteCountForFolder(folderId: FolderID | null, folderType?: FolderType): number;
};

function createSelectionAdapter(folders: FolderStoreLike): SelectionStoreLike {
	return {
		get selectedFolderID() {
			return folders.selectedFolderID;
		},
		getSelectedFolder() {
			return folders.getSelectedFolder();
		}
	};
}

export class NoteListSelector {
	constructor(
		private readonly folders: FolderStoreLike = folderStore,
		private readonly notes: NotesStoreLike = notesStore,
		private readonly folderQueries: FolderServiceLike = folderService,
		private readonly noteQueries: NoteServiceLike = noteService,
		private readonly selection: SelectionStoreLike =
			folders === folderStore ? selectionStore : createSelectionAdapter(folders)
	) {}

	getSelectedFolderTitle() {
		return this.selection.getSelectedFolder()?.title ?? 'Notes';
	}

	canCreateNote() {
		return this.selection.selectedFolderID !== 'deleted-notes';
	}

	canDeleteSelectedNote() {
		return !!(this.notes.selectedNote && this.notes.selectedNote.deletedAt == null);
	}

	getSelectedNoteDeleteContext() {
		if (!this.canDeleteSelectedNote() || !this.notes.selectedNoteID || !this.notes.selectedNote) {
			return null;
		}

		return {
			id: this.notes.selectedNoteID,
			title: this.notes.selectedNote.title
		};
	}

	isSelectedNote(noteId: string) {
		return this.notes.selectedNoteID === noteId;
	}

	getCreateNoteFolderId() {
		return this.selection.getSelectedFolder()?.id ?? null;
	}

	getFilteredNotes(searchQuery: string) {
		const normalizedQuery = searchQuery.trim().toLowerCase();
		const selectedFolder = this.selection.getSelectedFolder();
		const visibleNotes = this.noteQueries.getNotesForFolder(
			this.selection.selectedFolderID ?? null,
			selectedFolder?.type
		);

		if (!normalizedQuery) return visibleNotes;

		return visibleNotes.filter(
			(note) =>
				note.title.toLowerCase().includes(normalizedQuery) ||
				note.content.toLowerCase().includes(normalizedQuery)
		);
	}

	getSections(searchQuery: string) {
		return groupNotesByDate(this.getFilteredNotes(searchQuery));
	}

	getRestoreContext(note: NoteItem | null) {
		if (!note?.folderId) {
			return { isHierarchical: false, topDeletedAncestor: null };
		}

		const topDeletedAncestor = this.folderQueries.findTopDeletedAncestor(note.folderId);
		return {
			isHierarchical: !!topDeletedAncestor,
			topDeletedAncestor
		};
	}
}

export class FolderSidebarSelector {
	constructor(
		private readonly folders: FolderStoreLike = folderStore,
		private readonly folderQueries: FolderServiceLike = folderService,
		private readonly noteQueries: NoteServiceLike = noteService,
		private readonly selection: SelectionStoreLike =
			folders === folderStore ? selectionStore : createSelectionAdapter(folders)
	) {}

	getRootItems() {
		return this.folders.items
			.map((itemId) => this.folders.folders.get(itemId))
			.filter((item): item is FolderItem => !!item);
	}

	isSelectedFolder(folderId: FolderID) {
		return this.selection.selectedFolderID === folderId;
	}

	isEditingFolder(folderId: FolderID) {
		return this.folders.editingId === folderId;
	}

	getNoteCount(item: FolderItem) {
		return this.noteQueries.getNoteCountForFolder(item.id, item.type);
	}

	getVisibleChildIds(item: FolderItem, isTrashTree = false) {
		const isTrashRoot = item.type === 'trash';
		const childIds = isTrashRoot ? this.folderQueries.getTrashRootIds() : item.items || [];

		if (isTrashRoot) return childIds;
		if (isTrashTree) return [];

		return childIds.filter((id) => this.folders.folders.get(id)?.deletedAt == null);
	}
}

export const noteListSelector = new NoteListSelector();
export const folderSidebarSelector = new FolderSidebarSelector();
