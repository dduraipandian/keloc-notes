import { loadNotesState, saveNotesState } from './idb';
import { folderStore, type FolderType } from './folders.svelte';

export type NoteItem = {
	id: string;
	folderId: string | null;
	title: string;
	content: string;
	updatedAt: string;
};

class NotesStore {
	allNotes = $state<NoteItem[]>([]);
	selectedNoteId = $state<string | null>(null);
	private isInitialized = false;

	constructor(initialNotes: NoteItem[] = []) {
		this.allNotes = initialNotes;
	}

	async init() {
		if (this.isInitialized) return;

		try {
			const savedState = await loadNotesState();
			if (savedState) {
				this.allNotes = savedState.notes;
				this.selectedNoteId = savedState.selectedNoteId;
			}
			this.isInitialized = true;
		} catch (error) {
			console.error('Failed to load notes from storage:', error);
			throw error;
		}
	}

	persist() {
		if (!this.isInitialized) return;
		saveNotesState({
			notes: $state.snapshot(this.allNotes),
			selectedNoteId: this.selectedNoteId
		});
	}

	get selectedNote(): NoteItem | null {
		return this.allNotes.find((n) => n.id === this.selectedNoteId) ?? null;
	}

	getNotesForFolder(folderId: string | null, folderType?: FolderType): NoteItem[] {
		return this.allNotes
			.filter((n) => (folderType === 'all' ? true : n.folderId === folderId))
			.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
	}
	getNoteCountForFolder(folderId: string | null, folderType?: FolderType): number {
		return this.allNotes.filter((n) => (folderType === 'all' ? true : n.folderId === folderId))
			.length;
	}

	createNote(folderId: string | null) {
		let actualFolderId = folderId;
		const folder = folderId ? folderStore.findItemById(folderStore.items, folderId) : null;

		if (!folderId || folder?.type === 'all' || folder?.type === 'trash') {
			actualFolderId = folderStore.getDefaultFolderId();
		}

		const newNote: NoteItem = {
			id: crypto.randomUUID(),
			folderId: actualFolderId,
			title: 'Untitled Note',
			content: '',
			updatedAt: new Date().toISOString()
		};
		this.allNotes.unshift(newNote);
		this.selectedNoteId = newNote.id;
		this.persist();
	}

	updateNote(id: string, updates: Partial<Omit<NoteItem, 'id'>>) {
		const note = this.allNotes.find((n) => n.id === id);
		if (note) {
			Object.assign(note, {
				...updates,
				updatedAt: new Date().toISOString()
			});
			this.persist();
		}
	}

	deleteNote(id: string) {
		this.allNotes = this.allNotes.filter((n) => n.id !== id);
		if (this.selectedNoteId === id) {
			this.selectedNoteId = null;
		}
		this.persist();
	}

	selectNote(id: string | null) {
		this.selectedNoteId = id;
		this.persist();
	}
}

const initialMockNotes: NoteItem[] = [
	{
		id: '1',
		folderId: 'notes',
		title: 'Weekly Goals',
		content: '15-SEP-2025, Monday\n- Complete UI framework component test cases\n- Understand B-Tree in depth',
		updatedAt: '2025-09-15T08:48:00Z'
	},
	{
		id: '2',
		folderId: 'notes',
		title: 'Methodologies',
		content: 'Rice Theorem - Let S be a set of languages...',
		updatedAt: '2025-08-25T10:00:00Z'
	},
	{
		id: '3',
		folderId: 'notes',
		title: 'Tech Blogs',
		content: 'Function Point Analysis - Measuring software size...',
		updatedAt: '2022-03-15T14:30:00Z'
	},
	{
		id: '4',
		folderId: 'work',
		title: 'Sprint Planning',
		content: 'Discussing the new sidebar architecture...',
		updatedAt: new Date().toISOString()
	}
];

export const notesStore = new NotesStore(initialMockNotes);
