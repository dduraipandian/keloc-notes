import type { NoteItem } from '../notes.svelte';

export type SourceKind = 'folder' | 'view';
export type SourceIconKey = 'folder' | 'trash' | 'star' | 'notes-home';
export type SidebarSectionID = 'views' | 'folders';
export type SidebarSectionPlacement = 'header' | 'content';

export type SidebarSectionDefinition = {
	id: SidebarSectionID;
	label: string | null;
	placement: SidebarSectionPlacement;
};

export const SIDEBAR_SECTIONS: SidebarSectionDefinition[] = [
	{ id: 'views', label: null, placement: 'header' },
	{ id: 'folders', label: 'Folders', placement: 'content' }
];

export type SourceCapabilities = {
	canRename: boolean;
	canDelete: boolean;
	canCreateSubfolder: boolean;
	canCreateNote: boolean;
	canSetFavorite: boolean;
	canEmpty: boolean;
	showsDeletedNotes: boolean;
};

export interface NoteSource {
	readonly id: string;
	readonly kind: SourceKind;
	readonly section: SidebarSectionID;
	readonly title: string;
	readonly iconKey: SourceIconKey;
	readonly capabilities: SourceCapabilities;
	getNotes(): NoteItem[];
	getCount(): number;
	getChildren(): string[];
}
