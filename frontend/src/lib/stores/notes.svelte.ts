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
	deletedAt?: number | null;
};

class NotesStore {
	notes = new SvelteMap<NoteID, NoteItem>();
	folderNotes = new SvelteMap<FolderID, NoteID[]>();
	selectedNoteID = $state<NoteID | null>(null);
	private isInitialized = false;

	constructor(initialNotes: NoteItem[] = []) {
		if (initialNotes.length > 0) {
			initialNotes.forEach((n) => {
				let ns = $state(n);
				this.notes.set(n.id, ns);
				this.addToIndex(n.folderId, n.id);
			});
		}
	}

	private addToIndex(folderId: string | null, noteId: NoteID) {
		const fid = folderId ?? 'root';
		if (!this.folderNotes.has(fid)) {
			let n = $state([]);
			this.folderNotes.set(fid, n);
		}
		this.folderNotes.get(fid)!.push(noteId);
	}

	private removeFromIndex(folderId: string | null, noteId: NoteID) {
		const fid = folderId ?? 'root';
		const notes = this.folderNotes.get(fid);
		if (notes) {
			const index = notes.indexOf(noteId);
			if (index !== -1) {
				notes.splice(index, 1);
			}
		}
	}

	async init() {
		if (this.isInitialized) return;

		try {
			const allNotesData = await getAllNotes();
			const settings = await getAllSettings();
			let allNotes: NoteItem[] = [];
			let deletedNotes: NoteItem[] = [];

			allNotesData.forEach((note) => {
				if (note && note.id) {
					if (note.deletedAt === undefined) note.deletedAt = null;
					let n = $state(note);
					allNotes.push(n);
				}
			});
			this.notes.clear();
			this.folderNotes.clear();

			if (allNotes) {
				allNotes.forEach((note) => {
					this.notes.set(note.id, note);
					this.addToIndex(note.folderId, note.id);
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
		let resultNotes: NoteItem[] = [];
		const allNotes = Array.from(this.notes.values());

		if (folderType === 'all') {
			resultNotes = allNotes.filter((n) => n.deletedAt == null);
		} else if (folderId === 'deleted-notes') {
			resultNotes = allNotes.filter((n) => n.deletedAt != null);
		} else {
			const fid = folderId ?? 'root';
			const currentFolder = folderStore.findItemById(folderId || '');
			if (currentFolder && currentFolder.deletedAt != null) {
				resultNotes = allNotes.filter((n) => n.folderId === fid && n.deletedAt != null);
			} else {
				resultNotes = allNotes.filter((n) => n.folderId === fid && n.deletedAt == null);
			}
		}

		return resultNotes.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
	}

	getNoteCountForFolder(folderId: string | null, folderType?: FolderType): number {
		const allNotes = Array.from(this.notes.values());
		
		if (folderType === 'all') {
			return allNotes.filter((n) => n.deletedAt == null).length;
		} else if (folderId === 'deleted-notes') {
			return allNotes.filter((n) => n.deletedAt != null).length;
		}
		
		const fid = folderId ?? 'root';
		const currentFolder = folderStore.findItemById(folderId || '');
		
		if (currentFolder && currentFolder.deletedAt != null) {
			return allNotes.filter((n) => n.folderId === fid && n.deletedAt != null).length;
		}
		
		return allNotes.filter((n) => n.folderId === fid && n.deletedAt == null).length;
	}

	createNote(folderId: FolderID | null) {
		let actualFolderId = folderId;
		const folder = folderId ? folderStore.findItemById(folderId) : null;

		if (!folderId || folder?.type === 'all' || folder?.type === 'trash') {
			actualFolderId = folderStore.getDefaultFolderId();
		}

		const newNote: NoteItem = {
			id: crypto.randomUUID(),
			folderId: actualFolderId,
			title: 'Untitled Note',
			content: '',
			updatedAt: new Date().toISOString(),
			deletedAt: null
		};
		let n = $state(newNote);
		this.notes.set(newNote.id, n);
		this.addToIndex(actualFolderId, newNote.id);
		this.selectedNoteID = newNote.id;
		this.persist(newNote.id);
	}

	updateNote(id: NoteID, updates: Partial<Omit<NoteItem, 'id'>>) {
		const note = this.notes.get(id);
		if (note) {
			const oldFolderId = note.folderId;
			Object.assign(note, {
				...updates,
				updatedAt: new Date().toISOString()
			});

			if (updates.folderId !== undefined && updates.folderId !== oldFolderId) {
				this.removeFromIndex(oldFolderId, id);
				this.addToIndex(updates.folderId, id);
			}

			this.persist(id);
		}
	}

	deleteNote(id: NoteID, batchTimestamp?: number) {
		const note = this.notes.get(id);
		if (note) {
			note.deletedAt = batchTimestamp ?? Date.now();
			this.notes.set(id, note);
			this.persist(id);
		}

		if (this.selectedNoteID === id) {
			this.selectedNoteID = null;
		}
	}

	recoverNote(id: NoteID) {
		const note = this.notes.get(id);
		if (note) {
			note.deletedAt = null;
			this.notes.set(id, note);
			this.persist(id);
			if (note.folderId) {
				const f = folderStore.findItemById(note.folderId);
				if (f && f.deletedAt != null) {
					folderStore.recoverFolderAndChildren(note.folderId, false);
				}
			}
		}
	}

	deleteNotesInFolder(folderId: string, batchTimestamp: number) {
		const allNotes = Array.from(this.notes.values());
		for (const note of allNotes) {
			if (note.folderId === folderId && note.deletedAt == null) {
				note.deletedAt = batchTimestamp;
				this.notes.set(note.id, note);
				this.persist(note.id);
				if (this.selectedNoteID === note.id) {
					this.selectedNoteID = null;
				}
			}
		}
	}

	recoverNotesInFolder(folderId: string, targetBatch?: number) {
		const allNotes = Array.from(this.notes.values());
		for (const note of allNotes) {
			if (note.folderId === folderId && note.deletedAt != null) {
				if (!targetBatch || note.deletedAt === targetBatch) {
					note.deletedAt = null;
					this.notes.set(note.id, note);
					this.persist(note.id);
				}
			}
		}
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
