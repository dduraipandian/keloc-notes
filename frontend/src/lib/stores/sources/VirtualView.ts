import type { NoteSource, SourceCapabilities, SourceIconKey } from './types';
import type { NoteItem } from '../notes.svelte';
import { notesStore } from '../notes.svelte';

export type VirtualViewConfig = {
	id: string;
	title: string;
	iconKey: SourceIconKey;
	predicate: (note: NoteItem) => boolean;
	capabilities: SourceCapabilities;
};

/**
 * Creates a NoteSource backed purely by a predicate over the notes collection.
 * There is no corresponding FolderItem in folderStore — this is a computed view.
 *
 * Examples: Trash (deletedAt != null), Favorites (isFavorite), Tags.
 */
export function createVirtualView(config: VirtualViewConfig): NoteSource {
	return {
		id: config.id,
		kind: 'view' as const,
		title: config.title,
		iconKey: config.iconKey,
		capabilities: config.capabilities,

		getNotes(): NoteItem[] {
			return Array.from(notesStore.notes.values())
				.filter(config.predicate)
				.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
		},

		getCount(): number {
			return notesStore.folderCountIndex.get(config.id) ?? 0;
		},

		getChildren(): string[] {
			return [];
		}
	};
}
