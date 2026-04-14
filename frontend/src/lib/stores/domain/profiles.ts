import type { FolderID, FolderItem } from '../folders.svelte';
import type { NoteItem } from '../notes.svelte';

export type SidebarCapabilities = {
	createNote: boolean;
	createFolder: boolean;
	rename: boolean;
	delete: boolean;
	recover: boolean;
	permanentDelete: boolean;
	emptyTrash: boolean;
	favorite: boolean;
	selectableAfterDelete: boolean;
};

export type FolderProfileConfig = {
	// === View ===
	section: 'views' | 'folders';
	childrenExpandable: boolean;
	showDeletedChildren: boolean;

	// === Capabilities ===
	capabilities: SidebarCapabilities;

	// === Query functions ===
	resolveChildFolderIds: (item: FolderItem, store: any) => FolderID[];
	resolveNotes: (folderId: FolderID, allNotes: NoteItem[], context?: any) => NoteItem[];
};

// Single source of truth for system view folders — order determines sidebar display order.
export const SYSTEM_VIEWS: ReadonlyArray<{ id: string; title: string; profile: string }> = [
	{ id: 'home', title: 'Home', profile: 'home' },
	{ id: 'favorites', title: 'Favorites', profile: 'favorites' },
	{ id: 'deleted-notes', title: 'Recently Deleted', profile: 'trash' }
];

export const PROFILE_REGISTRY: Record<string, FolderProfileConfig> = {
	home: {
		section: 'views',
		childrenExpandable: true,
		showDeletedChildren: false,
		capabilities: {
			createNote: true,
			createFolder: true,
			rename: false,
			delete: false,
			recover: false,
			permanentDelete: false,
			emptyTrash: false,
			favorite: false,
			selectableAfterDelete: false
		},
		resolveChildFolderIds: (item, store) => {
			return (Array.from(store.folders.values()) as FolderItem[])
				.filter((f) => f.parentId === item.id && f.deletedAt == null)
				.map((f) => f.id);
		},
		resolveNotes: (_, allNotes) =>
			allNotes.filter((n) => n.folderId == null && n.deletedAt == null)
	},
	favorites: {
		section: 'views',
		childrenExpandable: false,
		showDeletedChildren: false,
		capabilities: {
			createNote: false,
			createFolder: false,
			rename: false,
			delete: false,
			recover: false,
			permanentDelete: false,
			emptyTrash: false,
			favorite: false,
			selectableAfterDelete: false
		},
		resolveChildFolderIds: (_item, store) => {
			return (Array.from(store.folders.values()) as FolderItem[])
				.filter((f) => f.isFavorite && f.deletedAt == null)
				.map((f) => f.id);
		},
		resolveNotes: (_, allNotes) => allNotes.filter((n) => n.isFavorite && n.deletedAt == null)
	},
	trash: {
		section: 'views',
		childrenExpandable: false,
		showDeletedChildren: true,
		capabilities: {
			createNote: false,
			createFolder: false,
			rename: false,
			delete: false,
			recover: false,
			permanentDelete: false,
			emptyTrash: true,
			favorite: false,
			selectableAfterDelete: false
		},
		resolveChildFolderIds: (_item, store) => {
			return (Array.from(store.folders.values()) as FolderItem[])
				.filter((f) => {
					if (f.deletedAt == null) return false;
					if (!f.parentId) return true;
					const parent = store.folders.get(f.parentId);
					return !parent || parent.deletedAt == null;
				})
				.map((f) => f.id);
		},
		resolveNotes: (_, allNotes) => allNotes.filter((n) => n.deletedAt != null)
	},
	regular: {
		section: 'folders',
		childrenExpandable: true,
		showDeletedChildren: false,
		capabilities: {
			createNote: true,
			createFolder: true,
			rename: true,
			delete: true,
			recover: false,
			permanentDelete: false,
			emptyTrash: false,
			favorite: true,
			selectableAfterDelete: true
		},
		resolveChildFolderIds: (item) => item.items ?? [],
		resolveNotes: (folderId, allNotes) =>
			allNotes.filter((n) => (n.folderId ?? 'root') === folderId && n.deletedAt == null)
	},
	deleted: {
		section: 'folders', // though they don't appear in sidebar root
		childrenExpandable: true,
		showDeletedChildren: false,
		capabilities: {
			createNote: false,
			createFolder: false,
			rename: false,
			delete: false,
			recover: true,
			permanentDelete: true,
			emptyTrash: false,
			favorite: false,
			selectableAfterDelete: false
		},
		resolveChildFolderIds: (item) => item.items ?? [],
		resolveNotes: (folderId, allNotes, context) => {
			const item = context?.folders?.findItemById(folderId);
			if (!item || item.deletedAt == null) return [];

			// If we have a tree helper, use it to find the subtree
			if (context?.tree) {
				const subtreeIds = context.tree.getFolderSubtreeIds(folderId);
				return allNotes.filter(
					(n) => n.folderId != null && subtreeIds.has(n.folderId) && n.deletedAt === item.deletedAt
				);
			}

			return allNotes.filter((n) => n.folderId === folderId && n.deletedAt === item.deletedAt);
		}
	}
};



export function getProfileId(item: FolderItem): string {
	const systemView = SYSTEM_VIEWS.find((v) => v.id === item.id);
	if (systemView) return systemView.profile;

	if (item.deletedAt != null) return 'deleted';
	return item.profile ?? 'regular';
}

export function resolveProfile(item: FolderItem): FolderProfileConfig {
	return PROFILE_REGISTRY[getProfileId(item)];
}
