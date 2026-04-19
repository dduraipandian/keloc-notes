import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import NoteItems from '$lib/components/NoteItems.svelte';
import { notesStore } from '$lib/stores/notes.svelte';
import { NoteListView } from '$lib/views/noteListView.svelte';
import { noteService, trashService } from '$lib/stores/services';
import { selectionStore } from '$lib/stores/selection.svelte';
import { uiStore } from '$lib/stores/dialog.svelte';
import { UIStateStore } from '$lib/stores/uiState.svelte';
import { ThemeStore } from '$lib/stores/theme.svelte';
import { STORE_KEYS } from '$lib/stores/context';
import { SvelteMap } from 'svelte/reactivity';

// Mock Lucide icons
vi.mock('@lucide/svelte/icons/search', () => ({ default: vi.fn() }));
vi.mock('@lucide/svelte/icons/star', () => ({ default: vi.fn() }));
vi.mock('@lucide/svelte/icons/trash-2', () => ({ default: vi.fn() }));
vi.mock('@lucide/svelte/icons/square-pen', () => ({ default: vi.fn() }));

// Mock components from UI lib that might use complex logic
vi.mock('$lib/components/ui/input/index.js', () => ({ 
    Input: vi.fn().mockImplementation((props) => {
        // Return a simple input for Vitest/JSDOM
        return { 
            render: () => ({ html: `<input value="${props.value || ''}" placeholder="${props.placeholder || ''}" />` }) 
        };
    }) 
}));

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
        select: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
        setFavorite: vi.fn(),
        getNoteCountForFolder: vi.fn(() => 0)
    },
    trashService: {
        recoverNote: vi.fn(),
        permanentlyDeleteNote: vi.fn()
    }
}));



const mockNoteListViewInstance = {
    getSections: vi.fn(),
    getSelectedFolderTitle: vi.fn(),
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
    NoteListView: vi.fn().mockImplementation(function () {
        return mockNoteListViewInstance;
    })
}));

describe('NoteItems.svelte Component', () => {
    let mockUIStateStore: UIStateStore;
    let mockThemeStore: ThemeStore;

    beforeEach(() => {
        mockUIStateStore = new UIStateStore();
        mockThemeStore = new ThemeStore();
        vi.clearAllMocks();
        
        // Setup notesStore state
        (notesStore as any).notes = new SvelteMap();
        const now = new Date().toISOString();
	        notesStore.notes.set('n1', {
	            id: 'n1',
	            title: 'Note 1',
	            content: 'Content 1',
                summary: 'Summary 1',
	            updatedAt: now,
	            folderId: 'f1',
                isFavorite: false,
                isContentLoaded: true,
                deletedAt: null
	        } as any);
        
        
        // Mock noteListView to return our note
        mockNoteListViewInstance.getSections.mockReturnValue([
            ['Today', [{ id: 'n1', title: 'Note 1', content: 'Content 1', summary: 'Summary 1', updatedAt: now } as any]]
        ]);
        mockNoteListViewInstance.getSelectedFolderTitle.mockReturnValue('My Notes');
    });

    function renderNoteItems() {
        return render(NoteItems, {
            context: new Map<any, any>([
                [STORE_KEYS.UI_STATE, mockUIStateStore],
                [STORE_KEYS.THEME, mockThemeStore]
            ])
        });
    }

    it('should render the note title and summary snippet', () => {
        renderNoteItems();
        
        expect(screen.getByText('Note 1')).toBeDefined();
        expect(screen.getByText('Summary 1')).toBeDefined();
    });

    it('should focus the correct section header', () => {
        renderNoteItems();
        expect(screen.getByText('Today')).toBeDefined();
    });

    it('should call noteService.select when a note is clicked', async () => {
        renderNoteItems();
        
        const noteItem = screen.getByText('Note 1');
        await fireEvent.click(noteItem);
        
        expect(noteService.select).toHaveBeenCalledWith('n1');
        expect(mockUIStateStore.activePane).toBe('notes');
    });

    it('activates the notes pane when empty space is clicked without changing note selection', async () => {
        renderNoteItems();
        mockUIStateStore.setActivePane('folders');

        const pane = screen.getByTestId('notes-pane');
        await fireEvent.click(pane);

        expect(mockUIStateStore.activePane).toBe('notes');
        expect(noteService.select).not.toHaveBeenCalled();
    });

    it('should call noteService.create when the "New Note" button is clicked', async () => {
        // Ensure canCreateNote returns true
        mockNoteListViewInstance.canCreateNote.mockReturnValue(true);
        mockNoteListViewInstance.getCreateNoteFolderId.mockReturnValue('f1');
        
        renderNoteItems();
        
        const createBtn = screen.getByTitle('New Note');
        await fireEvent.click(createBtn);
        
        expect(noteService.create).toHaveBeenCalledWith('f1');
    });
});
