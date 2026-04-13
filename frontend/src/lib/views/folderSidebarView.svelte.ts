import { folderStore, type FolderID, type FolderItem, type FolderType } from '$lib/stores/folders.svelte.ts';
import { folderService, noteService, trashService } from '$lib/stores/services';
import { selectionStore } from '$lib/stores/selection.svelte.ts';
import { uiStore } from '$lib/stores/dialog.svelte.ts';

export type FolderIcon = 'folder' | 'star' | 'trash';
export type ContextMenuItemVariant = 'default' | 'destructive';

export type ContextMenuItem = {
	label: string;
	action: () => void;
	variant: ContextMenuItemVariant;
	separatorAfter: boolean;
};

export type SidebarSourceItem = {
	id: FolderID;
	item: FolderItem;
	kind: string;
	type: string;
	icon: FolderIcon;
	title: string;
	depth: number;
	isSelected: boolean;
	isEditing: boolean;
	isOpen: boolean;
	noteCount: number;
	children: SidebarSourceItem[];
	capabilities: {
		create: boolean;
		rename: boolean;
		delete: boolean;
		recover: boolean;
		permanentDelete: boolean;
		emptyTrash: boolean;
	};
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
				sources: ['deleted-notes', 'favorites']
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

	private buildSource(item: FolderItem, depth: number, isViewTree = false): SidebarSourceItem {
		const kind = item.type === 'trash' ? 'trash' : item.id === 'favorites' ? 'favorites' : 'regular';
		const type = kind === 'trash' || kind === 'favorites' ? 'view' : 'regular';
		const icon: FolderIcon =
			kind === 'trash' ? 'trash' : kind === 'favorites' ? 'star' : 'folder';

		const childIds =
			kind === 'trash'
				? this.folderQueries.getTrashRootIds()
				: kind === 'favorites'
					? this.folderQueries.getFavoriteFolderIds()
					: item.items || [];

		const visibleChildIds =
			kind === 'trash' || kind === 'favorites' || !isViewTree
				? childIds.filter((id) => kind === 'trash' || this.folders.folders.get(id)?.deletedAt == null)
				: [];

		const capabilities = {
			create: item.deletedAt == null && item.type !== 'system',
			rename:
				item.deletedAt == null && !isViewTree && item.type !== 'system' && item.type !== 'trash',
			delete:
				item.deletedAt == null && !isViewTree && item.type !== 'system' && item.type !== 'trash',
			recover: item.deletedAt != null,
			permanentDelete: item.deletedAt != null,
			emptyTrash: isViewTree && item.deletedAt == null
		};

		return {
			id: item.id,
			item,
			kind,
			type,
			icon,
			title: item.title,
			depth,
			isSelected: this.selection.selectedFolderID === item.id,
			isEditing: this.folders.editingId === item.id,
			isOpen: item.isOpen ?? false,
			noteCount: this.noteQueries.getNoteCountForFolder(item.id, item.type),
			children: visibleChildIds
				.map((id) => this.folders.folders.get(id))
				.filter((child): child is FolderItem => !!child)
				.map((child) => this.buildSource(child, depth + 1, isViewTree || type === 'view')),
			capabilities,
			contextMenuItems: this.buildContextMenuItems(item, capabilities, kind)
		};
	}

	private buildContextMenuItems(
		item: FolderItem,
		capabilities: SidebarSourceItem['capabilities'],
		kind: string
	): ContextMenuItem[] {
		const items: ContextMenuItem[] = [];

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

		if (item.type !== 'system' && item.type !== 'trash') {
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
