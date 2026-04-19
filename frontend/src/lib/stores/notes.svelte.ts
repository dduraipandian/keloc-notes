import { SvelteMap } from 'svelte/reactivity';
import { notesRepository, settingsRepository } from '../infrastructure/repositories';
import { KeyedDebouncer } from '../utils/debounce';
import { extractTextFromJSON } from '../editor/serializer';
import type { FolderID } from './folders.svelte';
import type { SearchService } from './searchService.svelte';

export type NoteID = string;

export type NoteMeta = {
	id: NoteID;
	folderId: string | null;
	title: string;
	summary: string;
	updatedAt: string;
	isFavorite?: boolean;
	deletedAt?: number | null;
	deletedBatchId?: string | null;
};

export type NoteItem = NoteMeta & {
	content: string;
	isContentLoaded: boolean;
};

export class NotesStore {
	notes = new SvelteMap<NoteID, NoteItem>();
	private isInitialized = false;
	selectedNoteID = $state<NoteID | null>(null);
	onPersistError = $state<((err: unknown, noteId: string) => void) | null>(null);
	private debouncer = new KeyedDebouncer();
	private inFlightWrites = new Set<Promise<unknown>>();
	private dirtyContentNotes = new Set<NoteID>();

	folderNoteCounts = $state<Record<string, number>>({ null: 0 });
	folderDeletedNoteCounts = $state<Record<string, number>>({ null: 0 });
	favoriteCount = $state(0);
	trashCount = $state(0);
	private searchService: SearchService | null = null;

	setSearchService(service: SearchService) {
		this.searchService = service;
	}

	get counts() {
		return {
			byFolder: {
				get: (id: string | null) => this.folderNoteCounts[id ?? 'null'] ?? 0
			},
			favorites: this.favoriteCount,
			trash: this.trashCount
		};
	}

	constructor(initialNotes: (NoteMeta | NoteItem)[] = []) {
		if (initialNotes.length > 0) {
			initialNotes.forEach((n) => {
				const isFull = 'isContentLoaded' in n;
				const item: NoteItem = {
					...n,
					content: isFull ? (n as NoteItem).content : '',
					isContentLoaded: isFull ? (n as NoteItem).isContentLoaded : false
				};
				this.notes.set(n.id, item);
			});
		}
	}

	summarize(content: string): string {
		const text = extractTextFromJSON(content);
		if (!text) return '';
		const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
		return lines.slice(0, 2).join(' ');
	}

	async init() {
		if (this.isInitialized) return;

		try {
			const allMeta = await notesRepository.list();
			const settings = await settingsRepository.getAll();

			this.notes.clear();
			allMeta.forEach((meta) => {
				if (meta && meta.id) {
					if (meta.deletedAt === undefined) meta.deletedAt = null;
					if (meta.deletedBatchId === undefined) meta.deletedBatchId = null;
					if (meta.isFavorite === undefined) meta.isFavorite = false;
					if (meta.summary === undefined) meta.summary = '';

					const item: NoteItem = {
						...meta,
						content: '',
						isContentLoaded: false
					};
					this.notes.set(meta.id, item);
				}
			});

			this.recalculateCounts();
			if (settings && settings.selectedNoteID) {
				this.selectedNoteID = settings.selectedNoteID;
				// Initial content load for selected note
				await this.loadNoteContent(this.selectedNoteID);
			}
			this.isInitialized = true;
		} catch (error) {
			console.error('Failed to load notes from storage:', error);
			throw error;
		}
	}

	async loadNoteContent(id: NoteID) {
		const note = this.notes.get(id);
		if (!note || note.isContentLoaded) return;

		try {
			const content = await notesRepository.getContent(id);
			// Replace in map to trigger reactivity
			this.notes.set(id, {
				...note,
				content,
				isContentLoaded: true
			});
			// Index content once loaded
			this.searchService?.updateNoteIndex(id, note.title, content);
		} catch (error) {
			console.error(`Failed to load content for note ${id}:`, error);
		}
	}

	private recalculateCounts() {
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

	persistNote(id: NoteID | null, forcePersistContent = false) {
		if (!this.isInitialized || !id) return;
		this.debouncer.cancel(id);
		const note = this.notes.get(id);
		if (note) {
			const meta: NoteMeta = {
				id: note.id,
				folderId: note.folderId,
				title: note.title,
				summary: note.summary,
				updatedAt: note.updatedAt,
				isFavorite: note.isFavorite,
				deletedAt: note.deletedAt,
				deletedBatchId: note.deletedBatchId
			};

			const metaWrite = Promise.resolve(notesRepository.saveMeta(meta));
			this.trackWrite(
				metaWrite.catch((err) => {
					this.onPersistError?.(err, id);
				})
			);

			const shouldPersistContent = forcePersistContent || this.dirtyContentNotes.has(id);

			if (shouldPersistContent && note.isContentLoaded) {
				const contentWrite = Promise.resolve(notesRepository.saveContent(id, note.content));
				this.trackWrite(
					contentWrite.catch((err) => {
						this.onPersistError?.(err, `${id}_content`);
					})
				);
				this.dirtyContentNotes.delete(id);

				// Update search index incrementally
				this.searchService?.updateNoteIndex(id, note.title, note.content);
			}
		}
	}

	persistSelection() {
		if (!this.isInitialized) return;
		const write = Promise.resolve(settingsRepository.save('selectedNoteID', this.selectedNoteID));
		this.trackWrite(
			write.catch((err) => {
				this.onPersistError?.(err, '__selection__');
			})
		);
	}

	async flushAllPendingWrites(): Promise<void> {
		this.debouncer.flushAll();
		await Promise.allSettled(Array.from(this.inFlightWrites));
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
			summary: '',
			updatedAt: new Date().toISOString(),
			isFavorite: false,
			deletedAt: null,
			deletedBatchId: null,
			isContentLoaded: true
		};
		let n = $state(newNote);
		this.notes.set(newNote.id, n);

		const fid = targetFolderId ?? 'null';
		if (this.folderNoteCounts[fid] === undefined) this.folderNoteCounts[fid] = 0;
		this.folderNoteCounts[fid] = (this.folderNoteCounts[fid] ?? 0) + 1;

		this.selectedNoteID = newNote.id;
		this.persistNote(newNote.id);
		this.persistSelection();

		// Index new note
		this.searchService?.updateNoteIndex(newNote.id, newNote.title, '');

		return newNote;
	}

	updateNote(
		id: NoteID,
		updates: Partial<Omit<NoteItem, 'id'>>,
		{ updatedTimestamp = true }: { updatedTimestamp?: boolean } = {}
	) {
		const note = this.notes.get(id);
		if (note) {
			const oldFolderId = note.folderId ?? 'null';
			const oldIsFavorite = !!note.isFavorite;
			const oldDeletedAt = note.deletedAt;
			const contentChanged = updates.content !== undefined && updates.content !== note.content;

			const newNote = { ...note, ...updates };

			if (contentChanged) {
				newNote.summary = this.summarize(newNote.content);
				this.dirtyContentNotes.add(id);
			}

			if (updatedTimestamp) {
				newNote.updatedAt = new Date().toISOString();
			}

			// Replace in map to trigger reactivity
			this.notes.set(id, newNote);

			// Keep persistence throttled
			this.debouncer.debounce(
				id,
				() => {
					this.persistNote(id);
				},
				400
			);

			const newFolderId = newNote.folderId ?? 'null';
			const newDeletedAt = newNote.deletedAt;
			const newIsFavorite = !!newNote.isFavorite;

			// Handle Folder Movement
			if (oldFolderId !== newFolderId) {
				if (oldDeletedAt === null) {
					this.folderNoteCounts[oldFolderId] = (this.folderNoteCounts[oldFolderId] ?? 0) - 1;
				} else {
					this.folderDeletedNoteCounts[oldFolderId] =
						(this.folderDeletedNoteCounts[oldFolderId] ?? 0) - 1;
				}

				if (newDeletedAt === null) {
					this.folderNoteCounts[newFolderId] = (this.folderNoteCounts[newFolderId] ?? 0) + 1;
				} else {
					this.folderDeletedNoteCounts[newFolderId] =
						(this.folderDeletedNoteCounts[newFolderId] ?? 0) + 1;
				}
			}

			// Handle Deletion State Change
			if (oldDeletedAt === null && newDeletedAt !== null) {
				this.folderNoteCounts[newFolderId] = (this.folderNoteCounts[newFolderId] ?? 0) - 1;
				this.folderDeletedNoteCounts[newFolderId] =
					(this.folderDeletedNoteCounts[newFolderId] ?? 0) + 1;
				this.trashCount++;
				if (oldIsFavorite) this.favoriteCount--;
			} else if (oldDeletedAt !== null && newDeletedAt === null) {
				this.folderDeletedNoteCounts[newFolderId] =
					(this.folderDeletedNoteCounts[newFolderId] ?? 0) - 1;
				this.folderNoteCounts[newFolderId] = (this.folderNoteCounts[newFolderId] ?? 0) + 1;
				this.trashCount--;
				if (newIsFavorite) this.favoriteCount++;
			}

			// Handle Favorite State Change (only if active)
			if (newDeletedAt === null && oldIsFavorite !== newIsFavorite) {
				this.favoriteCount += newIsFavorite ? 1 : -1;
			}
		}
	}

	deleteNote(
		id: NoteID,
		deletedAt: number = Date.now(),
		deletedBatchId: string = crypto.randomUUID()
	) {
		const note = this.notes.get(id);
		if (this.selectedNoteID === id) {
			this.selectedNoteID = null;
		}
		if (note && note.deletedAt == null) {
			const fid = note.folderId ?? 'null';
			const newNote = { ...note, deletedAt, deletedBatchId };
			this.notes.set(id, newNote);

			// Update counts
			this.folderNoteCounts[fid] = (this.folderNoteCounts[fid] ?? 0) - 1;
			this.folderDeletedNoteCounts[fid] = (this.folderDeletedNoteCounts[fid] ?? 0) + 1;
			this.trashCount++;
			if (note.isFavorite) this.favoriteCount--;
		}
		try {
			this.persistNote(id);
			this.persistSelection();
			this.searchService?.removeNoteIndex(id);
		} catch (err) {
			console.error('Error persisting note:', err);
		}
	}

	restoreNote(id: NoteID, folderId?: string | null) {
		const note = this.notes.get(id);
		if (note && note.deletedAt != null) {
			const oldFolderId = note.folderId ?? 'null';
			const newNote = { ...note, deletedAt: null, deletedBatchId: null };
			if (folderId !== undefined) newNote.folderId = folderId;
			const newFolderId = newNote.folderId ?? 'null';

			this.notes.set(id, newNote);

			// Update counts
			this.trashCount--;
			this.folderDeletedNoteCounts[oldFolderId] =
				(this.folderDeletedNoteCounts[oldFolderId] ?? 0) - 1;
			this.folderNoteCounts[newFolderId] = (this.folderNoteCounts[newFolderId] ?? 0) + 1;
			if (newNote.isFavorite) this.favoriteCount++;

			this.persistNote(id);
			this.persistSelection();
			this.searchService?.updateNoteIndex(id, newNote.title, newNote.content);
		}
	}

	deleteNotesInFolder(folderId: string, deletedAt: number, deletedBatchId: string) {
		const allNotes = Array.from(this.notes.values());
		let selectionChanged = false;
		for (const note of allNotes) {
			if ((note.folderId ?? 'root') === folderId && note.deletedAt == null) {
				const fid = note.folderId ?? 'null';
				const newNote = { ...note, deletedAt, deletedBatchId };
				this.notes.set(note.id, newNote);

				// Update counts
				this.folderNoteCounts[fid] = (this.folderNoteCounts[fid] ?? 0) - 1;
				this.folderDeletedNoteCounts[fid] = (this.folderDeletedNoteCounts[fid] ?? 0) + 1;
				this.trashCount++;
				if (note.isFavorite) this.favoriteCount--;

				if (this.selectedNoteID === note.id) {
					this.selectedNoteID = null;
					selectionChanged = true;
				}
				this.persistNote(note.id);
				this.searchService?.removeNoteIndex(note.id);
			}
		}
		if (selectionChanged) {
			this.persistSelection();
		}
	}

	restoreNotesInFolder(folderId: string, targetBatchId?: string) {
		const allNotes = Array.from(this.notes.values());
		for (const note of allNotes) {
			if (
				(note.folderId ?? 'root') === folderId &&
				note.deletedAt != null &&
				note.deletedBatchId != null
			) {
				if (targetBatchId && note.deletedBatchId === targetBatchId) {
					const fid = note.folderId ?? 'null';
					const newNote = { ...note, deletedAt: null, deletedBatchId: null };
					this.notes.set(note.id, newNote);

					// Update counts
					this.trashCount--;
					this.folderDeletedNoteCounts[fid] = (this.folderDeletedNoteCounts[fid] ?? 0) - 1;
					this.folderNoteCounts[fid] = (this.folderNoteCounts[fid] ?? 0) + 1;
					if (note.isFavorite) this.favoriteCount++;

					this.persistNote(note.id);
					this.searchService?.updateNoteIndex(note.id, newNote.title, newNote.content);
				}
			}
		}
	}
	getNotesToArchive(folderId: string, targetBatchId: string): NoteItem[] {
		return Array.from(this.notes.values()).filter(
			(n) =>
				(n.folderId ?? 'root') === folderId &&
				n.deletedAt != null &&
				n.deletedBatchId === targetBatchId
		);
	}

	getDeletedNotes(): NoteItem[] {
		return Array.from(this.notes.values())
			.filter((n) => n.deletedAt != null)
			.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
	}

	listNotes(): NoteItem[] {
		return Array.from(this.notes.values());
	}

	setFavorite(id: NoteID, isFavorite: boolean) {
		const note = this.notes.get(id);
		if (!note) return;
		const oldFav = !!note.isFavorite;

		const newNote = { ...note, isFavorite };
		this.notes.set(id, newNote);

		// Update counts if not in trash
		if (newNote.deletedAt == null && oldFav !== isFavorite) {
			this.favoriteCount += isFavorite ? 1 : -1;
		}

		this.persistNote(id);
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
			// Remove from search index
			this.searchService?.removeNoteIndex(id);
		}
		this.clearSelectionIfSelected(id);
	}

	clearSelectionIfSelected(id: string) {
		if (this.selectedNoteID === id) {
			this.selectedNoteID = null;
			this.persistSelection();
		}
	}

	selectNote(id: NoteID | null) {
		if (this.selectedNoteID) {
			this.debouncer.flush(this.selectedNoteID);
		}
		this.selectedNoteID = id;
		this.persistSelection();
	}

	getNoteCount(folderId: FolderID | null, profileId?: string): number {
		const normId = folderId === 'home' || folderId === null ? 'null' : folderId;

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

	async getBulkNoteContents(ids: NoteID[]): Promise<Record<NoteID, string>> {
		return notesRepository.getBulkContents(ids);
	}

	private trackWrite<T>(write: Promise<T>) {
		this.inFlightWrites.add(write);
		void write.finally(() => {
			this.inFlightWrites.delete(write);
		});
	}
}
