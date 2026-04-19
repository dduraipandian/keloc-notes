import { getContext, setContext } from 'svelte';
import type { ThemeStore } from './theme.svelte';
import type { UIStateStore } from './uiState.svelte';
import type { UIStore } from './dialog.svelte';
import type { SelectionStore } from './selection.svelte';
import type { FolderStore } from './folders.svelte';
import type { NotesStore } from './notes.svelte';
import type { PreferencesStore } from './preferences.svelte';

export const STORE_KEYS = {
	THEME: Symbol('themeStore'),
	UI_STATE: Symbol('uiStateStore'),
	UI: Symbol('uiStore'),
	SELECTION: Symbol('selectionStore'),
	FOLDERS: Symbol('folderStore'),
	NOTES: Symbol('notesStore'),
	PREFERENCES: Symbol('preferencesStore')
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
