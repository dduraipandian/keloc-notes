import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import Folders from '$lib/components/Folders.svelte';
import { folderStore } from '$lib/stores/folders.svelte';
import { folderSidebarView } from '$lib/views/folderSidebarView.svelte';
import { folderService } from '$lib/stores/services';
import { SvelteMap } from 'svelte/reactivity';

// Mock Lucide icons to avoid rendering complexities in unit tests
vi.mock('@lucide/svelte/icons/chevron-right', () => ({ default: vi.fn() }));
vi.mock('@lucide/svelte/icons/folder-plus', () => ({ default: vi.fn() }));
vi.mock('@lucide/svelte/icons/home', () => ({ default: vi.fn() }));
vi.mock('@lucide/svelte/icons/folder', () => ({ default: vi.fn() }));
vi.mock('@lucide/svelte/icons/star', () => ({ default: vi.fn() }));
vi.mock('@lucide/svelte/icons/trash-2', () => ({ default: vi.fn() }));

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
        
        // Setup folderStore state
        (folderStore as any).folders = new SvelteMap();
        (folderStore as any).items = ['f1'];
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
        
        render(Folders);
        
        const input = screen.getByDisplayValue('My Notes');
        expect(input).toBeDefined();
        expect(input.tagName).toBe('INPUT');
    });
});
