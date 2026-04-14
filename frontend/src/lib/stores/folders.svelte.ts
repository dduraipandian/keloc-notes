import { resolveProfile, SYSTEM_VIEWS } from './domain/profiles';

export type FolderID = string;

export type FolderItem = {
	id: FolderID;
	title: string;
	url: string;
	profile?: string;
	isFavorite?: boolean;
	badge?: number;
	items?: FolderID[];
	isOpen?: boolean;
	parentId?: FolderID | null;
	deletedAt?: number | null;
};

import { SvelteMap } from 'svelte/reactivity';
import { foldersRepository } from './repositories';

class FolderStore {
	items = $state<string[]>([]);
	editingId = $state<string | null>(null);
	folders = new SvelteMap<string, FolderItem>();
	private isInitialized = false;

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
		let i = $state<string[]>([]);
		this.items = i;
		this.folders.clear();

		// Initialize system folders from central registry
		for (const { id, title, profile } of SYSTEM_VIEWS) {
			const folder = $state({
				id,
				title,
				url: '#',
				items: [],
				parentId: null,
				profile,
				isFavorite: false,
				deletedAt: null
			});
			this.folders.set(id, folder);
		}
	}

	loadItems(initialItems: any[] = []) {
		initialItems.forEach((item) => {
			if (item.id) {
				if (item.deletedAt === undefined) item.deletedAt = null;
				if (item.isFavorite === undefined) item.isFavorite = false;
				let i = $state(item);
				this.folders.set(item.id, i);

				// Plan 8: Section Isolation
				// Only add to root items if it's in the folders section
				const profile = resolveProfile(i);
				const isSystemFolder = SYSTEM_VIEWS.some(v => v.id === item.id);
				
				if (!item.parentId && profile.section === 'folders' && !isSystemFolder) {
					this.items.push(item.id);
				}
			}
		});
		console.log('loaded items:', this.items);
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
			console.error('Failed to load folders from storage:', error);
			throw error;
		}
	}

	persist(id: string) {
		console.log('isInitialized', this.isInitialized);
		if (!this.isInitialized) return;

		const folder = this.folders.get(id);
		if (folder) {
			// Plan 8: Don't persist view-section folders (managed locally)
			const profile = resolveProfile(folder);
			if (profile.section === 'views') return;

			foldersRepository.save($state.snapshot(folder));
		}
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

	createFolder(parentId: FolderID | null = null) {
		const newFolder: FolderItem = {
			id: crypto.randomUUID(),
			title: 'New Folder',
			url: '#',
			isFavorite: false,
			items: [],
			parentId: null,
			deletedAt: null
		};

		if (!parentId) {
			this.items.unshift(newFolder.id);
		} else {
			const parent = this.folders.get(parentId);
			if (parent) {
				if (!parent.items) {
					let i = $state([]);
					parent.items = i;
				}
				parent.items.unshift(newFolder.id);
				parent.isOpen = true;
				newFolder.parentId = parent.id;
				this.persist(parent.id);
			}
		}

		let nf = $state(newFolder);
		this.folders.set(newFolder.id, nf);
		this.persist(newFolder.id);
		this.startRename(newFolder.id);
		return newFolder.id;
	}

	deleteFolder(id: string, batchTimestamp?: number) {
		const folder = this.folders.get(id);
		if (!folder) return;

		const ts = batchTimestamp ?? Date.now();

		folder.deletedAt = ts;
		this.folders.set(id, folder);
		this.persist(id);
		this.clearEditingIfSelected(id);
	}

	restoreFolder(id: string, targetBatch?: number) {
		const folder = this.folders.get(id);
		if (!folder || folder.deletedAt == null) return;

		const batch = targetBatch ?? folder.deletedAt;

		if (folder.deletedAt === batch) {
			folder.deletedAt = null;
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

	renameFolder(id: FolderID, newTitle: string) {
		this.editingId = null;
		const folder = this.folders.get(id);

		if (folder && newTitle.trim() !== '') {
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

	setFavorite(id: FolderID, isFavorite: boolean) {
		const folder = this.folders.get(id);
		if (!folder) return;
		folder.isFavorite = isFavorite;
		this.folders.set(id, folder);
		this.persist(id);
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
			url: '#',
			items: [],
			parentId: null,
			deletedAt: null
		};
		let nf = $state(newFolder);
		this.folders.set(newFolder.id, nf);
		this.items.unshift(newFolder.id);
		this.persist(newFolder.id);
		return newFolder.id;
	}
}

export const folderStore = new FolderStore();

