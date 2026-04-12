import { SvelteMap } from 'svelte/reactivity';
import {
	getAllNotes,
	getAllSettings,
	putNote,
	putSetting,
	permanentDeleteNoteTransactionally
} from './idbr';
import { folderStore, type FolderID } from './folders.svelte';
import { TRASH_VIEW_ID, PROTECTED_NOTES_FOLDER_ID } from './sources/constants';

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
	selectedNoteID = $state<NoteID | null>(null);
	private isInitialized = false;

	/**
	 * Note count per folder id (and TRASH_VIEW_ID for deleted notes).
	 * Computed on access from the live SvelteMap — reads establish reactive tracking in
	 * Svelte templates so badge components re-render when notes change.
	 */
	get folderCountIndex(): Map<string, number> {
		const counts = new Map<string, number>();
		let trashCount = 0;
		for (const note of this.notes.values()) {
			if (note.deletedAt != null) {
				trashCount++;
				continue;
			}
			if (note.folderId) {
				counts.set(note.folderId, (counts.get(note.folderId) ?? 0) + 1);
			}
		}
		counts.set(TRASH_VIEW_ID, trashCount);
		return counts;
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
			const allNotesData = await getAllNotes();
			const settings = await getAllSettings();
			const allNotes: NoteItem[] = [];

			allNotesData.forEach((note) => {
				if (note && note.id) {
					if (note.deletedAt === undefined) note.deletedAt = null;
					// Migrate orphan notes: notes with no folderId go to the protected
					// Notes folder. Idempotent — safe to re-run on every load.
					if (note.folderId == null && note.deletedAt == null) {
						note.folderId = PROTECTED_NOTES_FOLDER_ID;
						putNote(note);
					}
					let n = $state(note);
					allNotes.push(n);
				}
			});
			this.notes.clear();

			allNotes.forEach((note) => {
				this.notes.set(note.id, note);
			});
			if (settings && settings.selectedNoteID) {
				this.selectedNoteID = settings.selectedNoteID;
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

	createNote(folderId: FolderID | null) {
		const folder = folderId ? folderStore.findItemById(folderId) : null;
		// If folderId is null, points to a missing folder, or a deleted folder,
		// fall back to the protected notes folder.
		const actualFolderId =
			folder && folder.deletedAt == null ? folderId : folderStore.getDefaultFolderId();

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
		this.selectedNoteID = newNote.id;
		this.persist(newNote.id);
	}

	updateNote(id: NoteID, updates: Partial<Omit<NoteItem, 'id'>>) {
		const note = this.notes.get(id);
		if (note) {
			this.notes.set(id, { ...note, ...updates, updatedAt: new Date().toISOString() });
			this.persist(id);
		}
	}

	deleteNote(id: NoteID, batchTimestamp?: number) {
		const note = this.notes.get(id);
		if (this.selectedNoteID === id) {
			this.selectedNoteID = null;
		}
		if (note) {
			this.notes.set(id, { ...note, deletedAt: batchTimestamp ?? Date.now() });
		}
		this.persist(id);
	}

	recoverNote(id: NoteID, recoverFolder: boolean = false) {
		const note = this.notes.get(id);
		if (note) {
			let targetFolderId = note.folderId;
			if (note.folderId) {
				const f = folderStore.findItemById(note.folderId);
				if (f) {
					if (f.deletedAt != null) {
						if (recoverFolder) {
							const topRoot = folderStore.findTopDeletedAncestor(note.folderId);
							if (topRoot) folderStore.recoverFolderAndChildren(topRoot.id);
						} else {
							// Don't restore folder hierarchy — land note in the protected Notes folder
							targetFolderId = PROTECTED_NOTES_FOLDER_ID;
						}
					}
				} else {
					// Parent folder missing from store — land in protected Notes folder
					targetFolderId = PROTECTED_NOTES_FOLDER_ID;
				}
			}
			this.notes.set(id, { ...note, folderId: targetFolderId, deletedAt: null });
			this.persist(id);
		}
	}

	deleteNotesInFolder(folderId: string, batchTimestamp: number) {
		const allNotes = Array.from(this.notes.values());
		for (const note of allNotes) {
			if (note.folderId === folderId && note.deletedAt == null) {
				this.notes.set(note.id, { ...note, deletedAt: batchTimestamp });
				if (this.selectedNoteID === note.id) {
					this.selectedNoteID = null;
				}
				this.persist(note.id);
			}
		}
	}

	async permanentDeleteNote(id: NoteID) {
		const note = this.notes.get(id);
		if (!note) return;

		const archivedAt = Date.now();
		const folderPath = note.folderId ? folderStore.getFolderPath(note.folderId) : 'root';
		const fullPath = note.folderId
			? `${folderPath}/${note.title}:${note.id}`
			: `${note.title}:${note.id}`;

		try {
			await permanentDeleteNoteTransactionally($state.snapshot(note), fullPath, archivedAt);
			this.notes.delete(id);
			if (this.selectedNoteID === id) {
				this.selectedNoteID = null;
				putSetting('selectedNoteID', null);
			}
		} catch (error) {
			console.error('Failed to permanently delete note:', error);
			throw error;
		}
	}

	recoverNotesInFolder(folderId: string, targetBatch?: number) {
		const allNotes = Array.from(this.notes.values());
		for (const note of allNotes) {
			if (note.folderId === folderId && note.deletedAt != null) {
				if (!targetBatch || note.deletedAt === targetBatch) {
					this.notes.set(note.id, { ...note, deletedAt: null });
					this.persist(note.id);
				}
			}
		}
	}
	getNotesToArchive(folderId: string, targetBatch: number): NoteItem[] {
		return Array.from(this.notes.values()).filter(
			(n) => n.folderId === folderId && n.deletedAt === targetBatch
		);
	}

	/** Test helper — clears all note state without touching IDB. */
	__resetForTest() {
		this.notes.clear();
		this.selectedNoteID = null;
		(this as any).isInitialized = false;
	}

	removeNoteLocally(id: string) {
		this.notes.delete(id);
		if (this.selectedNoteID === id) {
			this.selectedNoteID = null;
		}
	}

	selectNote(id: NoteID | null) {
		this.selectedNoteID = id;
		this.persist(id!);
	}
}

export const notesStore = new NotesStore([]);
