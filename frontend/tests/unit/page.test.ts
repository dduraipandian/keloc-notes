import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import Page from '../../src/routes/+page.svelte';
import { NotesStore } from '../../src/lib/stores/notes.svelte';
import { FolderStore } from '../../src/lib/stores/folders.svelte';
import { UIStateStore } from '../../src/lib/stores/uiState.svelte';
import { ThemeStore } from '../../src/lib/stores/theme.svelte';
import { STORE_KEYS } from '../../src/lib/stores/context';
import { SelectionStore } from '../../src/lib/stores/selection.svelte';
import { UIStore } from '../../src/lib/stores/dialog.svelte';
import { SvelteMap } from 'svelte/reactivity';

const mockFolderService = {
	getFolderPath: vi.fn(),
	collectFolderSubtree: vi.fn(),
	getTrashRootIds: vi.fn(),
	getFavoriteFolderIds: vi.fn(),
	getHomeFolderChildIds: vi.fn(),
	setFavorite: vi.fn(),
	create: vi.fn(),
	select: vi.fn(),
	startRename: vi.fn(),
	cancelRename: vi.fn(),
	rename: vi.fn(),
	toggle: vi.fn(),
	delete: vi.fn(),
    ensurePath: vi.fn()
};

const mockNoteService = {
	update: vi.fn(),
	select: vi.fn(),
	create: vi.fn(),
	delete: vi.fn(),
	setFavorite: vi.fn()
};

const mockTrashService = {
	recoverNote: vi.fn()
};

vi.mock('../../src/routes/alert.svelte', () => ({
	default: vi.fn()
}));

vi.mock('../../src/lib/components/ui/button/index.js', () => ({
	Button: vi.fn()
}));

describe('+page.svelte', () => {
	let mockUIStateStore: UIStateStore;
	let mockThemeStore: ThemeStore;
	let mockUIStore: UIStore;
	let mockSelectionStore: SelectionStore;
    let mockNotesStore: NotesStore;
    let mockFolderStore: FolderStore;

	beforeEach(() => {
		vi.clearAllMocks();
		mockUIStateStore = new UIStateStore();
		mockThemeStore = new ThemeStore();
		mockUIStore = new UIStore();
        mockFolderStore = new FolderStore();
		mockSelectionStore = new SelectionStore(mockFolderStore);
        mockNotesStore = new NotesStore(mockFolderStore, mockSelectionStore);

		(mockNotesStore as any).notes = new SvelteMap();
		(mockNotesStore as any).selectedNoteID = null;
        (mockNotesStore as any).isInitialized = true;
	});

	function renderPage(props = {}) {
		return render(Page, {
			props,
			context: new Map<any, any>([
				[STORE_KEYS.UI_STATE, mockUIStateStore],
				[STORE_KEYS.THEME, mockThemeStore],
				[STORE_KEYS.UI, mockUIStore],
				[STORE_KEYS.SELECTION, mockSelectionStore],
                [STORE_KEYS.FOLDERS, mockFolderStore],
                [STORE_KEYS.NOTES, mockNotesStore],
				[STORE_KEYS.NOTE_SERVICE, mockNoteService],
				[STORE_KEYS.TRASH_SERVICE, mockTrashService]
			])
		});
	}

	it('activates the editor pane when the title field is clicked', async () => {
		const now = new Date().toISOString();
		mockNotesStore.notes.set('n1', {
			id: 'n1',
			title: 'Note 1',
			content: 'Content 1',
			updatedAt: now,
			folderId: 'f1'
		} as any);
		mockNotesStore.selectedNoteID = 'n1';

		renderPage();
		mockUIStateStore.setActivePane('notes');

		const titleInput = screen.getByPlaceholderText('Note Title');
		await fireEvent.click(titleInput);

		expect(mockUIStateStore.activePane).toBe('editor');
	});

	it('activates the editor pane when editor empty space is clicked', async () => {
		renderPage();
		mockUIStateStore.setActivePane('folders');

		const pane = screen.getByTestId('editor-pane');
		await fireEvent.click(pane);

		expect(mockUIStateStore.activePane).toBe('editor');
	});
});
