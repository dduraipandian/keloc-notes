import { groupNotesByDate } from '$lib/utils';
import { folderStore, type FolderID, type FolderItem } from '$lib/stores/folders.svelte';
import { notesStore, type NoteItem } from '$lib/stores/notes.svelte';
import { folderService, noteService } from '$lib/stores/services';
import { selectionStore } from '$lib/stores/selection.svelte';
import { resolveProfile, ICON_REGISTRY } from '$lib/stores/domain/profiles';

export class NoteListView {
	constructor(
		private readonly folders = folderStore,
		private readonly notes = notesStore,
		private readonly folderQueries = folderService,
		private readonly noteQueries = noteService,
		private readonly selection = selectionStore
	) {}

	getSelectedFolderIconConfig() {
		const folder = this.selection.getSelectedFolder();
		if (!folder) return ICON_REGISTRY.folder;
		const profile = resolveProfile(folder);
		return ICON_REGISTRY[profile.iconName];
	}

	getSelectedFolderTitle() {
		const folder = this.selection.getSelectedFolder();
		if (!folder) return 'Notes';
		const profile = resolveProfile(folder);
		return profile.title || folder.title || 'Notes';
	}

	canCreateNote() {
		const selectedFolder = this.selection.getSelectedFolder();
		if (!selectedFolder) return true; // Default to allowing creation at root (Home)
		return resolveProfile(selectedFolder).capabilities.createNote;
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
			selectedFolder?.profile
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
			return { isHierarchical: false, targetName: 'Home' };
		}

		const parentFolder = this.folders.findItemById(note.folderId);
		const isHomeTarget = !parentFolder || parentFolder.deletedAt != null;

		return {
			isHierarchical: false,
			targetName: isHomeTarget ? 'Home' : parentFolder.title
		};
	}
}

export const noteListView = new NoteListView();
