export type FolderItem = {
	id: string;
	title: string;
	url: string;
	badge?: number;
	items?: FolderItem[];
	isOpen?: boolean;
};

class FolderStore {
	items = $state<FolderItem[]>([]);
	selectedItem = $state<FolderItem | null>(null);
	editingId = $state<string | null>(null);

	constructor(initialItems: FolderItem[] = []) {
		this.items = initialItems;
	}

	selectItem(item: FolderItem | null) {
		this.selectedItem = item;
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

	deleteFolder(id: string) {
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

		if (this.selectedItem?.id === id) {
			this.selectedItem = null;
		}
		if (this.editingId === id) {
			this.editingId = null;
		}
	}

	renameFolder(id: string, newTitle: string) {
		if (newTitle.trim() === '') return;
		
		// The title is already updated via bind:value usually, 
		// but we can ensure coordination here if needed.
		this.editingId = null;
	}
}

// Initial mock data
const initialMockData: FolderItem[] = [
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
