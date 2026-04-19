import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import Folders from '$lib/components/Folders.svelte';
import { FolderStore } from '$lib/stores/folders.svelte';
import { UIStateStore } from '$lib/stores/uiState.svelte';
import { ThemeStore } from '$lib/stores/theme.svelte';
import { SelectionStore } from '$lib/stores/selection.svelte';
import { UIStore } from '$lib/stores/dialog.svelte';
import { STORE_KEYS } from '$lib/stores/context';
import { SvelteMap } from 'svelte/reactivity';
import { FolderSidebarView } from '$lib/views/folderSidebarView.svelte';
import type { FolderItem } from '$lib/stores/folders.svelte';

// Mock Lucide icons to avoid rendering complexities in unit tests
vi.mock('@lucide/svelte/icons/chevron-right', () => ({ default: vi.fn() }));
vi.mock('@lucide/svelte/icons/folder-plus', () => ({ default: vi.fn() }));
vi.mock('@lucide/svelte/icons/home', () => ({ default: vi.fn() }));
vi.mock('@lucide/svelte/icons/folder', () => ({ default: vi.fn() }));
vi.mock('@lucide/svelte/icons/star', () => ({ default: vi.fn() }));
vi.mock('@lucide/svelte/icons/trash-2', () => ({ default: vi.fn() }));
vi.mock('@lucide/svelte/icons/sun', () => ({ default: vi.fn() }));
vi.mock('@lucide/svelte/icons/moon', () => ({ default: vi.fn() }));
vi.mock('@lucide/svelte/icons/monitor', () => ({ default: vi.fn() }));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

const mockFolderService = {
    select: vi.fn(),
    create: vi.fn(),
    rename: vi.fn(),
    cancelRename: vi.fn(),
    toggle: vi.fn(),
    ensurePath: vi.fn()
};

const mockNoteService = {
    getNoteCountForFolder: vi.fn(() => 0)
};

const mockTrashService = {
    recoverFolder: vi.fn(),
    permanentlyDeleteFolder: vi.fn(),
    emptyTrash: vi.fn()
};

describe('Folders.svelte Component', () => {
    let mockUIStateStore: UIStateStore;
    let mockThemeStore: ThemeStore;
    let mockUIStore: UIStore;
    let mockSelectionStore: SelectionStore;
    let mockFolderStore: FolderStore;

    beforeEach(() => {
        mockUIStateStore = new UIStateStore();
        mockThemeStore = new ThemeStore();
        mockUIStore = new UIStore();
        mockFolderStore = new FolderStore();
        mockSelectionStore = new SelectionStore(mockFolderStore);
        vi.clearAllMocks();
        
        // Setup folderStore state
        (mockFolderStore as any).folders = new SvelteMap();
        (mockFolderStore as any).items = ['f1'];
        (mockFolderStore as any).editingTitle = '';
        (mockFolderStore as any).rejectedRename = null;
        mockFolderStore.folders.set('f1', {
            id: 'f1',
            title: 'My Notes',
            items: [],
            parentId: null
        });
        
        // Add system views to store so sidebarView can find them
        mockFolderStore.folders.set('home', { id: 'home', title: 'Home', items: [] });
        mockFolderStore.folders.set('favorites', { id: 'favorites', title: 'Favorites', items: [] });
        mockFolderStore.folders.set('trash', { id: 'trash', title: 'Trash', items: [] });
    });

    function renderFolders() {
        const view = new FolderSidebarView(
            { selection: mockSelectionStore, ui: mockUIStore },
            mockFolderStore,
            mockFolderService as any,
            mockNoteService as any,
            mockTrashService as any
        );

        return render(Folders, {
            context: new Map<any, any>([
                [STORE_KEYS.UI_STATE, mockUIStateStore],
                [STORE_KEYS.THEME, mockThemeStore],
                [STORE_KEYS.UI, mockUIStore],
                [STORE_KEYS.SELECTION, mockSelectionStore],
                [STORE_KEYS.FOLDERS, mockFolderStore],
                [STORE_KEYS.FOLDER_SERVICE, mockFolderService],
                [STORE_KEYS.NOTE_SERVICE, mockNoteService],
                [STORE_KEYS.TRASH_SERVICE, mockTrashService],
                [STORE_KEYS.FOLDER_SIDEBAR_VIEW, view]
            ])
        });
    }

    it('should render folder names from the store', () => {
        renderFolders();
        
        expect(screen.getByText('Home')).toBeDefined();
        expect(screen.getByText('My Notes')).toBeDefined();
    });

    it('should call folderService.select when a folder is clicked', async () => {
        renderFolders();
        
        const folderItem = screen.getByText('My Notes');
        await fireEvent.click(folderItem);
        
        expect(mockFolderService.select).toHaveBeenCalledWith('f1');
        expect(mockUIStateStore.activePane).toBe('folders');
    });

    it('activates the folders pane when empty space is clicked without changing selection', async () => {
        renderFolders();
        mockUIStateStore.setActivePane('notes');
        await tick();

        const pane = screen.getByTestId('folders-pane');
        await fireEvent.click(pane);

        expect(mockUIStateStore.activePane).toBe('folders');
        expect(mockFolderService.select).not.toHaveBeenCalled();
    });

    it('should call folderService.create when "New Folder" is clicked', async () => {
        renderFolders();
        
        const newFolderBtn = screen.getByText('New Folder');
        await fireEvent.click(newFolderBtn);
        
        expect(mockFolderService.create).toHaveBeenCalled();
    });

    it('should render an input field when a folder is in editing mode', () => {
        // Set editing mode in store
        (mockFolderStore as any).editingId = 'f1';
        (mockFolderStore as any).editingTitle = 'My Notes';
        
        renderFolders();
        
        const input = screen.getByDisplayValue('My Notes');
        expect(input).toBeDefined();
        expect(input.tagName).toBe('INPUT');
    });
});
