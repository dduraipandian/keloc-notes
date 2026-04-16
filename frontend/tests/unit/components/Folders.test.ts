import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import Folders from '$lib/components/Folders.svelte';
import { folderStore } from '$lib/stores/folders.svelte';
import { folderSidebarView } from '$lib/views/folderSidebarView.svelte';
import { folderService } from '$lib/stores/services';
import { uiStateStore } from '$lib/stores/uiState.svelte';
import { SvelteMap } from 'svelte/reactivity';

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

// Mock services
vi.mock('$lib/stores/services', () => ({
    folderService: {
        select: vi.fn(),
        create: vi.fn(),
        rename: vi.fn(),
        cancelRename: vi.fn(),
        toggle: vi.fn()
    },
    noteService: {
        getNoteCountForFolder: vi.fn(() => 0)
    },
    trashService: {
        recoverFolder: vi.fn(),
        permanentlyDeleteFolder: vi.fn(),
        emptyTrash: vi.fn()
    }
}));

describe('Folders.svelte Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        uiStateStore.__resetForTest();
        
        // Setup folderStore state
        (folderStore as any).folders = new SvelteMap();
        (folderStore as any).items = ['f1'];
        (folderStore as any).editingTitle = '';
        (folderStore as any).rejectedRename = null;
        folderStore.folders.set('f1', {
            id: 'f1',
            title: 'My Notes',
            items: [],
            parentId: null
        });
        
        // Add system views to store so sidebarView can find them
        folderStore.folders.set('home', { id: 'home', title: 'Home', items: [] });
        folderStore.folders.set('favorites', { id: 'favorites', title: 'Favorites', items: [] });
        folderStore.folders.set('trash', { id: 'trash', title: 'Trash', items: [] });
    });

    it('should render folder names from the store', () => {
        render(Folders);
        
        expect(screen.getByText('Home')).toBeDefined();
        expect(screen.getByText('My Notes')).toBeDefined();
    });

    it('should call folderService.select when a folder is clicked', async () => {
        render(Folders);
        
        const folderItem = screen.getByText('My Notes');
        await fireEvent.click(folderItem);
        
        expect(folderService.select).toHaveBeenCalledWith('f1');
        expect(uiStateStore.activePane).toBe('folders');
    });

    it('activates the folders pane when empty space is clicked without changing selection', async () => {
        render(Folders);
        uiStateStore.setActivePane('notes');
        await tick();

        const pane = screen.getByTestId('folders-pane');
        await fireEvent.click(pane);

        expect(uiStateStore.activePane).toBe('folders');
        expect(folderService.select).not.toHaveBeenCalled();
    });

    it('should call folderService.create when "New Folder" is clicked', async () => {
        render(Folders);
        
        const newFolderBtn = screen.getByText('New Folder');
        await fireEvent.click(newFolderBtn);
        
        expect(folderService.create).toHaveBeenCalled();
    });

    it('should render an input field when a folder is in editing mode', () => {
        // Set editing mode in store
        (folderStore as any).editingId = 'f1';
        (folderStore as any).editingTitle = 'My Notes';
        
        render(Folders);
        
        const input = screen.getByDisplayValue('My Notes');
        expect(input).toBeDefined();
        expect(input.tagName).toBe('INPUT');
    });
});
