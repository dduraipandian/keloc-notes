import { folderStore, type FolderID, type FolderItem, type FolderType } from '$lib/stores/folders.svelte';
import { folderService, noteService, trashService } from '$lib/stores/services';
import { selectionStore } from '$lib/stores/selection.svelte';
import { uiStore } from '$lib/stores/dialog.svelte';

const FOLDER_COLOR = '#dcb15a'; // Apple-style gold/folder color

export type SidebarKind = 'trash' | 'favorites' | 'home' | 'regular' | 'deleted';
export type FolderIcon = 'folder' | 'star' | 'trash';
export type ContextMenuItemVariant = 'default' | 'destructive';

export type SidebarItemProfile = {
	kind: SidebarKind;
	type: 'view' | 'regular';
	iconName: FolderIcon;
	getChildIds: (
		folders: typeof folderStore,
		folderQueries: typeof folderService,
		item: FolderItem
	) => FolderID[];
	filterChildren: (folders: typeof folderStore, id: FolderID) => boolean;
	capabilities: {
		create: boolean;
		rename: boolean;
		delete: boolean;
		recover: boolean;
		permanentDelete: boolean;
		emptyTrash: boolean;
		favorite: boolean;
	};
};

export type ContextMenuItem = {
	label: string;
	action: () => void;
	variant: ContextMenuItemVariant;
	separatorAfter: boolean;
};

export type SidebarSourceItem = {
	id: FolderID;
	item: FolderItem;
	kind: SidebarKind;
	type: string;
	iconName: FolderIcon;
	title: string;
	depth: number;
	isSelected: boolean;
	isEditing: boolean;
	isOpen: boolean;
	noteCount: number;
	children: SidebarSourceItem[];
	capabilities: SidebarItemProfile['capabilities'];
	contextMenuItems: ContextMenuItem[];
};

export type SidebarSourceSection = {
	id: 'views' | 'folders';
	label: string | null;
	sources: SidebarSourceItem[];
};

type SidebarActionDeps = {
	folderCreate: () => void;
	folderStartRename: (id: FolderID) => void;
	folderDelete: (id: FolderID) => void;
	folderSetFavorite: (id: FolderID, isFav: boolean) => void;
	trashRecover: (id: FolderID) => void;
	trashPermanentDelete: (title: string, id: FolderID) => void;
	trashEmpty: () => void;
};

const PROFILES: Record<SidebarKind, SidebarItemProfile> = {
	home: {
		kind: 'home',
		type: 'view',
		iconName: 'folder',
		getChildIds: (st) =>
			st.items.filter((id) => {
				const f = st.folders.get(id);
				return f && f.type !== 'system' && f.type !== 'trash';
			}),
		filterChildren: (st, id) => st.folders.get(id)?.deletedAt == null,
		capabilities: {
			create: true,
			rename: false,
			delete: false,
			recover: false,
			permanentDelete: false,
			emptyTrash: false,
			favorite: false
		}
	},
	favorites: {
		kind: 'favorites',
		type: 'view',
		iconName: 'star',
		getChildIds: (_, q) => q.getFavoriteFolderIds(),
		filterChildren: (st, id) => st.folders.get(id)?.deletedAt == null,
		capabilities: {
			create: false,
			rename: false,
			delete: false,
			recover: false,
			permanentDelete: false,
			emptyTrash: false,
			favorite: false
		}
	},
	trash: {
		kind: 'trash',
		type: 'view',
		iconName: 'trash',
		getChildIds: (_, q) => q.getTrashRootIds(),
		filterChildren: () => true, // All trash roots are visible
		capabilities: {
			create: false,
			rename: false,
			delete: false,
			recover: false,
			permanentDelete: false,
			emptyTrash: true,
			favorite: false
		}
	},
	regular: {
		kind: 'regular',
		type: 'regular',
		iconName: 'folder',
		getChildIds: (_, __, item) => item.items || [],
		filterChildren: (st, id) => st.folders.get(id)?.deletedAt == null,
		capabilities: {
			create: true,
			rename: true,
			delete: true,
			recover: false,
			permanentDelete: false,
			emptyTrash: false,
			favorite: true
		}
	},
	deleted: {
		kind: 'deleted',
		type: 'regular',
		iconName: 'folder',
		getChildIds: (_, __, item) => item.items || [],
		filterChildren: () => true,
		capabilities: {
			create: false,
			rename: false,
			delete: false,
			recover: true,
			permanentDelete: true,
			emptyTrash: false,
			favorite: false
		}
	}
};

const defaultSidebarActionDeps: SidebarActionDeps = {
	folderCreate: () => folderService.create(),
	folderStartRename: (id) => folderService.startRename(id),
	folderDelete: (id) =>
		uiStore.confirmFolderDelete(folderStore.folders.get(id)?.title ?? '', () =>
			folderService.delete(id)
		),
	folderSetFavorite: (id, isFav) => folderService.setFavorite(id, isFav),
	trashRecover: (id) => trashService.recoverFolder(id),
	trashPermanentDelete: (title, id) =>
		uiStore.confirmFolderPermanentDelete(title, () => trashService.permanentlyDeleteFolder(id)),
	trashEmpty: () => uiStore.confirmEmptyTrash(() => trashService.empty())
};

export class FolderSidebarView {
	constructor(
		private readonly folders = folderStore,
		private readonly folderQueries = folderService,
		private readonly noteQueries = noteService,
		private readonly selection = selectionStore,
		private readonly actions: SidebarActionDeps = defaultSidebarActionDeps
	) {}

	getSections(): SidebarSourceSection[] {
		return [
			{
				id: 'views',
				label: null,
				sources: ['home', 'favorites', 'deleted-notes']
					.map((id) => this.folders.folders.get(id))
					.filter((item): item is FolderItem => !!item)
					.map((item) => this.buildSource(item, 0, true))
			},
			{
				id: 'folders',
				label: 'Folders',
				sources: (this.folders.items ?? [])
					.map((id) => this.folders.folders.get(id))
					.filter(
						(item): item is FolderItem =>
							!!item && item.deletedAt == null && item.type !== 'trash' && item.type !== 'system'
					)
					.map((item) => this.buildSource(item, 0, false))
			}
		];
	}

	private resolveProfile(item: FolderItem, isViewTree: boolean): SidebarItemProfile {
		if (item.deletedAt != null) return PROFILES.deleted;
		if (item.id === 'home') return PROFILES.home;
		if (item.id === 'favorites') return PROFILES.favorites;
		if (item.type === 'trash' || item.id === 'deleted-notes') return PROFILES.trash;
		return PROFILES.regular;
	}

	private buildSource(item: FolderItem, depth: number, isViewTree = false): SidebarSourceItem {
		const profile = this.resolveProfile(item, isViewTree);
		const childIds = profile.getChildIds(this.folders, this.folderQueries, item);
		const visibleChildIds = childIds.filter((id) => profile.filterChildren(this.folders, id));

		return {
			id: item.id,
			item,
			kind: profile.kind,
			type: profile.type,
			iconName: profile.iconName,
			title: item.title,
			depth,
			isSelected: this.selection.selectedFolderID === item.id,
			isEditing: this.folders.editingId === item.id,
			isOpen: item.isOpen ?? false,
			noteCount: this.noteQueries.getNoteCountForFolder(item.id, item.type),
			children: visibleChildIds
				.map((id) => this.folders.folders.get(id))
				.filter((child): child is FolderItem => !!child)
				.map((child) => this.buildSource(child, depth + 1, isViewTree || profile.type === 'view')),
			capabilities: profile.capabilities,
			contextMenuItems: this.buildContextMenuItems(item, profile)
		};
	}

	private buildContextMenuItems(item: FolderItem, profile: SidebarItemProfile): ContextMenuItem[] {
		const items: ContextMenuItem[] = [];
		const { capabilities } = profile;

		if (capabilities.recover) {
			items.push({
				label: 'Recover Folder',
				action: () => this.actions.trashRecover(item.id),
				variant: 'default',
				separatorAfter: true
			});
			items.push({
				label: 'Delete Permanently',
				action: () => this.actions.trashPermanentDelete(item.title, item.id),
				variant: 'destructive',
				separatorAfter: false
			});
			return items;
		}

		if (capabilities.emptyTrash) {
			items.push({
				label: 'Empty Trash',
				action: () => this.actions.trashEmpty(),
				variant: 'destructive',
				separatorAfter: false
			});
			return items;
		}

		if (capabilities.create) {
			items.push({
				label: 'New Folder',
				action: () => this.actions.folderCreate(),
				variant: 'default',
				separatorAfter: false
			});
		}

		if (capabilities.favorite) {
			items.push({
				label: item.isFavorite ? 'Remove From Favorites' : 'Add To Favorites',
				action: () => this.actions.folderSetFavorite(item.id, item.isFavorite !== true),
				variant: 'default',
				separatorAfter: false
			});
		}

		if (capabilities.rename) {
			items.push({
				label: 'Rename',
				action: () => this.actions.folderStartRename(item.id),
				variant: 'default',
				separatorAfter: false
			});
		}

		if (capabilities.delete) {
			if (items.length > 0) {
				items[items.length - 1].separatorAfter = true;
			}
			items.push({
				label: 'Delete',
				action: () => this.actions.folderDelete(item.id),
				variant: 'destructive',
				separatorAfter: false
			});
		}

		return items;
	}
}

export const folderSidebarView = new FolderSidebarView();
