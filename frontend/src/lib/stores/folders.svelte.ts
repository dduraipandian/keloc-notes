export type FolderItem = {
	id: string;
	title: string;
	url: string;
	badge?: number;
	items?: FolderItem[];
	isOpen?: boolean;
};

import { loadFolderState, saveFolderState } from './idb';

class FolderStore {
	items = $state<FolderItem[]>([]);
	selectedItem = $state<FolderItem | null>(null);
	editingId = $state<string | null>(null);
	private isInitialized = false;

	constructor(initialItems: FolderItem[] = []) {
		this.items = initialItems;
	}

	async init() {
		if (this.isInitialized) return;

		try {
			const savedState = await loadFolderState();
			if (savedState) {
				this.items = savedState.items;
				if (savedState.selectedId) {
					this.selectedItem = this.findItemById(this.items, savedState.selectedId);
				}
			}
			this.isInitialized = true;
		} catch (error) {
			console.error('Failed to load folders from storage:', error);
			throw error;
		}
	}

	private findItemById(items: FolderItem[], id: string): FolderItem | null {
		for (const item of items) {
			if (item.id === id) return item;
			if (item.items) {
				const found = this.findItemById(item.items, id);
				if (found) return found;
			}
		}
		return null;
	}

	private isChildOf(parentId: string, potentialChildId: string): boolean {
		const parent = this.findItemById(this.items, parentId);
		if (!parent || !parent.items) return false;
		return this.findItemById(parent.items, potentialChildId) !== null;
	}

	persist() {
		if (!this.isInitialized) return;
		saveFolderState({
			items: $state.snapshot(this.items),
			selectedId: this.selectedItem?.id ?? null
		});
	}

	selectItem(item: FolderItem | null) {
		this.selectedItem = item;
		this.persist();
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

	createFolder() {
		const newFolder: FolderItem = {
			id: crypto.randomUUID(),
			title: 'New Folder',
			url: '#'
		};

		if (!this.selectedItem) {
			this.items.unshift(newFolder);
		} else {
			if (!this.selectedItem.items) {
				this.selectedItem.items = [];
			}
			this.selectedItem.items.unshift(newFolder);
			this.selectedItem.isOpen = true;
		}

		this.selectedItem = newFolder;
		this.startRename(newFolder.id);
	}

	deleteFolder(id: string, shouldPersist = true) {
		const removeRecursive = (list: FolderItem[]): FolderItem[] => {
			return list
				.filter((item) => item.id !== id)
				.map((item) => {
					if (item.items) {
						return { ...item, items: removeRecursive(item.items) };
					}
					return item;
				});
		};

		this.items = removeRecursive(this.items);

		// If selectedItem is gone (either it was deleted or its parent was), clear it
		if (this.selectedItem && !this.findItemById(this.items, this.selectedItem.id)) {
			this.selectedItem = null;
		}

		if (this.editingId === id) {
			this.editingId = null;
		}

		if (shouldPersist) {
			this.persist();
		}
	}

	renameFolder(id: string, newTitle: string) {
		if (newTitle.trim() === '') return;

		// The title is already updated via bind:value usually,
		// but we can ensure coordination here if needed.
		this.editingId = null;
		this.persist();
	}
	openFolder(folder: FolderItem) {
		folder.isOpen = !folder.isOpen;
		this.persist();
	}

	moveFolder(sourceId: string, targetParentId: string | null) {
		if (sourceId === targetParentId) return;

		// 1. Find the item
		const item = this.findItemById(this.items, sourceId);
		if (!item) return;

		// 2. Prevent moving a parent into its own child
		if (targetParentId && this.isChildOf(sourceId, targetParentId)) {
			console.warn('Cannot move a folder into its own subtree');
			return;
		}

		// 3. Track if it was selected
		const wasSelected = this.selectedItem?.id === sourceId;

		// 4. Create a snapshot of the item
		const clonedItem = $state.snapshot(item);

		// 5. Remove from current position (silently)
		this.deleteFolder(sourceId, false);

		// 6. Insert into target
		if (targetParentId === null) {
			this.items.push(clonedItem);
		} else {
			const targetParent = this.findItemById(this.items, targetParentId);
			if (targetParent) {
				if (!targetParent.items) targetParent.items = [];
				targetParent.items.push(clonedItem);
				targetParent.isOpen = true; // Open the new parent
			}
		}

		// 7. Restore selection if it moved
		if (wasSelected) {
			this.selectedItem = this.findItemById(this.items, sourceId);
		}

		this.persist();
	}
}

// Initial mock data
const initialMockData: FolderItem[] = [];
const initialMockData1: FolderItem[] = [
	{
		id: 'all-icloud',
		title: 'All iCloud',
		url: '#',
		badge: 111
	},
	{
		id: 'notes',
		title: 'Notes',
		url: '#',
		badge: 40
	},
	{
		id: 'algorithms',
		title: 'Algorithms',
		url: '#'
	},
	{
		id: 'engineering-concepts',
		title: 'Engineering Concepts',
		url: '#',
		badge: 1
	},
	{
		id: 'personal',
		title: 'Personal',
		url: '#',
		badge: 8
	},
	{
		id: 'work',
		title: 'Work',
		url: '#',
		badge: 11,
		isOpen: true,
		items: [
			{
				id: 'engineering-dashboard',
				title: 'Engineering Dashboard',
				url: '#',
				badge: 1
			},
			{
				id: 'esentire',
				title: 'eSentire',
				url: '#',
				badge: 4
			},
			{
				id: 'learnings',
				title: 'Learnings',
				url: '#',
				badge: 15,
				isOpen: false,
				items: [
					{
						id: 'svelte',
						title: 'Svelte',
						url: '#'
					},
					{
						id: 'security-fixes',
						title: 'Security fixes',
						url: '#',
						badge: 2
					},
					{
						id: 'golang',
						title: 'Golang',
						url: '#',
						badge: 16
					}
				]
			}
		]
	}
];

export const folderStore = new FolderStore(initialMockData);
