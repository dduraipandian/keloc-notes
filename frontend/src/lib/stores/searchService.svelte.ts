import MiniSearch from 'minisearch';
import { notesRepository } from './repositories';
import type { FolderStoreLike, NotesStoreLike } from './services/types';
import type { NoteID, NoteItem } from './notes.svelte';
import { folderStore } from './folders.svelte';
import { notesStore } from './notes.svelte';
import { noteService } from './services';

type SearchQueries = {
	getNotesForFolder: (folderId: string | null, profile?: string) => NoteItem[];
};

export class SearchService {
	/**
	 * Version rune to trigger reactivity when index changes.
	 */
	version = $state(0);

	private index = new MiniSearch({
		fields: ['title', 'content'], // fields to index for full-text search
		storeFields: ['title'], // fields to return with search results
		searchOptions: {
			boost: { title: 5 },
			prefix: true
		}
	});

	private indexedFolderIds = new Set<string>();

	constructor(
		private readonly folders: FolderStoreLike = folderStore,
		private readonly notes: NotesStoreLike = notesStore,
		private readonly noteQueries: SearchQueries = noteService
	) {}

	/**
	 * Indexes a folder and its subfolders recursively if not already indexed.
	 */
	async ensureFolderIndexed(rootFolderId: string | null) {
		const folderIds = this.getFolderSubtreeIds(rootFolderId);
		const foldersToIndex = folderIds.filter((id) => !this.indexedFolderIds.has(id));

		if (foldersToIndex.length === 0) return;

		for (const folderId of foldersToIndex) {
			const notes = this.noteQueries.getNotesForFolder(folderId);
			const noteIds = notes.map((n) => n.id);
			
			if (noteIds.length > 0) {
				const contents = await notesRepository.getBulkContents(noteIds);
				const documents = notes.map((n) => ({
					id: n.id,
					title: n.title,
					content: contents[n.id] || ''
				}));
				this.index.addAll(documents);
				this.version++;
			}
			this.indexedFolderIds.add(folderId);
		}
	}

	/**
	 * Performs incremental update for a single note.
	 */
	updateNoteIndex(id: string, title: string, content: string) {
		const doc = { id, title, content };
		if (this.index.has(id)) {
			this.index.replace(doc);
		} else {
			this.index.add(doc);
		}
		this.version++;
	}

	/**
	 * Removes a note from the index.
	 */
	removeNoteIndex(id: string) {
		if (this.index.has(id)) {
			this.index.discard(id);
			this.version++;
		}
	}

	/**
	 * Searches across the indexed notes, filtered by a specific folder subtree.
	 */
	search(query: string, rootFolderId: string | null): string[] {
		if (!query.trim()) return [];

		const results = this.index.search(query);
		const allowedFolderIds = new Set(this.getFolderSubtreeIds(rootFolderId));

		// Filter results by the allowed folder subtree
		// and map to IDs
		return results
			.filter((result) => {
				const note = this.notes.getNote(result.id);
				return note && (allowedFolderIds.has(note.folderId || 'root') || rootFolderId === null);
			})
			.map((r) => r.id);
	}

	/**
	 * Helper to gather all folder IDs in a subtree.
	 */
	private getFolderSubtreeIds(rootId: string | null): string[] {
		if (!rootId) return ['root']; // Or whatever your global root is
		
		const ids: string[] = [rootId];
		const visit = (parentId: string) => {
			const folder = this.folders.findItemById(parentId);
			const children = folder?.items ?? [];
			for (const childId of children) {
				if (!ids.includes(childId)) {
					ids.push(childId);
					visit(childId);
				}
			}
		};
		visit(rootId);
		return ids;
	}
}
