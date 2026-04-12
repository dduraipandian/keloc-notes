import { createVirtualView } from './VirtualView';
import { TRASH_VIEW_ID } from './constants';
import type { NoteSource } from './types';

/**
 * The Trash virtual view — shows all notes with deletedAt != null, across
 * every folder. Not a real tree node; no children.
 */
export const trashView: NoteSource = createVirtualView({
	id: TRASH_VIEW_ID,
	title: 'Recently Deleted',
	iconKey: 'trash',
	predicate: (note) => note.deletedAt != null,
	capabilities: {
		canRename: false,
		canDelete: false,
		canCreateSubfolder: false,
		canCreateNote: false,
		showsDeletedNotes: true
	}
});
