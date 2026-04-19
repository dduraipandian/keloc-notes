import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import NoteItems from '$lib/components/NoteItems.svelte';
import { FolderStore } from '$lib/stores/folders.svelte';
import { NotesStore } from '$lib/stores/notes.svelte';
import { UIStateStore } from '$lib/stores/uiState.svelte';
import { ThemeStore } from '$lib/stores/theme.svelte';
import { SelectionStore } from '$lib/stores/selection.svelte';
import { UIStore } from '$lib/stores/dialog.svelte';
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
const mockNoteService = {
    select: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    setFavorite: vi.fn(),
    getNoteCountForFolder: vi.fn(() => 0)
};

const mockTrashService = {
    recoverNote: vi.fn(),
    permanentlyDeleteNote: vi.fn()
};



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
    let mockUIStore: UIStore;
    let mockSelectionStore: SelectionStore;
    let mockFolderStore: FolderStore;
    let mockNotesStore: NotesStore;

    beforeEach(() => {
        mockUIStateStore = new UIStateStore();
        mockThemeStore = new ThemeStore();
        mockUIStore = new UIStore();
        mockSelectionStore = new SelectionStore();
        mockFolderStore = new FolderStore();
        mockNotesStore = new NotesStore(mockFolderStore, mockSelectionStore);
        vi.clearAllMocks();
        
        // Setup notesStore state
        (mockNotesStore as any).notes = new SvelteMap();
        const now = new Date().toISOString();
	        mockNotesStore.notes.set('n1', {
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
                [STORE_KEYS.THEME, mockThemeStore],
                [STORE_KEYS.UI, mockUIStore],
                [STORE_KEYS.SELECTION, mockSelectionStore],
                [STORE_KEYS.FOLDERS, mockFolderStore],
                [STORE_KEYS.NOTES, mockNotesStore],
                [STORE_KEYS.NOTE_SERVICE, mockNoteService],
                [STORE_KEYS.TRASH_SERVICE, mockTrashService],
                [STORE_KEYS.NOTE_LIST_VIEW, mockNoteListViewInstance]
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
        
        expect(mockNoteService.select).toHaveBeenCalledWith('n1');
        expect(mockUIStateStore.activePane).toBe('notes');
    });

    it('activates the notes pane when empty space is clicked without changing note selection', async () => {
        renderNoteItems();
        mockUIStateStore.setActivePane('folders');

        const pane = screen.getByTestId('notes-pane');
        await fireEvent.click(pane);

        expect(mockUIStateStore.activePane).toBe('notes');
        expect(mockNoteService.select).not.toHaveBeenCalled();
    });

    it('should call noteService.create when the "New Note" button is clicked', async () => {
        // Ensure canCreateNote returns true
        mockNoteListViewInstance.canCreateNote.mockReturnValue(true);
        mockNoteListViewInstance.getCreateNoteFolderId.mockReturnValue('f1');
        
        renderNoteItems();
        
        const createBtn = screen.getByTitle('New Note');
        await fireEvent.click(createBtn);
        
        expect(mockNoteService.create).toHaveBeenCalledWith('f1');
    });
});
