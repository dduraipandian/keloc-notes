import { folderStore, type FolderID, type FolderItem } from '../folders.svelte';
import { selectionStore } from '../selection.svelte';
import { getSource, listSidebarSectionSources } from './registry.svelte';
import {
	SIDEBAR_SECTIONS,
	type NoteSource,
	type SidebarSectionDefinition,
	type SidebarSectionPlacement,
	type SourceIconKey
} from './types';

type FolderStoreLike = {
	items: FolderID[];
	editingId?: FolderID | null;
	folders: Map<FolderID, FolderItem>;
};

type SelectionStoreLike = {
	selectedFolderID: FolderID | null;
	currentSource?: NoteSource | null;
	getSelectedFolder(): FolderItem | null;
};

export type SidebarSourceItem = {
	id: FolderID;
	item: FolderItem;
	kind: NoteSource['kind'];
	iconKey: SourceIconKey;
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
		setFavorite: boolean;
		recover: boolean;
		permanentDelete: boolean;
		emptyTrash: boolean;
	};
};

export type SidebarSourceSection = {
	id: SidebarSectionDefinition['id'];
	label: string | null;
	placement: SidebarSectionPlacement;
	sources: SidebarSourceItem[];
};

export class FolderSidebarPresenter {
	constructor(
		private readonly folders: FolderStoreLike = folderStore,
		private readonly selection: SelectionStoreLike = selectionStore
	) {}

	getSections(): SidebarSourceSection[] {
		return SIDEBAR_SECTIONS
			.map((section) => ({
				id: section.id,
				label: section.label,
				placement: section.placement,
				sources: listSidebarSectionSources(section.id).map((source) => this.buildSource(source, 0))
			}))
			.filter((section) => section.sources.length > 0);
	}

	private buildSource(source: NoteSource, depth: number): SidebarSourceItem {
		const item =
			this.folders.folders.get(source.id) ??
			({
				id: source.id,
				title: source.title,
				url: '#'
			} satisfies FolderItem);
		const children = source
			.getChildren()
			.map((id) => getSource(id))
			.filter((child): child is NoteSource => !!child)
			.map((child) => this.buildSource(child, depth + 1));

		return {
			id: source.id,
			item,
			kind: source.kind,
			iconKey: source.iconKey,
			title: source.title,
			depth,
			isSelected: this.selection.selectedFolderID === source.id,
			isEditing: this.folders.editingId === source.id,
			isOpen: item.isOpen ?? false,
			noteCount: source.getCount(),
			children,
			capabilities: {
				create: source.capabilities.canCreateSubfolder,
				rename: source.capabilities.canRename,
				delete: source.capabilities.canDelete,
				setFavorite: source.capabilities.canSetFavorite,
				recover: item.deletedAt != null,
				permanentDelete: item.deletedAt != null,
				emptyTrash: source.capabilities.canEmpty && item.deletedAt == null
			}
		};
	}
}

export const folderSidebarPresenter = new FolderSidebarPresenter();
