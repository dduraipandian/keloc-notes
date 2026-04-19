import { resolveProfile, SYSTEM_VIEWS } from './domain/profiles';

export type FolderID = string;

export type FolderItem = {
	id: FolderID;
	title: string;
	profile?: string;
	isFavorite?: boolean;
	items?: FolderID[];
	isOpen?: boolean;
	parentId?: FolderID | null;
	// deletedAt is the timestamp of deletion state; do not use it to group deleted items.
	// deletedBatchId identifies one delete operation and must drive restore/grouping logic.
	deletedAt?: number | null;
	deletedBatchId?: string | null;
};

import { SvelteMap } from 'svelte/reactivity';
import { foldersRepository } from '../infrastructure/repositories';

export class FolderStore {
	items = $state<string[]>([]);
	editingId = $state<string | null>(null);
	editingTitle = $state('');
	rejectedRename = $state<{ id: string; token: number } | null>(null);
	folders = new SvelteMap<string, FolderItem>();
	private isInitialized = false;
	onPersistError = $state<((err: unknown, folderId: string) => void) | null>(null);
	private rejectedRenameTimer: ReturnType<typeof setTimeout> | null = null;

	trashItems = $derived.by(() => {
		const deletedIds: string[] = [];
		for (const [id, folder] of this.folders.entries()) {
			const profile = resolveProfile(folder);
			if (!profile.capabilities.emptyTrash && folder.deletedAt != null) {
				const parent = folder.parentId ? this.folders.get(folder.parentId) : null;
				if (!parent || parent.deletedAt == null) {
					deletedIds.push(id);
				}
			}
		}
		return deletedIds;
	});

	constructor() {
		this.folders.clear();

		// Initialize system folders from central registry
		for (const { id, title, profile } of SYSTEM_VIEWS) {
			const folder = $state({
				id,
				title,
				items: [],
				parentId: null,
				profile,
				isFavorite: false,
				deletedAt: null,
				deletedBatchId: null
			});
			this.folders.set(id, folder);
		}
	}

	loadItems(initialItems: any[] = []) {
		initialItems.forEach((item) => {
			if (item.id) {
				if (item.deletedAt === undefined) item.deletedAt = null;
				if (item.deletedBatchId === undefined) item.deletedBatchId = null;
				if (item.isFavorite === undefined) item.isFavorite = false;
				const isSystemFolder = SYSTEM_VIEWS.some((v) => v.id === item.id);
				const profile = resolveProfile(item);

				if (!item.parentId && profile.section === 'folders' && !isSystemFolder) {
					this.items.push(item.id);
				}

				let i = $state(item);
				this.folders.set(item.id, i);
			}
		});
	}

	async init() {
		if (this.isInitialized) return;

		try {
			const allFolders = await foldersRepository.list();
			if (allFolders && allFolders.length > 0) {
				this.loadItems(allFolders);
			}
			this.isInitialized = true;
		} catch (error) {
			throw error;
		}
	}

	persist(id: string) {
		if (!this.isInitialized) return;

		const folder = this.folders.get(id);
		if (folder) {
			// Plan 8: Don't persist view-section folders (managed locally)
			const profile = resolveProfile(folder);
			if (profile.section === 'views') return;

			void Promise.resolve(foldersRepository.save($state.snapshot(folder))).catch((err) => {
				this.onPersistError?.(err, id);
			});
		}
	}

	startRename(id: string) {
		// Use setTimeout to ensure focus-return logic from menus is finished
		setTimeout(() => {
			const folder = this.folders.get(id);
			if (!folder) return;
			this.editingTitle = folder.title;
			this.editingId = id;
		}, 0);
	}

	cancelRename() {
		this.editingTitle = '';
		this.editingId = null;
	}

	createFolder(parentId: FolderID | null = null) {
		const newFolder: FolderItem = $state({
			id: crypto.randomUUID(),
			title: 'New Folder',
			isFavorite: false,
			items: [],
			parentId: null,
			deletedAt: null,
			deletedBatchId: null
		});

		if (!parentId) {
			this.items.unshift(newFolder.id);
		} else {
			const parent = this.folders.get(parentId);
			if (parent) {
				if (!parent.items) {
					parent.items = [];
				}
				parent.items.unshift(newFolder.id);
				parent.isOpen = true;
				newFolder.parentId = parent.id;
				this.persist(parent.id);
			}
		}

		this.folders.set(newFolder.id, newFolder); // newFolder is already $state
		this.persist(newFolder.id);
		this.startRename(newFolder.id);
		return newFolder.id;
	}

	deleteFolder(
		id: string,
		deletedAt: number = Date.now(),
		deletedBatchId: string = crypto.randomUUID()
	) {
		const folder = this.folders.get(id);
		if (!folder) return;

		folder.deletedAt = deletedAt;
		folder.deletedBatchId = deletedBatchId;
		this.folders.set(id, folder);
		this.persist(id);
		this.clearEditingIfSelected(id);
	}

	restoreFolder(id: string, targetBatchId?: string) {
		const folder = this.folders.get(id);
		if (!folder || folder.deletedAt == null) return;
		if (!folder.deletedBatchId) return;

		const batchId = targetBatchId ?? folder.deletedBatchId;

		if (folder.deletedBatchId === batchId) {
			folder.deletedAt = null;
			folder.deletedBatchId = null;
			if (folder.parentId === null && !this.items.includes(id)) {
				this.items.push(id);
			}
			this.folders.set(id, folder);
			this.persist(id);
		}
	}

	applyPermanentDeleteState(foldersToDelete: FolderItem[]) {
		foldersToDelete.forEach((f) => {
			this.clearEditingIfSelected(f.id);
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

	rootFolderIfParentMissing(id: string) {
		const folder = this.folders.get(id);
		if (!folder) return;

		const parent = folder.parentId ? this.folders.get(folder.parentId) : null;
		const isParentInvalid = folder.parentId && (!parent || parent.deletedAt != null);

		if (isParentInvalid) {
			folder.parentId = null;
			if (!this.items.includes(id)) {
				this.items.push(id);
			}
			this.folders.set(id, folder);
			this.persist(id);
		}
	}

	clearEditingIfSelected(id: string) {
		if (this.editingId === id) {
			this.editingTitle = '';
			this.editingId = null;
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

	getPathForFolder(folder: FolderItem): string {
		const path: string[] = [];
		let current: FolderItem | null | undefined = folder;

		while (current) {
			path.unshift(current.title);
			current = current.parentId ? this.folders.get(current.parentId) : null;
		}

		return path.join('/');
	}

	renameFolder(id: FolderID, newTitle: string) {
		const folder = this.folders.get(id);
		this.editingId = null;

		if (!folder) {
			this.editingTitle = '';
			return;
		}

		const normalizedTitle = newTitle.trim();
		if (normalizedTitle === '') {
			this.editingTitle = folder.title;
			this.triggerRejectedRename(id);
			return;
		}

		folder.title = normalizedTitle;
		this.editingTitle = '';
		this.persist(id);
	}

	openFolder(id: FolderID) {
		const folder = this.folders.get(id);
		if (folder) {
			folder.isOpen = !folder.isOpen;
			this.persist(id);
		}
	}

	setFavorite(id: FolderID, isFavorite: boolean) {
		const folder = this.folders.get(id);
		if (!folder) return;
		folder.isFavorite = isFavorite;
		this.folders.set(id, folder);
		this.persist(id);
	}

	private triggerRejectedRename(id: FolderID) {
		const token = Date.now();
		this.rejectedRename = { id, token };
		if (this.rejectedRenameTimer) {
			clearTimeout(this.rejectedRenameTimer);
		}
		this.rejectedRenameTimer = setTimeout(() => {
			if (this.rejectedRename?.token === token) {
				this.rejectedRename = null;
			}
			this.rejectedRenameTimer = null;
		}, 650);
	}

	getDefaultFolderId(): string {
		const findRegular = (ids: string[]): string | null => {
			for (const id of ids) {
				const folder = this.folders.get(id);
				if (!folder) continue;
				const profile = resolveProfile(folder);
				if (profile.capabilities.rename) return folder.id;
				if (folder.items) {
					const found = findRegular(folder.items);
					if (found) return found;
				}
			}
			return null;
		};

		const regularFolderId = findRegular(this.items);
		if (regularFolderId) return regularFolderId;

		const newFolder: FolderItem = {
			id: 'notes',
			title: 'Notes',
			items: [],
			parentId: null,
			deletedAt: null,
			deletedBatchId: null
		};
		let nf = newFolder;
		this.folders.set(newFolder.id, nf);
		this.items.unshift(newFolder.id);
		this.persist(newFolder.id);
		return newFolder.id;
	}
}

export const folderStore = new FolderStore();
