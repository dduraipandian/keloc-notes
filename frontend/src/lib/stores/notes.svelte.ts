import { SvelteMap } from 'svelte/reactivity';
import { notesRepository, settingsRepository } from './repositories';
import type { FolderID } from './folders.svelte';

export type NoteID = string;

export type NoteItem = {
	id: NoteID;
	folderId: string | null;
	title: string;
	content: string;
	updatedAt: string;
	isFavorite?: boolean;
	deletedAt?: number | null;
};

class NotesStore {
	notes = new SvelteMap<NoteID, NoteItem>();
	selectedNoteID = $state<NoteID | null>(null);
	private isInitialized = false;

	constructor(initialNotes: NoteItem[] = []) {
		if (initialNotes.length > 0) {
			initialNotes.forEach((n) => {
				let ns = $state(n);
				this.notes.set(n.id, ns);
			});
		}
	}

	async init() {
		if (this.isInitialized) return;

		try {
			const allNotesData = await notesRepository.list();
			const settings = await settingsRepository.getAll();
			let allNotes: NoteItem[] = [];

			allNotesData.forEach((note) => {
				if (note && note.id) {
					if (note.deletedAt === undefined) note.deletedAt = null;
					if (note.isFavorite === undefined) note.isFavorite = false;
					let n = $state(note);
					allNotes.push(n);
				}
			});
			this.notes.clear();

			if (allNotes) {
				allNotes.forEach((note) => {
					this.notes.set(note.id, note);
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

	persist(id: NoteID | null) {
		if (!this.isInitialized) return;
		if (id) {
			const note = this.notes.get(id);
			if (note) {
				notesRepository.save($state.snapshot(note));
			}
		}
		settingsRepository.save('selectedNoteID', this.selectedNoteID);
	}

	get selectedNote(): NoteItem | null {
		if (!this.selectedNoteID) return null;

		return this.notes.get(this.selectedNoteID) || null;
	}

	getNote(id: NoteID): NoteItem | null {
		return this.notes.get(id) || null;
	}

	createNote(folderId: FolderID | null) {
		const newNote: NoteItem = {
			id: crypto.randomUUID(),
			folderId,
			title: 'Untitled Note',
			content: '',
			updatedAt: new Date().toISOString(),
			isFavorite: false,
			deletedAt: null
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

	deleteNote(id: NoteID, batchTimestamp?: number) {
		const note = this.notes.get(id);
		if (this.selectedNoteID === id) {
			this.selectedNoteID = null;
		}
		if (note) {
			note.deletedAt = batchTimestamp ?? Date.now();
			this.notes.set(id, note);
		}
		this.persist(id);
	}

	restoreNote(id: NoteID, folderId?: string | null) {
		const note = this.notes.get(id);
		if (note) {
			if (folderId !== undefined) note.folderId = folderId;
			note.deletedAt = null;
			this.notes.set(id, note);
			this.persist(id);
		}
	}

	deleteNotesInFolder(folderId: string, batchTimestamp: number) {
		const allNotes = Array.from(this.notes.values());
		for (const note of allNotes) {
			if ((note.folderId ?? 'root') === folderId && note.deletedAt == null) {
				note.deletedAt = batchTimestamp;
				this.notes.set(note.id, note);
				if (this.selectedNoteID === note.id) {
					this.selectedNoteID = null;
				}
				this.persist(note.id);
			}
		}
	}

	restoreNotesInFolder(folderId: string, targetBatch?: number) {
		const allNotes = Array.from(this.notes.values());
		for (const note of allNotes) {
			if ((note.folderId ?? 'root') === folderId && note.deletedAt != null) {
				if (!targetBatch || note.deletedAt === targetBatch) {
					note.deletedAt = null;
					this.notes.set(note.id, note);
					this.persist(note.id);
				}
			}
		}
	}
	getNotesToArchive(folderId: string, targetBatch: number): NoteItem[] {
		return Array.from(this.notes.values()).filter(
			(n) => (n.folderId ?? 'root') === folderId && n.deletedAt === targetBatch
		);
	}

	getDeletedNotes(): NoteItem[] {
		return Array.from(this.notes.values()).filter((n) => n.deletedAt != null);
	}

	listNotes(): NoteItem[] {
		return Array.from(this.notes.values());
	}

	setFavorite(id: NoteID, isFavorite: boolean) {
		const note = this.notes.get(id);
		if (!note) return;
		note.isFavorite = isFavorite;
		this.notes.set(id, note);
		this.persist(id);
	}

	removeNoteLocally(id: string) {
		this.notes.delete(id);
		this.clearSelectionIfSelected(id);
	}

	clearSelectionIfSelected(id: string) {
		if (this.selectedNoteID === id) {
			this.selectedNoteID = null;
			if (this.isInitialized) {
				settingsRepository.save('selectedNoteID', null);
			}
		}
	}

	selectNote(id: NoteID | null) {
		this.selectedNoteID = id;
		this.persist(id);
	}
}

export const notesStore = new NotesStore([]);
