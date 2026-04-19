import { getContext, setContext } from 'svelte';
import type { ThemeStore } from './theme.svelte';
import type { UIStateStore } from './uiState.svelte';
import type { UIStore } from './dialog.svelte';
import type { SelectionStore } from './selection.svelte';
import type { FolderStore } from './folders.svelte';
import type { NotesStore } from './notes.svelte';
import type { PreferencesStore } from './preferences.svelte';
import type { FolderService, NoteService, TrashService, SearchService } from './services';
import type { FolderSidebarView } from '$lib/views/folderSidebarView.svelte';
import type { NoteListView } from '$lib/views/noteListView.svelte';

export const STORE_KEYS = {
	THEME: Symbol('themeStore'),
	UI_STATE: Symbol('uiStateStore'),
	UI: Symbol('uiStore'),
	SELECTION: Symbol('selectionStore'),
	FOLDERS: Symbol('folderStore'),
	NOTES: Symbol('notesStore'),
	PREFERENCES: Symbol('preferencesStore'),
	FOLDER_SERVICE: Symbol('folderService'),
	NOTE_SERVICE: Symbol('noteService'),
	TRASH_SERVICE: Symbol('trashService'),
	SEARCH_SERVICE: Symbol('searchService'),
	FOLDER_SIDEBAR_VIEW: Symbol('folderSidebarView'),
	NOTE_LIST_VIEW: Symbol('noteListView')
} as const;

// Helper functions for type-safe context access
export function setThemeStore(store: ThemeStore) { setContext(STORE_KEYS.THEME, store); }
export function getThemeStore() { return getContext<ThemeStore>(STORE_KEYS.THEME); }

export function setUIStateStore(store: UIStateStore) { setContext(STORE_KEYS.UI_STATE, store); }
export function getUIStateStore() { return getContext<UIStateStore>(STORE_KEYS.UI_STATE); }

export function setUIStore(store: UIStore) { setContext(STORE_KEYS.UI, store); }
export function getUIStore() { return getContext<UIStore>(STORE_KEYS.UI); }

export function setSelectionStore(store: SelectionStore) { setContext(STORE_KEYS.SELECTION, store); }
export function getSelectionStore() { return getContext<SelectionStore>(STORE_KEYS.SELECTION); }

export function setFolderStore(store: FolderStore) { setContext(STORE_KEYS.FOLDERS, store); }
export function getFolderStore() { return getContext<FolderStore>(STORE_KEYS.FOLDERS); }

export function setNotesStore(store: NotesStore) { setContext(STORE_KEYS.NOTES, store); }
export function getNotesStore() { return getContext<NotesStore>(STORE_KEYS.NOTES); }

export function setPreferencesStore(store: PreferencesStore) { setContext(STORE_KEYS.PREFERENCES, store); }
export function getPreferencesStore() { return getContext<PreferencesStore>(STORE_KEYS.PREFERENCES); }

export function setFolderService(service: FolderService) { setContext(STORE_KEYS.FOLDER_SERVICE, service); }
export function getFolderService() { return getContext<FolderService>(STORE_KEYS.FOLDER_SERVICE); }

export function setNoteService(service: NoteService) { setContext(STORE_KEYS.NOTE_SERVICE, service); }
export function getNoteService() { return getContext<NoteService>(STORE_KEYS.NOTE_SERVICE); }

export function setTrashService(service: TrashService) { setContext(STORE_KEYS.TRASH_SERVICE, service); }
export function getTrashService() { return getContext<TrashService>(STORE_KEYS.TRASH_SERVICE); }

export function setSearchService(service: SearchService) { setContext(STORE_KEYS.SEARCH_SERVICE, service); }
export function getSearchService() { return getContext<SearchService>(STORE_KEYS.SEARCH_SERVICE); }

export function setFolderSidebarView(view: FolderSidebarView) { setContext(STORE_KEYS.FOLDER_SIDEBAR_VIEW, view); }
export function getFolderSidebarView() { return getContext<FolderSidebarView>(STORE_KEYS.FOLDER_SIDEBAR_VIEW); }

export function setNoteListView(view: NoteListView) { setContext(STORE_KEYS.NOTE_LIST_VIEW, view); }
export function getNoteListView() { return getContext<NoteListView>(STORE_KEYS.NOTE_LIST_VIEW); }
