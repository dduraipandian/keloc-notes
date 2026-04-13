import { groupNotesByDate } from '$lib/utils';
import { folderStore, type FolderID, type FolderItem, type FolderType } from './folders.svelte';
import { notesStore, type NoteItem } from './notes.svelte';
import { folderService, noteService } from './services';
import { selectionStore } from './selection.svelte';
import { getSource, listSidebarSectionSources } from './sources/registry.svelte';
import {
	SIDEBAR_SECTIONS,
	type NoteSource,
	type SidebarSectionDefinition,
	type SidebarSectionPlacement,
	type SourceIconKey
} from './sources/types';

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
	currentSource?: NoteSource | null;
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
	kind: NoteSource['kind'];
	iconKey: SourceIconKey;
	title: string;
	depth: number;
	isSelected: boolean;
	isEditing: boolean;
	isOpen: boolean;
	noteCount: number;
	children: SidebarSourceItem[];
	capabilities: {
		create: boolean;
		rename: boolean;
		delete: boolean;
		setFavorite: boolean;
		recover: boolean;
		permanentDelete: boolean;
		emptyTrash: boolean;
	};
};

export type SidebarSourceSection = {
	id: SidebarSectionDefinition['id'];
	label: string | null;
	placement: SidebarSectionPlacement;
	sources: SidebarSourceItem[];
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
		if (this.selection.currentSource) {
			return this.selection.currentSource.capabilities.canCreateNote;
		}

		const selectedFolder = this.selection.getSelectedFolder();
		return (
			selectedFolder?.type !== 'trash' &&
			selectedFolder?.type !== 'system' &&
			selectedFolder?.type !== 'all'
		);
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
		private readonly selection: SelectionStoreLike = selectionStore
	) {}

	getSections(): SidebarSourceSection[] {
		return SIDEBAR_SECTIONS
			.map((section) => ({
				id: section.id,
				label: section.label,
				placement: section.placement,
				sources: listSidebarSectionSources(section.id).map((source) => this.buildSource(source, 0))
			}))
			.filter((section) => section.sources.length > 0);
	}

	private buildSource(source: NoteSource, depth: number): SidebarSourceItem {
		const item =
			this.folders.folders.get(source.id) ??
			({
				id: source.id,
				title: source.title,
				url: '#'
			} satisfies FolderItem);
		const children = source
			.getChildren()
			.map((id) => getSource(id))
			.filter((child): child is NoteSource => !!child)
			.map((child) => this.buildSource(child, depth + 1));

		return {
			id: source.id,
			item,
			kind: source.kind,
			iconKey: source.iconKey,
			title: source.title,
			depth,
			isSelected: this.selection.selectedFolderID === source.id,
			isEditing: this.folders.editingId === source.id,
			isOpen: item.isOpen ?? false,
			noteCount: source.getCount(),
			children,
			capabilities: {
				create: source.capabilities.canCreateSubfolder,
				rename: source.capabilities.canRename,
				delete: source.capabilities.canDelete,
				setFavorite: source.capabilities.canSetFavorite,
				recover: item.deletedAt != null,
				permanentDelete: item.deletedAt != null,
				emptyTrash: source.capabilities.canEmpty && item.deletedAt == null
			}
		};
	}
}

export const noteListSelector = new NoteListSelector();
export const folderSidebarSelector = new FolderSidebarSelector();
