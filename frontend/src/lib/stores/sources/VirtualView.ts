import type { NoteItem } from '../notes.svelte';
import { notesStore } from '../notes.svelte';
import type { NoteSource, SidebarSectionID, SourceCapabilities, SourceIconKey } from './types';

export type VirtualViewConfig = {
	id: string;
	title: string;
	iconKey: SourceIconKey;
	section?: SidebarSectionID;
	predicate: (note: NoteItem) => boolean;
	capabilities: SourceCapabilities;
	getChildren?: () => string[];
};

export function createVirtualView(config: VirtualViewConfig): NoteSource {
	return {
		id: config.id,
		kind: 'view',
		section: config.section ?? 'views',
		title: config.title,
		iconKey: config.iconKey,
		capabilities: config.capabilities,
		getNotes() {
			return Array.from(notesStore.notes.values())
				.filter(config.predicate)
				.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
		},
		getCount() {
			return this.getNotes().length;
		},
		getChildren() {
			return config.getChildren?.() ?? [];
		}
	};
}
