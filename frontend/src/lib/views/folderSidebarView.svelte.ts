import { folderStore, type FolderID, type FolderItem } from '$lib/stores/folders.svelte';
import { folderService, noteService, trashService } from '$lib/stores/services';
import { selectionStore } from '$lib/stores/selection.svelte';
import { uiStore } from '$lib/stores/dialog.svelte';
import { type FolderIcon, type FolderProfileConfig, type SidebarCapabilities, ICON_REGISTRY, PROFILE_REGISTRY } from '$lib/stores/domain/profiles';
import { resolveProfile, getProfileId, getProfileItem } from '$lib/stores/domain/profiles';

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
	icon: any; // Using any for component to avoid strict Component<any> mismatch if any
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
	folderCreate: (id?: FolderID) => void;
	folderStartRename: (id: FolderID) => void;
	folderDelete: (id: FolderID) => void;
	folderSetFavorite: (id: FolderID, isFav: boolean) => void;
	trashRecover: (id: FolderID) => void;
	trashPermanentDelete: (title: string, id: FolderID) => void;
	trashEmpty: () => void;
};

const defaultSidebarActionDeps: SidebarActionDeps = {
	folderCreate: (id) => folderService.create(id),
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
		// Plan: Build section sources according to logical constraints in profile registry
		const viewSources = Object.keys(PROFILE_REGISTRY)
			.filter((id) => PROFILE_REGISTRY[id].section === 'views')
			.map((id) => getProfileItem(id))
			.filter((item): item is FolderItem => !!item)
			.map((item) => this.buildSource(item, 0, false));

		return [
			{
				id: 'views',
				label: null,
				sources: viewSources
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
			title: profile.title || item.title,
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
				action: () => this.actions.folderCreate(item.id),
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
