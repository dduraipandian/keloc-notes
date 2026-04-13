import { folderStore } from '../folders.svelte';
import { createFolderSource } from './FolderSource';
import { builtinViews, protectedFolderViewCapabilities } from './builtinViews';
import { PROTECTED_NOTES_FOLDER_ID } from './constants';
import type { NoteSource, SidebarSectionID } from './types';

type BuiltinSourceFactory = {
	id: string;
	section: SidebarSectionID;
	create(): NoteSource | null;
};

const builtinSourceFactories: BuiltinSourceFactory[] = [
	{
		id: PROTECTED_NOTES_FOLDER_ID,
		section: 'views',
		create() {
			return folderStore.folders.has(PROTECTED_NOTES_FOLDER_ID)
				? createFolderSource(PROTECTED_NOTES_FOLDER_ID, {
						section: 'views',
						capabilities: protectedFolderViewCapabilities
					})
				: null;
		}
	},
	...builtinViews.map((view) => ({
		id: view.id,
		section: view.section,
		create() {
			return view;
		}
	}))
];

export function getSource(id: string): NoteSource | null {
	const builtin = builtinSourceFactories.find((entry) => entry.id === id)?.create();
	if (builtin) return builtin;

	if (folderStore.folders.has(id)) {
		return createFolderSource(id);
	}

	return null;
}

export function listPinnedSources(): NoteSource[] {
	return listSidebarSectionSources('views');
}

export function listVirtualViews(): NoteSource[] {
	return builtinViews;
}

export function listRootFolderSources(): NoteSource[] {
	return listSidebarSectionSources('folders');
}

export function listSidebarSectionSources(section: SidebarSectionID): NoteSource[] {
	const sources: NoteSource[] = [];

	for (const entry of builtinSourceFactories) {
		if (entry.section !== section) continue;
		const source = entry.create();
		if (source) {
			sources.push(source);
		}
	}

	if (section !== 'folders') {
		return sources;
	}

	for (const id of folderStore.items) {
		if (id === PROTECTED_NOTES_FOLDER_ID) continue;
		const folder = folderStore.folders.get(id);
		if (
			!folder ||
			folder.deletedAt != null ||
			folder.type === 'system' ||
			folder.type === 'trash'
		) {
			continue;
		}
		sources.push(createFolderSource(id));
	}

	return sources;
}
