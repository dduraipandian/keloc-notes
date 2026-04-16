import { folderStore, type FolderID, type FolderItem } from '$lib/stores/folders.svelte';
import { folderService, noteService, trashService } from '$lib/stores/services';
import { selectionStore } from '$lib/stores/selection.svelte';
import { uiStore } from '$lib/stores/dialog.svelte';
import type { Component } from 'svelte';
import Home from '@lucide/svelte/icons/home';
import Folder from '@lucide/svelte/icons/folder';
import Star from '@lucide/svelte/icons/star';
import Trash2 from '@lucide/svelte/icons/trash-2';
import type { FolderProfileConfig, SidebarCapabilities } from '$lib/stores/domain/profiles';
import { resolveProfile, getProfileId, SYSTEM_VIEWS } from '$lib/stores/domain/profiles';

const HOME_COLOR = '#4dbb5f';
const FAVORITE_COLOR = '#f5d04e';
const TRASH_COLOR = '#e85a5a';
const FOLDER_COLOR = '#d4a34b';

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
	profile: string;
	icon: Component<any>;
	iconProps: Record<string, any>;
	title: string;
	depth: number;
	isSelected: boolean;
	isEditing: boolean;
	isOpen: boolean;
	noteCount: number;
	children: SidebarSourceItem[];
	capabilities: SidebarCapabilities;
	contextMenuItems: ContextMenuItem[];
};

export type SidebarSourceSection = {
	id: 'views' | 'folders';
	label: string | null;
	sources: SidebarSourceItem[];
};

export type SidebarNavigationItem = {
	id: FolderID;
	parentId: FolderID | null;
	firstChildId: FolderID | null;
	hasChildren: boolean;
	isOpen: boolean;
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

export const ICON_REGISTRY: Record<
	string,
	{ component: Component<any>; props: Record<string, any> }
> = {
	home: {
		component: Home as any,
		props: { style: `color: ${HOME_COLOR}` }
	},
	favorites: {
		component: Star as any,
		props: { style: `color: ${FAVORITE_COLOR}`, fill: FAVORITE_COLOR }
	},
	trash: { component: Trash2 as any, props: { style: `color: ${TRASH_COLOR}` } },
	regular: {
		component: Folder as any,
		props: { style: `color: ${FOLDER_COLOR}` }
	},
	deleted: {
		component: Folder as any,
		props: { style: `color: ${FOLDER_COLOR}` }
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
	trashEmpty: () => uiStore.confirmEmptyTrash(() => trashService.emptyTrash())
};

export class FolderSidebarView {
	constructor(
		private readonly folders = folderStore,
		private readonly folderQueries = folderService,
		private readonly noteQueries = noteService,
		private readonly selection = selectionStore,
		private readonly actions: SidebarActionDeps = defaultSidebarActionDeps
	) {}

	sections = $derived.by((): SidebarSourceSection[] => {
		return [
			{
				id: 'views',
				label: null,
				sources: SYSTEM_VIEWS.map(({ id }) => this.folders.folders.get(id))
					.filter((item): item is FolderItem => !!item)
					.map((item) => this.buildSource(item, 0, false))
			},
			{
				id: 'folders',
				label: 'Folders',
				sources: (this.folders.items ?? [])
					.map((id) => this.folders.folders.get(id))
					.filter((item): item is FolderItem => {
						if (!item || item.deletedAt != null) return false;
						return resolveProfile(item).section === 'folders';
					})
					.map((item) => this.buildSource(item, 0, false))
			}
		];
	});

	getSections(): SidebarSourceSection[] {
		return this.sections;
	}

	getNavigableIds(): FolderID[] {
		const ids: FolderID[] = [];
		const visit = (source: SidebarSourceItem) => {
			ids.push(source.id);
			if (source.isOpen) {
				source.children.forEach(visit);
			}
		};

		this.getSections().forEach((section) => {
			section.sources.forEach(visit);
		});

		return ids;
	}

	getNavigationItem(id: FolderID): SidebarNavigationItem | null {
		const find = (source: SidebarSourceItem): SidebarNavigationItem | null => {
			if (source.id === id) {
				return {
					id: source.id,
					parentId: source.item.parentId ?? null,
					firstChildId: source.children[0]?.id ?? null,
					hasChildren: source.children.length > 0,
					isOpen: source.isOpen
				};
			}

			for (const child of source.children) {
				const match = find(child);
				if (match) return match;
			}

			return null;
		};

		for (const section of this.getSections()) {
			for (const source of section.sources) {
				const match = find(source);
				if (match) return match;
			}
		}

		return null;
	}

	private buildSource(
		item: FolderItem,
		depth: number,
		suppressChildren = false
	): SidebarSourceItem {
		const profile = resolveProfile(item);
		const iconConfig = ICON_REGISTRY[getProfileId(item)] ?? ICON_REGISTRY.regular;

		const childIds = suppressChildren ? [] : profile.resolveChildFolderIds(item, this.folders);
		const visibleChildIds = childIds.filter((id) => {
			const child = this.folders.folders.get(id);
			return profile.showDeletedChildren || child?.deletedAt == null;
		});

		return {
			id: item.id,
			item,
			profile: getProfileId(item),
			icon: iconConfig.component,
			iconProps: iconConfig.props,
			title: item.title,
			depth,
			isSelected: this.selection.selectedFolderID === item.id,
			isEditing: this.folders.editingId === item.id,
			isOpen: item.isOpen ?? false,
			noteCount: this.noteQueries.getNoteCountForFolder(item.id, getProfileId(item)),
			children: visibleChildIds
				.map((id) => this.folders.folders.get(id))
				.filter((child): child is FolderItem => !!child)
				.map((child) => this.buildSource(child, depth + 1, !profile.childrenExpandable)),
			capabilities: profile.capabilities,
			contextMenuItems: this.buildContextMenuItems(item, profile)
		};
	}

	private buildContextMenuItems(item: FolderItem, profile: FolderProfileConfig): ContextMenuItem[] {
		const items: ContextMenuItem[] = [];
		const caps = profile.capabilities;

		if (caps.recover) {
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

		if (caps.emptyTrash) {
			items.push({
				label: 'Empty Trash',
				action: () => this.actions.trashEmpty(),
				variant: 'destructive',
				separatorAfter: false
			});
			return items;
		}

		if (caps.createFolder) {
			items.push({
				label: 'New Folder',
				action: () => this.actions.folderCreate(),
				variant: 'default',
				separatorAfter: false
			});
		}

		if (caps.favorite) {
			items.push({
				label: item.isFavorite ? 'Remove From Favorites' : 'Add To Favorites',
				action: () => this.actions.folderSetFavorite(item.id, item.isFavorite !== true),
				variant: 'default',
				separatorAfter: false
			});
		}

		if (caps.rename) {
			items.push({
				label: 'Rename',
				action: () => this.actions.folderStartRename(item.id),
				variant: 'default',
				separatorAfter: false
			});
		}

		if (caps.delete) {
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
