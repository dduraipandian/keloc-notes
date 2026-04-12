import type { NoteItem } from '../notes.svelte';

export type SourceKind = 'folder' | 'view';

export type SourceIconKey = 'folder' | 'trash' | 'star' | 'tag' | 'notes-home';

/**
 * Capability flags that drive UI affordances (context menu items, buttons).
 * A source's capabilities are derived from its backing state (e.g. a folder's
 * isProtected flag) — components read them, they never mutate them.
 */
export type SourceCapabilities = {
	canRename: boolean;
	canDelete: boolean;
	canCreateSubfolder: boolean;
	canCreateNote: boolean;
	/** True for sources that display already-deleted notes (e.g. trash, a deleted folder subtree).
	 *  Drives the note-row context menu: restore/permanent vs delete. */
	showsDeletedNotes: boolean;
};

/**
 * A polymorphic "thing the sidebar can select". Two concrete kinds:
 *   - 'folder' — backed by a real FolderItem in folderStore
 *   - 'view'   — backed by a predicate over notesStore (Trash, future Favorites, Tags)
 *
 * Sources are stateless adapters — they read live from the stores. Do not put
 * $state inside a source; it would fight the store reactivity graph.
 */
export interface NoteSource {
	readonly id: string;
	readonly kind: SourceKind;
	readonly title: string;
	readonly iconKey: SourceIconKey;
	readonly capabilities: SourceCapabilities;
	getNotes(): NoteItem[];
	getCount(): number;
	/** [] for views; subfolder ids for folder sources. */
	getChildren(): string[];
}
