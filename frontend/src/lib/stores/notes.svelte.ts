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
	selectedNoteID = $state<NoteID | null>(null);

	// Flattened reactive state for counts to ensure reliable tracking
	folderNoteCounts = $state<Record<string, number>>({ null: 0 });
	folderDeletedNoteCounts = $state<Record<string, number>>({ null: 0 });
	favoriteCount = $state(0);
	trashCount = $state(0);

	// Backward-compatible getter for components/services
	get counts() {
		return {
			byFolder: {
				get: (id: string | null) => this.folderNoteCounts[id ?? 'null'] ?? 0
			},
			favorites: this.favoriteCount,
			trash: this.trashCount
		};
	}

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
		// Reset Records
		this.folderNoteCounts = { null: 0 };
		this.folderDeletedNoteCounts = { null: 0 };
		this.favoriteCount = 0;
		this.trashCount = 0;

		for (const note of this.notes.values()) {
			const folderId = note.folderId ?? 'null';
			if (note.deletedAt != null) {
				this.trashCount++;
				this.folderDeletedNoteCounts[folderId] = (this.folderDeletedNoteCounts[folderId] ?? 0) + 1;
			} else {
				this.folderNoteCounts[folderId] = (this.folderNoteCounts[folderId] ?? 0) + 1;
				if (note.isFavorite) {
					this.favoriteCount++;
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
		const targetFolderId = folderId === 'home' ? null : folderId;
		const newNote: NoteItem = {
			id: crypto.randomUUID(),
			folderId: targetFolderId,
			title: 'Untitled Note',
			content: '',
			updatedAt: new Date().toISOString(),
			isFavorite: false,
			deletedAt: null
		};
		let n = $state(newNote);
		this.notes.set(newNote.id, n);

		// Update counts
		const fid = targetFolderId ?? 'null';
		if (this.folderNoteCounts[fid] === undefined) this.folderNoteCounts[fid] = 0;
		this.folderNoteCounts[fid] = (this.folderNoteCounts[fid] ?? 0) + 1;

		this.selectedNoteID = newNote.id;
		this.persist(newNote.id);
		return newNote;
	}

	updateNote(id: NoteID, updates: Partial<Omit<NoteItem, 'id'>>) {
		const note = this.notes.get(id);
		if (note) {
			const oldFolderId = note.folderId ?? 'null';
			const oldIsFavorite = !!note.isFavorite;
			const oldDeletedAt = note.deletedAt;

			Object.assign(note, {
				...updates,
				updatedAt: new Date().toISOString()
			});

			const newFolderId = note.folderId ?? 'null';
			const newDeletedAt = note.deletedAt;
			const newIsFavorite = !!note.isFavorite;

			// Handle Folder Movement
			if (oldFolderId !== newFolderId) {
				if (oldDeletedAt === null) {
					this.folderNoteCounts[oldFolderId] = (this.folderNoteCounts[oldFolderId] ?? 0) - 1;
				} else {
					this.folderDeletedNoteCounts[oldFolderId] = (this.folderDeletedNoteCounts[oldFolderId] ?? 0) - 1;
				}

				if (newDeletedAt === null) {
					this.folderNoteCounts[newFolderId] = (this.folderNoteCounts[newFolderId] ?? 0) + 1;
				} else {
					this.folderDeletedNoteCounts[newFolderId] = (this.folderDeletedNoteCounts[newFolderId] ?? 0) + 1;
				}
			}

			// Handle Deletion State Change
			if (oldDeletedAt === null && newDeletedAt !== null) {
				this.folderNoteCounts[newFolderId] = (this.folderNoteCounts[newFolderId] ?? 0) - 1;
				this.folderDeletedNoteCounts[newFolderId] = (this.folderDeletedNoteCounts[newFolderId] ?? 0) + 1;
				this.trashCount++;
				if (oldIsFavorite) this.favoriteCount--;
			} else if (oldDeletedAt !== null && newDeletedAt === null) {
				this.folderDeletedNoteCounts[newFolderId] = (this.folderDeletedNoteCounts[newFolderId] ?? 0) - 1;
				this.folderNoteCounts[newFolderId] = (this.folderNoteCounts[newFolderId] ?? 0) + 1;
				this.trashCount--;
				if (newIsFavorite) this.favoriteCount++;
			}

			// Handle Favorite State Change (only if active)
			if (newDeletedAt === null && oldIsFavorite !== newIsFavorite) {
				this.favoriteCount += newIsFavorite ? 1 : -1;
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
			const fid = note.folderId ?? 'null';
			note.deletedAt = batchTimestamp ?? Date.now();
			this.notes.set(id, note);

			// Update counts
			this.folderNoteCounts[fid] = (this.folderNoteCounts[fid] ?? 0) - 1;
			this.folderDeletedNoteCounts[fid] = (this.folderDeletedNoteCounts[fid] ?? 0) + 1;
			this.trashCount++;
			if (note.isFavorite) this.favoriteCount--;
		}
		this.persist(id);
	}

	restoreNote(id: NoteID, folderId?: string | null) {
		const note = this.notes.get(id);
		if (note && note.deletedAt != null) {
			const oldFolderId = note.folderId ?? 'null';
			if (folderId !== undefined) note.folderId = folderId;
			const newFolderId = note.folderId ?? 'null';
			
			note.deletedAt = null;
			this.notes.set(id, note);

			// Update counts
			this.trashCount--;
			this.folderDeletedNoteCounts[oldFolderId] = (this.folderDeletedNoteCounts[oldFolderId] ?? 0) - 1;
			this.folderNoteCounts[newFolderId] = (this.folderNoteCounts[newFolderId] ?? 0) + 1;
			if (note.isFavorite) this.favoriteCount++;

			this.persist(id);
		}
	}

	deleteNotesInFolder(folderId: string, batchTimestamp: number) {
		const allNotes = Array.from(this.notes.values());
		for (const note of allNotes) {
			if ((note.folderId ?? 'root') === folderId && note.deletedAt == null) {
				const fid = note.folderId ?? 'null';
				note.deletedAt = batchTimestamp;
				this.notes.set(note.id, note);

				// Update counts
				this.folderNoteCounts[fid] = (this.folderNoteCounts[fid] ?? 0) - 1;
				this.folderDeletedNoteCounts[fid] = (this.folderDeletedNoteCounts[fid] ?? 0) + 1;
				this.trashCount++;
				if (note.isFavorite) this.favoriteCount--;

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
					this.trashCount--;
					const fid = note.folderId ?? 'null';
					this.folderDeletedNoteCounts[fid] = (this.folderDeletedNoteCounts[fid] ?? 0) - 1;
					this.folderNoteCounts[fid] = (this.folderNoteCounts[fid] ?? 0) + 1;
					if (note.isFavorite) this.favoriteCount++;

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
			this.favoriteCount += isFavorite ? 1 : -1;
		}

		this.persist(id);
	}

	removeNoteLocally(id: string) {
		const note = this.notes.get(id);
		if (note) {
			const fid = note.folderId ?? 'null';
			// Update counts before removal
			if (note.deletedAt != null) {
				this.trashCount--;
				this.folderDeletedNoteCounts[fid] = (this.folderDeletedNoteCounts[fid] ?? 0) - 1;
			} else {
				this.folderNoteCounts[fid] = (this.folderNoteCounts[fid] ?? 0) - 1;
				if (note.isFavorite) this.favoriteCount--;
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
		const normId = (folderId === 'home' || folderId === null) ? 'null' : folderId;
		
		if (profileId === 'trash') {
			return this.trashCount;
		}
		if (profileId === 'favorites') {
			return this.favoriteCount;
		}
		if (profileId === 'deleted') {
			return this.folderDeletedNoteCounts[normId] ?? 0;
		}
		
		// Regular folder or home
		return this.folderNoteCounts[normId] ?? 0;
	}
}

export const notesStore = new NotesStore([]);
