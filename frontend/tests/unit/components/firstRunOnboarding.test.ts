import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Folders from '$lib/components/Folders.svelte';
import NoteItems from '$lib/components/NoteItems.svelte';
import { FolderStore } from '$lib/stores/folders.svelte';
import { NotesStore } from '$lib/stores/notes.svelte';
import { SelectionStore } from '$lib/stores/selection.svelte';
import { UIStateStore } from '$lib/stores/uiState.svelte';
import { ThemeStore } from '$lib/stores/theme.svelte';
import { UIStore } from '$lib/stores/dialog.svelte';
import { STORE_KEYS } from '$lib/stores/context';
import { FolderSidebarView } from '$lib/views/folderSidebarView.svelte';

vi.mock('@lucide/svelte/icons/chevron-right', () => ({ default: vi.fn() }));
vi.mock('@lucide/svelte/icons/folder-plus', () => ({ default: vi.fn() }));
vi.mock('@lucide/svelte/icons/home', () => ({ default: vi.fn() }));
vi.mock('@lucide/svelte/icons/folder', () => ({ default: vi.fn() }));
vi.mock('@lucide/svelte/icons/star', () => ({ default: vi.fn() }));
vi.mock('@lucide/svelte/icons/trash-2', () => ({ default: vi.fn() }));
vi.mock('@lucide/svelte/icons/sun', () => ({ default: vi.fn() }));
vi.mock('@lucide/svelte/icons/moon', () => ({ default: vi.fn() }));
vi.mock('@lucide/svelte/icons/monitor', () => ({ default: vi.fn() }));
vi.mock('@lucide/svelte/icons/search', () => ({ default: vi.fn() }));
vi.mock('@lucide/svelte/icons/square-pen', () => ({ default: vi.fn() }));

vi.mock('$lib/components/ui/input/index.js', () => ({
	Input: vi.fn().mockImplementation((props) => ({
		render: () => ({ html: `<input value="${props.value || ''}" placeholder="${props.placeholder || ''}" />` })
	}))
}));

const mockFolderService = {
	select: vi.fn(),
	create: vi.fn(),
	rename: vi.fn(),
	cancelRename: vi.fn(),
	toggle: vi.fn(),
	ensurePath: vi.fn()
};

const mockNoteService = {
	select: vi.fn(),
	create: vi.fn(),
	delete: vi.fn(),
	setFavorite: vi.fn(),
	getNoteCountForFolder: vi.fn(() => 0)
};

const mockTrashService = {
	recoverFolder: vi.fn(),
	permanentlyDeleteFolder: vi.fn(),
	emptyTrash: vi.fn(),
	recoverNote: vi.fn(),
	permanentlyDeleteNote: vi.fn()
};

const mockNoteListView = {
	getSections: vi.fn(),
	getSelectedFolderTitle: vi.fn(),
	getEmptyStateTitle: vi.fn(),
	getEmptyStateDescription: vi.fn(),
	getEditorEmptyDescription: vi.fn(),
	canCreateNote: vi.fn(),
	getCreateNoteFolderId: vi.fn(),
	getSelectedFolderProfileId: vi.fn(),
	canDeleteSelectedNote: vi.fn(),
	getSelectedNoteDeleteContext: vi.fn(),
	setSearchQuery: vi.fn(),
	isSelectedNote: vi.fn(),
	getVisibleNoteIds: vi.fn()
};

vi.mock('$lib/views/noteListView.svelte', () => ({
	NoteListView: vi.fn().mockImplementation(() => mockNoteListView)
}));

describe('First-run onboarding copy', () => {
	let folderStore: FolderStore;
	let notesStore: NotesStore;
	let uiStateStore: UIStateStore;
	let themeStore: ThemeStore;
	let uiStore: UIStore;
	let selectionStore: SelectionStore;

	beforeEach(() => {
		folderStore = new FolderStore();
		notesStore = new NotesStore();
		uiStateStore = new UIStateStore();
		themeStore = new ThemeStore();
		uiStore = new UIStore();
		selectionStore = new SelectionStore(folderStore);
		vi.clearAllMocks();

		folderStore.folders.set('home', { id: 'home', title: 'Home', items: [] } as any);
		folderStore.folders.set('favorites', { id: 'favorites', title: 'Favorites', items: [] } as any);
		folderStore.folders.set('trash', { id: 'trash', title: 'Trash', items: [] } as any);

		mockNoteListView.getSections.mockReturnValue([]);
		mockNoteListView.getSelectedFolderTitle.mockReturnValue('Home');
		mockNoteListView.getEmptyStateTitle.mockReturnValue('No notes here yet');
		mockNoteListView.getEmptyStateDescription.mockReturnValue(
			'Start by creating a folder, then create your first note.'
		);
		mockNoteListView.getEditorEmptyDescription.mockReturnValue(
			'Create a folder, add your first note, and it will open here.'
		);
		mockNoteListView.canCreateNote.mockReturnValue(false);
		mockNoteListView.getSelectedFolderProfileId.mockReturnValue('home');
		mockNoteListView.canDeleteSelectedNote.mockReturnValue(false);
		mockNoteListView.getSelectedNoteDeleteContext.mockReturnValue(null);
		mockNoteListView.getVisibleNoteIds.mockReturnValue([]);
	});

	it('shows first-run folder guidance when there are no user folders', () => {
		const view = new FolderSidebarView(
			{ selection: selectionStore, ui: uiStore },
			folderStore,
			mockFolderService as any,
			mockNoteService as any,
			mockTrashService as any
		);

		render(Folders, {
			context: new Map<any, any>([
				[STORE_KEYS.UI_STATE, uiStateStore],
				[STORE_KEYS.THEME, themeStore],
				[STORE_KEYS.UI, uiStore],
				[STORE_KEYS.SELECTION, selectionStore],
				[STORE_KEYS.FOLDERS, folderStore],
				[STORE_KEYS.FOLDER_SERVICE, mockFolderService],
				[STORE_KEYS.NOTE_SERVICE, mockNoteService],
				[STORE_KEYS.TRASH_SERVICE, mockTrashService],
				[STORE_KEYS.FOLDER_SIDEBAR_VIEW, view]
			])
		});

		expect(screen.getByText('Start here')).toBeTruthy();
		expect(screen.getByText('Create your first folder, then add a note inside it.')).toBeTruthy();
	});

	it('shows note-list onboarding guidance when there are no notes', () => {
		render(NoteItems, {
			context: new Map<any, any>([
				[STORE_KEYS.UI_STATE, uiStateStore],
				[STORE_KEYS.THEME, themeStore],
				[STORE_KEYS.UI, uiStore],
				[STORE_KEYS.SELECTION, selectionStore],
				[STORE_KEYS.FOLDERS, folderStore],
				[STORE_KEYS.NOTES, notesStore],
				[STORE_KEYS.NOTE_SERVICE, mockNoteService],
				[STORE_KEYS.TRASH_SERVICE, mockTrashService],
				[STORE_KEYS.NOTE_LIST_VIEW, mockNoteListView]
			])
		});

		expect(screen.getByText('No notes here yet')).toBeTruthy();
		expect(screen.getByText('Start by creating a folder, then create your first note.')).toBeTruthy();
	});
});
