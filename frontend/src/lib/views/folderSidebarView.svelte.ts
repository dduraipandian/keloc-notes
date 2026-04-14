import { folderStore, type FolderID, type FolderItem } from '$lib/stores/folders.svelte';
import { folderService, noteService, trashService } from '$lib/stores/services';
import { selectionStore } from '$lib/stores/selection.svelte';
import { uiStore } from '$lib/stores/dialog.svelte';
import type { Component } from 'svelte';
import Folder from '@lucide/svelte/icons/folder';
import Star from '@lucide/svelte/icons/star';
import Trash2 from '@lucide/svelte/icons/trash-2';
import type { FolderIcon, FolderProfileConfig, SidebarCapabilities } from '$lib/stores/domain/profiles';
import { resolveProfile, getProfileId } from '$lib/stores/domain/profiles';

const FOLDER_COLOR = '#dcb15a'; // Apple-style gold/folder color

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

type SidebarActionDeps = {
	folderCreate: () => void;
	folderStartRename: (id: FolderID) => void;
	folderDelete: (id: FolderID) => void;
	folderSetFavorite: (id: FolderID, isFav: boolean) => void;
	trashRecover: (id: FolderID) => void;
	trashPermanentDelete: (title: string, id: FolderID) => void;
	trashEmpty: () => void;
};

const ICON_REGISTRY: Record<FolderIcon, { component: Component<any>; props: Record<string, any> }> = {
	folder: { component: Folder as any, props: { style: `color: ${FOLDER_COLOR}`, class: 'opacity-80' } },
	star: { component: Star as any, props: { class: 'fill-[#e0b64b] text-[#e0b64b]' } },
	trash: { component: Trash2 as any, props: { class: 'text-destructive/70' } }
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

	getSections(): SidebarSourceSection[] {
		return [
			{
				id: 'views',
				label: null,
				sources: ['home', 'favorites', 'deleted-notes']
					.map((id) => this.folders.folders.get(id))
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
	}

	private buildSource(item: FolderItem, depth: number, suppressChildren = false): SidebarSourceItem {
		const profile = resolveProfile(item);
		const iconConfig = ICON_REGISTRY[profile.iconName];

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
			noteCount: this.noteQueries.getNoteCountForFolder(item.id, item.profile),
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
