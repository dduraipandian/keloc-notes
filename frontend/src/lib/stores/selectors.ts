import { groupNotesByDate } from '$lib/utils';
import { folderStore, type FolderID, type FolderItem, type FolderType } from './folders.svelte';
import { notesStore, type NoteItem } from './notes.svelte';
import { folderService, noteService } from './services';
import { selectionStore } from './selection.svelte';

type FolderStoreLike = {
	items: FolderID[];
	editingId?: FolderID | null;
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
	getFavoriteFolderIds(): FolderID[];
};

type NoteServiceLike = {
	getNotesForFolder(folderId: FolderID | null, folderType?: FolderType): NoteItem[];
	getNoteCountForFolder(folderId: FolderID | null, folderType?: FolderType): number;
};

export type SidebarSourceItem = {
	id: FolderID;
	item: FolderItem;
	kind: 'folder' | 'trash' | 'favorites';
	title: string;
	depth: number;
	isTrashTree: boolean;
	isTrashRoot: boolean;
	isSelected: boolean;
	isEditing: boolean;
	isOpen: boolean;
	noteCount: number;
	children: SidebarSourceItem[];
	capabilities: {
		create: boolean;
		rename: boolean;
		delete: boolean;
		recover: boolean;
		permanentDelete: boolean;
		emptyTrash: boolean;
	};
};

export type SidebarSourceSection = {
	id: 'views' | 'folders';
	label: string | null;
	sources: SidebarSourceItem[];
};

type SidebarSourceRegistryEntry = {
	id: SidebarSourceSection['id'];
	label: string | null;
	getRoots(selector: FolderSidebarSelector): FolderItem[];
};

export class NoteListSelector {
	constructor(
		private readonly folders: FolderStoreLike = folderStore,
		private readonly notes: NotesStoreLike = notesStore,
		private readonly folderQueries: FolderServiceLike = folderService,
		private readonly noteQueries: NoteServiceLike = noteService,
		private readonly selection: SelectionStoreLike = selectionStore
	) {}

	getSelectedFolderTitle() {
		return this.selection.getSelectedFolder()?.title ?? 'Notes';
	}

	canCreateNote() {
		const selectedFolder = this.selection.getSelectedFolder();
		return selectedFolder?.type !== 'trash' && selectedFolder?.type !== 'system';
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
	private static readonly registry: SidebarSourceRegistryEntry[] = [
		{
			id: 'views',
			label: null,
			getRoots(selector) {
				return ['deleted-notes', 'favorites']
					.map((id) => selector.folders.folders.get(id))
					.filter((item): item is FolderItem => !!item);
			}
		},
		{
			id: 'folders',
			label: 'Folders',
			getRoots(selector) {
				return (selector.folders.items ?? [])
					.map((itemId) => selector.folders.folders.get(itemId))
					.filter(
						(item): item is FolderItem =>
							!!item && item.deletedAt == null && item.type !== 'trash' && item.type !== 'system'
					);
			}
		}
	];

	constructor(
		private readonly folders: FolderStoreLike = folderStore,
		private readonly folderQueries: FolderServiceLike = folderService,
		private readonly noteQueries: NoteServiceLike = noteService,
		private readonly selection: SelectionStoreLike = selectionStore
	) {}

	getSections(): SidebarSourceSection[] {
		return FolderSidebarSelector.registry
			.map((entry) => ({
				id: entry.id,
				label: entry.label,
				sources: entry.getRoots(this).map((item) => this.buildSource(item, 0, entry.id === 'views'))
			}))
			.filter((section) => section.id === 'folders' || section.sources.length > 0);
	}

	private buildSource(item: FolderItem, depth: number, isTrashTree = false): SidebarSourceItem {
		const isTrashRoot = item.type === 'trash';
		const isFavoritesRoot = item.id === 'favorites';
		const childIds = isTrashRoot
			? this.folderQueries.getTrashRootIds()
			: isFavoritesRoot
				? this.folderQueries.getFavoriteFolderIds()
				: item.items || [];
		const visibleChildIds =
			isTrashRoot || isFavoritesRoot || !isTrashTree
				? childIds.filter((id) => isTrashRoot || this.folders.folders.get(id)?.deletedAt == null)
				: [];

		return {
			id: item.id,
			item,
			kind: isTrashRoot ? 'trash' : isFavoritesRoot ? 'favorites' : 'folder',
			title: item.title,
			depth,
			isTrashTree,
			isTrashRoot,
			isSelected: this.selection.selectedFolderID === item.id,
			isEditing: this.folders.editingId === item.id,
			isOpen: item.isOpen ?? false,
			noteCount: this.noteQueries.getNoteCountForFolder(item.id, item.type),
			children: visibleChildIds
				.map((id) => this.folders.folders.get(id))
				.filter((child): child is FolderItem => !!child)
				.map((child) => this.buildSource(child, depth + 1, isTrashTree || isTrashRoot)),
			capabilities: {
				create: item.deletedAt == null && item.type !== 'system',
				rename:
					item.deletedAt == null && !isTrashTree && item.type !== 'system' && item.type !== 'trash',
				delete:
					item.deletedAt == null && !isTrashTree && item.type !== 'system' && item.type !== 'trash',
				recover: item.deletedAt != null,
				permanentDelete: item.deletedAt != null,
				emptyTrash: isTrashTree && item.deletedAt == null
			}
		};
	}
}

export const noteListSelector = new NoteListSelector();
export const folderSidebarSelector = new FolderSidebarSelector();
