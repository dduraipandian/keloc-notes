import { SvelteMap } from 'svelte/reactivity';
import { getAllNotes, getAllSettings, putNote, putSetting } from './idbr';
import { folderStore, type FolderType, type FolderID } from './folders.svelte';

export type NoteID = string;

export type NoteItem = {
	id: NoteID;
	folderId: string | null;
	title: string;
	content: string;
	updatedAt: string;
};

class NotesStore {
	allNotes = $state<NoteItem[]>([]);
	notes = new SvelteMap<NoteID, NoteItem>();
	folderNotes = new SvelteMap<FolderID, NoteID[]>();
	selectedNoteID = $state<NoteID | null>(null);
	private isInitialized = false;

	constructor(initialNotes: NoteItem[] = []) {
		this.allNotes = initialNotes;
	}

	async init() {
		if (this.isInitialized) return;

		try {
			const allNotes = await getAllNotes();
			const settings = await getAllSettings();

			if (allNotes) {
				allNotes.forEach((note) => {
					let n = $state(note);
					this.notes.set(note.id, n);
				});
				if (settings && settings.selectedNoteID) {
					this.selectedNoteID = settings.selectedNoteID;
				}
			}
			this.isInitialized = true;
		} catch (error) {
			console.error('Failed to load notes from storage:', error);
			throw error;
		}
	}

	persist(id: NoteID) {
		if (!this.isInitialized) return;
		const note = this.notes.get(id);
		if (note) {
			putNote($state.snapshot(note));
		}
		putSetting('selectedNoteID', this.selectedNoteID);
	}

	get selectedNote(): NoteItem | null {
		if (!this.selectedNoteID) return null;

		return this.notes.get(this.selectedNoteID) || null;
	}

	getNotesForFolder(folderId: string | null, folderType?: FolderType): NoteItem[] {
		return Array.from(this.notes.values())
			.filter((n) => (folderType === 'all' ? true : n.folderId === folderId))
			.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
	}
	getNoteCountForFolder(folderId: string | null, folderType?: FolderType): number {
		return Array.from(this.notes.values()).filter((n) =>
			folderType === 'all' ? true : n.folderId === folderId
		).length;
	}

	createNote(folderId: FolderID | null) {
		let actualFolderId = folderId;
		const folder = folderId ? folderStore.findItemById(folderId) : null;

		console.log('Create note under: ', folderId, $state.snapshot(folder));
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
		let n = $state(newNote);
		this.notes.set(newNote.id, n);
		this.selectedNoteID = newNote.id;
		this.persist(newNote.id);
	}

	updateNote(id: NoteID, updates: Partial<Omit<NoteItem, 'id'>>) {
		const note = this.notes.get(id);
		if (note) {
			Object.assign(note, {
				...updates,
				updatedAt: new Date().toISOString()
			});
			this.persist(id);
		}
	}

	deleteNote(id: NoteID) {
		this.notes.delete(id);
		if (this.selectedNoteID === id) {
			this.selectedNoteID = null;
		}
		// this.persist(id);
	}

	selectNote(id: NoteID | null) {
		this.selectedNoteID = id;
		if (id) this.persist(id);
	}
}

const initialMockNotes: NoteItem[] = [
	{
		id: '1',
		folderId: 'notes',
		title: 'Weekly Goals',
		content:
			'15-SEP-2025, Monday\n- Complete UI framework component test cases\n- Understand B-Tree in depth',
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

export const notesStore = new NotesStore([]);
