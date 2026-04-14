import type { FolderID, FolderItem } from '../folders.svelte';
import type { NoteItem } from '../notes.svelte';

export type FolderIcon = 'folder' | 'star' | 'trash';

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
	iconName: FolderIcon;
	section: 'views' | 'folders';
	childrenExpandable: boolean;
	showDeletedChildren: boolean;

	// === Capabilities ===
	capabilities: SidebarCapabilities;

	// === Query functions ===
	resolveChildFolderIds: (item: FolderItem, store: any) => FolderID[];
	resolveNotes: (folderId: FolderID, allNotes: NoteItem[], context?: any) => NoteItem[];
};

export const PROFILE_REGISTRY: Record<string, FolderProfileConfig> = {
	home: {
		iconName: 'folder',
		section: 'views',
		childrenExpandable: false,
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
			return Array.from(store.folders.values())
				.filter((f: FolderItem) => f.parentId == null && f.deletedAt == null && (!f.profile || f.profile === 'regular'))
				.map((f: FolderItem) => f.id);
		},
		resolveNotes: (_, allNotes) =>
			allNotes.filter((n) => n.folderId == null && n.deletedAt == null)
	},
	favorites: {
		iconName: 'star',
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
		resolveChildFolderIds: (item, store) => {
			return Array.from(store.folders.values())
				.filter((f: FolderItem) => f.isFavorite && f.deletedAt == null)
				.map((f: FolderItem) => f.id);
		},
		resolveNotes: (_, allNotes) => allNotes.filter((n) => n.isFavorite && n.deletedAt == null)
	},
	trash: {
		iconName: 'trash',
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
		resolveChildFolderIds: (item, store) => {
			return Array.from(store.folders.values())
				.filter((f: FolderItem) => {
					if (f.deletedAt == null) return false;
					if (!f.parentId) return true;
					const parent = store.folders.get(f.parentId);
					return !parent || parent.deletedAt == null;
				})
				.map((f: FolderItem) => f.id);
		},
		resolveNotes: (_, allNotes) => allNotes.filter((n) => n.deletedAt != null)
	},
	regular: {
		iconName: 'folder',
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
		iconName: 'folder',
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
	if (item.deletedAt != null) return 'deleted';
	return item.profile ?? 'regular';
}

export function resolveProfile(item: FolderItem): FolderProfileConfig {
	return PROFILE_REGISTRY[getProfileId(item)];
}
