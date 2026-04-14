import type { FolderID, FolderItem } from '../folders.svelte';
import type { NoteItem } from '../notes.svelte';
import { type Component } from 'svelte';
import Folder from '@lucide/svelte/icons/folder';
import Star from '@lucide/svelte/icons/star';
import Trash2 from '@lucide/svelte/icons/trash-2';

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
	title?: string; // Standard title for system views
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
		title: 'Home',
		iconName: 'folder',
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
			return Array.from(store.folders.values())
				.filter((f: FolderItem) => f.parentId === 'home' && f.deletedAt == null)
				.map((f: FolderItem) => f.id);
		},
		resolveNotes: (_, allNotes) =>
			allNotes.filter((n) => (n.folderId === 'home' || n.folderId == null) && n.deletedAt == null)
	},
	favorites: {
		title: 'Favorites',
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
		title: 'Recently Deleted',
		iconName: 'trash',
		section: 'views',
		childrenExpandable: true,
		showDeletedChildren: true,
		capabilities: {
			createNote: false,
			createFolder: false,
			rename: false,
			delete: false,
			recover: true,
			permanentDelete: true,
			emptyTrash: true,
			favorite: false,
			selectableAfterDelete: false
		},
		resolveChildFolderIds: (item, store) => {
			const allFolders = Array.from(store.folders.values());
			return allFolders
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

const FOLDER_COLOR = '#dcb15a'; // Apple-style gold/folder color

export const ICON_REGISTRY: Record<
	FolderIcon,
	{ component: Component<any>; props: Record<string, any> }
> = {
	folder: { component: Folder as any, props: { style: `color: ${FOLDER_COLOR}`, class: 'opacity-80' } },
	star: { component: Star as any, props: { class: 'fill-[#e0b64b] text-[#e0b64b]' } },
	trash: { component: Trash2 as any, props: { class: 'text-destructive/70' } }
};

export function getProfileId(item: FolderItem): string {
	if (item.deletedAt != null) return 'deleted';
	return item.profile ?? 'regular';
}

export function resolveProfile(item: FolderItem): FolderProfileConfig {
	return PROFILE_REGISTRY[getProfileId(item)];
}

/**
 * Returns a virtual FolderItem for a given profile ID.
 * This is used for system views that don't exist in the physical store.
 */
export function getProfileItem(id: string): FolderItem | null {
	const profile = PROFILE_REGISTRY[id];
	if (!profile) return null;

	return {
		id,
		title: profile.title || 'Notes',
		url: '#',
		profile: id,
		items: [],
		parentId: null,
		deletedAt: null,
		isFavorite: false
	};
}
