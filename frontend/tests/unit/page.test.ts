import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import Page from '../../src/routes/+page.svelte';
import { notesStore } from '../../src/lib/stores/notes.svelte';
import { UIStateStore } from '../../src/lib/stores/uiState.svelte';
import { ThemeStore } from '../../src/lib/stores/theme.svelte';
import { STORE_KEYS } from '../../src/lib/stores/context';
import { SvelteMap } from 'svelte/reactivity';

vi.mock('../../src/lib/stores/services', () => ({
	folderService: {
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
		delete: vi.fn()
	},
	noteService: {
		update: vi.fn(),
		select: vi.fn(),
		create: vi.fn(),
		delete: vi.fn(),
		setFavorite: vi.fn()
	},
	trashService: {
		recoverNote: vi.fn()
	}
}));

vi.mock('../../src/routes/alert.svelte', () => ({
	default: vi.fn()
}));

vi.mock('../../src/lib/components/ui/button/index.js', () => ({
	Button: vi.fn()
}));

describe('+page.svelte', () => {
	let mockUIStateStore: UIStateStore;
	let mockThemeStore: ThemeStore;

	beforeEach(() => {
		mockUIStateStore = new UIStateStore();
		mockThemeStore = new ThemeStore();
		vi.clearAllMocks();
		(notesStore as any).notes = new SvelteMap();
		(notesStore as any).selectedNoteID = null;
	});

	function renderPage(props = {}) {
		return render(Page, {
			props,
			context: new Map<any, any>([
				[STORE_KEYS.UI_STATE, mockUIStateStore],
				[STORE_KEYS.THEME, mockThemeStore]
			])
		});
	}

	it('activates the editor pane when the title field is clicked', async () => {
		const now = new Date().toISOString();
		notesStore.notes.set('n1', {
			id: 'n1',
			title: 'Note 1',
			content: 'Content 1',
			updatedAt: now,
			folderId: 'f1'
		} as any);
		(notesStore as any).selectedNoteID = 'n1';

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
