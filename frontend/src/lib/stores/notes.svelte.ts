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
	private isInitialized = false;
	counts = $state({
		byFolder: new SvelteMap<string | null, number>(),
		favorites: 0,
		trash: 0
	});

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
				this.recalculateCounts();
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

	private recalculateCounts() {
		this.counts.byFolder.clear();
		this.counts.favorites = 0;
		this.counts.trash = 0;

		for (const note of this.notes.values()) {
			if (note.deletedAt != null) {
				this.counts.trash++;
			} else {
				const folderId = note.folderId ?? null;
				this.counts.byFolder.set(folderId, (this.counts.byFolder.get(folderId) ?? 0) + 1);
				if (note.isFavorite) {
					this.counts.favorites++;
				}
			}
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

		// Update counts
		this.counts.byFolder.set(folderId, (this.counts.byFolder.get(folderId) ?? 0) + 1);

		this.selectedNoteID = newNote.id;
		this.persist(newNote.id);
	}

	updateNote(id: NoteID, updates: Partial<Omit<NoteItem, 'id'>>) {
		const note = this.notes.get(id);
		if (note) {
			const oldFolderId = note.folderId ?? null;
			const oldIsFavorite = !!note.isFavorite;
			const oldDeletedAt = note.deletedAt;

			Object.assign(note, {
				...updates,
				updatedAt: new Date().toISOString()
			});

			// If any of the count-affecting properties changed, update counts
			if (oldDeletedAt === null && note.deletedAt === null) {
				// We were and are active, check movements
				if (updates.folderId !== undefined && updates.folderId !== oldFolderId) {
					const newFolderId = updates.folderId ?? null;
					this.counts.byFolder.set(oldFolderId, (this.counts.byFolder.get(oldFolderId) ?? 0) - 1);
					this.counts.byFolder.set(newFolderId, (this.counts.byFolder.get(newFolderId) ?? 0) + 1);
				}
				if (updates.isFavorite !== undefined && updates.isFavorite !== oldIsFavorite) {
					this.counts.favorites += updates.isFavorite ? 1 : -1;
				}
			} else if (oldDeletedAt === null && note.deletedAt !== null) {
				// This case is usually handled by deleteNote, but just in case updateNote is used
				this.counts.byFolder.set(oldFolderId, (this.counts.byFolder.get(oldFolderId) ?? 0) - 1);
				this.counts.trash++;
				if (oldIsFavorite) this.counts.favorites--;
			} else if (oldDeletedAt !== null && note.deletedAt === null) {
				// This case is usually handled by restoreNote
				const currentFolderId = note.folderId ?? null;
				this.counts.byFolder.set(currentFolderId, (this.counts.byFolder.get(currentFolderId) ?? 0) + 1);
				this.counts.trash--;
				if (note.isFavorite) this.counts.favorites++;
			}

			this.persist(id);
		}
	}

	deleteNote(id: NoteID, batchTimestamp?: number) {
		const note = this.notes.get(id);
		if (this.selectedNoteID === id) {
			this.selectedNoteID = null;
		}
		if (note && note.deletedAt == null) {
			const folderId = note.folderId ?? null;
			note.deletedAt = batchTimestamp ?? Date.now();
			this.notes.set(id, note);

			// Update counts
			this.counts.byFolder.set(folderId, (this.counts.byFolder.get(folderId) ?? 0) - 1);
			this.counts.trash++;
			if (note.isFavorite) this.counts.favorites--;
		}
		this.persist(id);
	}

	restoreNote(id: NoteID, folderId?: string | null) {
		const note = this.notes.get(id);
		if (note && note.deletedAt != null) {
			const oldFolderId = note.folderId ?? null;
			if (folderId !== undefined) note.folderId = folderId;
			const newFolderId = note.folderId ?? null;
			
			note.deletedAt = null;
			this.notes.set(id, note);

			// Update counts
			this.counts.trash--;
			this.counts.byFolder.set(newFolderId, (this.counts.byFolder.get(newFolderId) ?? 0) + 1);
			if (note.isFavorite) this.counts.favorites++;

			this.persist(id);
		}
	}

	deleteNotesInFolder(folderId: string, batchTimestamp: number) {
		const allNotes = Array.from(this.notes.values());
		for (const note of allNotes) {
			if ((note.folderId ?? 'root') === folderId && note.deletedAt == null) {
				const oldFolderId = note.folderId ?? null;
				note.deletedAt = batchTimestamp;
				this.notes.set(note.id, note);

				// Update counts
				this.counts.byFolder.set(oldFolderId, (this.counts.byFolder.get(oldFolderId) ?? 0) - 1);
				this.counts.trash++;
				if (note.isFavorite) this.counts.favorites--;

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

					// Update counts
					this.counts.trash--;
					const currentFolderId = note.folderId ?? null;
					this.counts.byFolder.set(currentFolderId, (this.counts.byFolder.get(currentFolderId) ?? 0) + 1);
					if (note.isFavorite) this.counts.favorites++;

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
		const oldFav = !!note.isFavorite;
		note.isFavorite = isFavorite;
		this.notes.set(id, note);

		// Update counts if not in trash
		if (note.deletedAt == null && oldFav !== isFavorite) {
			this.counts.favorites += isFavorite ? 1 : -1;
		}

		this.persist(id);
	}

	removeNoteLocally(id: string) {
		const note = this.notes.get(id);
		if (note) {
			// Update counts before removal
			if (note.deletedAt != null) {
				this.counts.trash--;
			} else {
				const folderId = note.folderId ?? null;
				this.counts.byFolder.set(folderId, (this.counts.byFolder.get(folderId) ?? 0) - 1);
				if (note.isFavorite) this.counts.favorites--;
			}
			this.notes.delete(id);
		}
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

	getNoteCount(folderId: FolderID | null, profileId?: string): number {
		if (profileId === 'trash') {
			return this.counts.trash;
		}
		if (profileId === 'favorites') {
			return this.counts.favorites;
		}
		// Regular folder or home
		return this.counts.byFolder.get(folderId) ?? 0;
	}
}

export const notesStore = new NotesStore([]);
