export type FolderType = 'all' | 'trash' | 'regular';

export type FolderItem = {
	id: string;
	title: string;
	url: string;
	type?: FolderType;
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

	deleteFolder(id: string, shouldPersist: boolean = true) {
		const wasSelected = this.selectedItem?.id === id;
		const isChildSelected = this.selectedItem && this.isChildOf(id, this.selectedItem.id);

		this.items = this.filterItems(this.items, id);

		if (wasSelected || isChildSelected) {
			this.selectedItem = null;
		}

		if (this.editingId === id) {
			this.editingId = null;
		}

		if (shouldPersist) {
			this.persist();
		}
	}

	private filterItems(items: FolderItem[], id: string): FolderItem[] {
		return items.filter((item) => {
			if (item.id === id) return false;
			if (item.items) {
				item.items = this.filterItems(item.items, id);
			}
			return true;
		});
	}

	private isChildOf(parentId: string, childId: string): boolean {
		const parent = this.findItemById(this.items, parentId);
		if (!parent || !parent.items) return false;
		return this.findInChildren(parent.items, childId);
	}

	private findInChildren(items: FolderItem[], id: string): boolean {
		for (const item of items) {
			if (item.id === id) return true;
			if (item.items && this.findInChildren(item.items, id)) return true;
		}
		return false;
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

	renameFolder(id: string, newTitle: string) {
		if (newTitle.trim() === '') return;
		this.editingId = null;
		this.persist();
	}

	openFolder(folder: FolderItem) {
		folder.isOpen = !folder.isOpen;
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
		type: 'all'
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
