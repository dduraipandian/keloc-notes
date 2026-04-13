import type { FolderItem } from '../folders.svelte';
import type { NoteItem } from '../notes.svelte';

export function snapshotFolder(folder: FolderItem): FolderItem {
	return {
		...folder,
		items: folder.items ? [...folder.items] : undefined
	};
}

export function snapshotNote(note: NoteItem): NoteItem {
	return {
		...note
	};
}
