export type FolderID = string;

export type FolderItem = {
	id: FolderID;
	title: string;
	/** @deprecated Not used by any UI — kept optional for DB migration compat. */
	url?: string;
	items?: FolderID[];
	isOpen?: boolean;
	parentId?: FolderID | null;
	deletedAt?: number | null;
	/** When true, the folder cannot be renamed or deleted (e.g. the protected 'Notes' root). */
	isProtected?: boolean;
};

import { SvelteMap } from 'svelte/reactivity';
import {
	getAllFolders,
	getAllSettings,
	putFolder,
	putSetting,
	deleteFolder,
	withTransaction,
	permanentDeleteFolderTransactionally
} from './idbr';
import { notesStore } from './notes.svelte';
import { PROTECTED_NOTES_FOLDER_ID } from './sources/constants';

class FolderStore {
	items = $state<string[]>([]);
	selectedFolderID = $state<string | null>(null);
	editingId = $state<string | null>(null);
	folders = new SvelteMap<string, FolderItem>();
	private isInitialized = false;

	trashItems = $derived.by(() => {
		const deletedIds: string[] = [];
		for (const [id, folder] of this.folders.entries()) {
			if (folder.deletedAt != null) {
				const parent = folder.parentId ? this.folders.get(folder.parentId) : null;
				if (!parent || parent.deletedAt == null) {
					deletedIds.push(id);
				}
			}
		}
		return deletedIds;
	});

	constructor(initialItems: FolderItem[] = []) {
		let i = $state<string[]>([]);
		this.items = i;
		this.folders.clear();
		this.loadItems(initialItems);
	}

	loadItems(initialItems: any[] = []) {
		initialItems.forEach((item) => {
			if (item.id) {
				if (item.deletedAt === undefined) item.deletedAt = null;
				let i = $state(item);
				this.folders.set(item.id, i);
				if (!item.parentId) {
					this.items.push(item.id);
				}
			}
		});
		console.log('loaded items:', this.items);
	}

	async init() {
		if (this.isInitialized) return;

		try {
			const allFolders = await getAllFolders();
			const settings = await getAllSettings();
			if (allFolders && allFolders.length > 0) {
				this.loadItems(allFolders);

				if (settings && settings.selectedFolderID) {
					this.selectedFolderID = settings.selectedFolderID;
				}
			}
			this.ensureProtectedNotesFolder();
			this.isInitialized = true;
		} catch (error) {
			console.error('Failed to load folders from storage:', error);
			throw error;
		}
	}

	/**
	 * Guarantees the protected Notes folder exists and is correctly flagged.
	 * Runs after loadItems so existing DB data is already in the map.
	 *
	 * Handles three cases:
	 *   1. First run / fresh DB — folder not in map at all: create and persist.
	 *   2. Existing DB with an unprotected 'notes' (from old getDefaultFolderId
	 *      fallback) — mark isProtected and persist.
	 *   3. Already correct — no-op.
	 */
	private ensureProtectedNotesFolder() {
		const existing = this.folders.get(PROTECTED_NOTES_FOLDER_ID);
		if (existing) {
			if (!existing.isProtected) {
				existing.isProtected = true;
				this.folders.set(PROTECTED_NOTES_FOLDER_ID, existing);
				putFolder($state.snapshot(existing));
			}
			// Ensure it's in the root items list
			if (!this.items.includes(PROTECTED_NOTES_FOLDER_ID)) {
				this.items.unshift(PROTECTED_NOTES_FOLDER_ID);
			}
			return;
		}

		// Create fresh protected notes folder
		const folder: FolderItem = {
			id: PROTECTED_NOTES_FOLDER_ID,
			title: 'Notes',
				items: [],
			parentId: null,
			deletedAt: null,
			isProtected: true
		};
		let f = $state(folder);
		this.folders.set(PROTECTED_NOTES_FOLDER_ID, f);
		this.items.unshift(PROTECTED_NOTES_FOLDER_ID);
		putFolder($state.snapshot(f));
	}

	persist(id: string) {
		console.log('isInitialized', this.isInitialized);
		if (!this.isInitialized) return;

		const folder = this.folders.get(id);
		if (folder) {
			putFolder($state.snapshot(folder));
		}
		putSetting('selectedFolderID', this.selectedFolderID);
	}

	selectFolder(id: string | null) {
		this.selectedFolderID = id;
		if (this.selectedFolderID) this.persist(this.selectedFolderID);
	}

	startRename(id: string) {
		// Use setTimeout to ensure focus-return logic from menus is finished
		setTimeout(() => {
			this.editingId = id;
		}, 0);
	}

	cancelRename() {
		this.editingId = null;
	}

	createFolder(parentId?: string | null) {
		// If an explicit parentId is not given, fall back to the currently selected folder.
		const resolvedParentId = parentId !== undefined ? parentId : this.selectedFolderID;

		const newFolder: FolderItem = {
			id: crypto.randomUUID(),
			title: 'New Folder',
				items: [],
			parentId: null,
			deletedAt: null
		};

		const parent = resolvedParentId ? (this.folders.get(resolvedParentId) ?? null) : null;
		if (!parent) {
			this.items.unshift(newFolder.id);
		} else {
			if (!parent.items) {
				let i = $state([]);
				parent.items = i;
			}
			parent.items.unshift(newFolder.id);
			parent.isOpen = true;
			newFolder.parentId = parent.id;
			this.persist(parent.id);
		}

		let nf = $state(newFolder);
		this.folders.set(newFolder.id, nf);
		this.selectedFolderID = newFolder.id;
		this.persist(newFolder.id);
		this.startRename(newFolder.id);
	}

	deleteFolder(id: string, batchTimestamp?: number) {
		const folder = this.folders.get(id);
		if (!folder) return;
		if (folder.isProtected) return; // protected folders cannot be deleted

		const ts = batchTimestamp ?? Date.now();

		folder.deletedAt = ts;
		this.folders.set(id, folder);
		this.persist(id);

		if (folder.items) {
			[...folder.items].forEach((childId) => this.deleteFolder(childId, ts));
		}

		notesStore.deleteNotesInFolder(id, ts);

		if (this.selectedFolderID === id) {
			this.selectedFolderID = null;
		}

		if (this.editingId === id) {
			this.editingId = null;
		}
	}

	findTopDeletedAncestor(folderId: string): FolderItem | null {
		const folder = this.folders.get(folderId);
		if (!folder || folder.deletedAt == null) return null;

		if (!folder.parentId) return folder;

		const parent = this.folders.get(folder.parentId);
		if (!parent || parent.deletedAt == null) return folder;

		return this.findTopDeletedAncestor(folder.parentId);
	}

	recoverFolderAndChildren(id: string, targetBatch?: number) {
		const folder = this.folders.get(id);
		if (!folder || folder.deletedAt == null) return;

		const batch = targetBatch ?? folder.deletedAt;

		if (folder.deletedAt === batch) {
			folder.deletedAt = null;
			console.log('Recovering folder:', folder.deletedAt, batch);
			this.folders.set(id, folder);
			this.persist(id);

			notesStore.recoverNotesInFolder(id, batch);

			if (folder.items) {
				folder.items.forEach((childId) => this.recoverFolderAndChildren(childId, batch));
			}

			if (!targetBatch) {
				if (folder.parentId && !this.folders.has(folder.parentId)) {
					// Parent is missing from system, root this folder
					folder.parentId = null;
				} else {
					this.recoverParentPath(folder.parentId);
				}
			}
		}
	}

	getFolderPath(id: string): string {
		const folder = this.folders.get(id);
		if (!folder) return '';

		const segment = `${folder.title}:${folder.id}`;
		if (!folder.parentId) return segment;

		const parentPath = this.getFolderPath(folder.parentId);
		return parentPath ? `${parentPath}/${segment}` : segment;
	}

	async permanentDeleteFolderAndChildren(id: string, targetBatch?: number) {
		const folder = this.folders.get(id);
		if (!folder || folder.deletedAt == null) return;

		const batch = targetBatch ?? folder.deletedAt;
		const foldersToDelete = this.collectFolderSubtree(id);
		const notesToDelete = this.collectFolderNotesWithPaths(foldersToDelete, batch);

		try {
			await permanentDeleteFolderTransactionally(notesToDelete, foldersToDelete, Date.now());
			this.applyPermanentDeleteState(notesToDelete, foldersToDelete);
			if (this.selectedFolderID === id) this.selectedFolderID = null;
		} catch (error) {
			console.error('Failed to permanently delete folder and children:', error);
			throw error;
		}
	}

	async emptyTrash() {
		const foldersToDelete = this.trashItems.flatMap((id) => this.collectFolderSubtree(id));
		const deletedFolderIds = new Set(foldersToDelete.map((f) => f.id));

		// Collect deleted folder notes (batch-filtered per folder) plus all individually
		// deleted notes regardless of batch or whether their folder is also being deleted.
		const folderNotes = this.collectFolderNotesWithPaths(foldersToDelete);
		const individualNotes = this.collectAllDeletedNotesWithPaths();
		const seenIds = new Set(folderNotes.map((e) => e.note.id));
		const notesToDelete = [
			...folderNotes,
			...individualNotes.filter((e) => !seenIds.has(e.note.id))
		];

		try {
			await permanentDeleteFolderTransactionally(notesToDelete, foldersToDelete, Date.now());
			this.applyPermanentDeleteState(notesToDelete, foldersToDelete);
			if (this.selectedFolderID && deletedFolderIds.has(this.selectedFolderID)) {
				this.selectedFolderID = null;
			}
		} catch (error) {
			console.error('Failed to empty trash:', error);
			throw error;
		}
	}

	// Returns snapshots of a folder and all its descendants.
	private collectFolderSubtree(id: string): FolderItem[] {
		const result: FolderItem[] = [];
		const collect = (fid: string) => {
			const f = this.folders.get(fid);
			if (!f) return;
			result.push($state.snapshot(f));
			if (f.items) f.items.forEach(collect);
		};
		collect(id);
		return result;
	}

	// Notes belonging to the given folder subtree, filtered to the folder's deletion batch.
	// Used by permanentDeleteFolderAndChildren to avoid touching notes deleted at a different time.
	private collectFolderNotesWithPaths(
		folders: FolderItem[],
		batch?: number
	): { note: any; path: string }[] {
		return folders.flatMap((f) => {
			const folderPath = this.getFolderPath(f.id);
			const notes =
				batch !== undefined
					? notesStore.getNotesToArchive(f.id, batch)
					: Array.from(notesStore.notes.values()).filter(
							(n) => n.folderId === f.id && n.deletedAt == null
						);
			return notes.map((n) => ({
				note: $state.snapshot(n),
				path: `${folderPath}/${n.title}:${n.id}`
			}));
		});
	}

	// All individually deleted notes — any batch, any folder (including root-level).
	// Used by emptyTrash to catch notes deleted outside of a folder-delete operation.
	private collectAllDeletedNotesWithPaths(): { note: any; path: string }[] {
		return Array.from(notesStore.notes.values())
			.filter((n) => n.deletedAt != null)
			.map((n) => {
				const folderPath = n.folderId ? this.getFolderPath(n.folderId) : null;
				const path = folderPath ? `${folderPath}/${n.title}:${n.id}` : `${n.title}:${n.id}`;
				return { note: $state.snapshot(n), path };
			});
	}

	private applyPermanentDeleteState(notesToDelete: { note: any }[], foldersToDelete: FolderItem[]) {
		notesToDelete.forEach(({ note }) => notesStore.removeNoteLocally(note.id));

		foldersToDelete.forEach((f) => {
			if (f.parentId) {
				const parent = this.folders.get(f.parentId);
				if (parent && parent.items) {
					parent.items = parent.items.filter((itemId) => itemId !== f.id);
				}
			} else {
				this.items = this.items.filter((itemId) => itemId !== f.id);
			}
			this.folders.delete(f.id);
		});
	}

	recoverParentPath(parentId: string | null | undefined) {
		if (!parentId) return;
		const parent = this.folders.get(parentId);
		if (parent && parent.deletedAt != null) {
			parent.deletedAt = null;
			this.folders.set(parentId, parent);
			this.persist(parentId);
			this.recoverParentPath(parent.parentId);
		}
	}

	private isChildOf(parentId: string, childId: string): boolean {
		const parent = this.folders.get(parentId);
		if (!parent || !parent.items) return false;
		if (parent.items.includes(childId)) return true;

		return parent.items.some((cid) => this.isChildOf(cid, childId));
	}

	findItemById(id: FolderID): FolderItem | null {
		return this.folders.get(id) || null;
	}

	renameFolder(id: FolderID, newTitle: string) {
		this.editingId = null;
		const folder = this.folders.get(id);

		if (folder && !folder.isProtected && newTitle.trim() !== '') {
			folder.title = newTitle;
			this.persist(id);
		}
	}

	openFolder(id: FolderID) {
		const folder = this.folders.get(id);
		if (folder) {
			folder.isOpen = !folder.isOpen;
			this.persist(id);
		}
	}

	getDefaultFolderId(): string {
		// The protected notes folder is guaranteed to exist after init().
		return PROTECTED_NOTES_FOLDER_ID;
	}
	getSelectedFolder(): FolderItem | null {
		if (!this.selectedFolderID) return null;
		let folder = this.folders.get(this.selectedFolderID);
		if (!folder) {
			folder = this.folders.get(this.getDefaultFolderId());
		}
		return folder || null;
	}

	/** Test helper — clears all state without touching IDB. */
	__resetForTest() {
		this.folders.clear();
		(this as any).items = [];
		this.selectedFolderID = null;
		this.editingId = null;
		(this as any).isInitialized = false;
	}
}

// Seed only the protected notes folder for new installs.
// Existing DBs are handled by ensureProtectedNotesFolder() in init().
const initialData: FolderItem[] = [
	{
		id: PROTECTED_NOTES_FOLDER_ID,
		title: 'Notes',
		items: [],
		parentId: null,
		deletedAt: null,
		isProtected: true
	}
];

export const folderStore = new FolderStore(initialData);
