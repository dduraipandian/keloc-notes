import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import NoteItems from '$lib/components/NoteItems.svelte';
import { notesStore } from '$lib/stores/notes.svelte';
import { noteListView } from '$lib/views/noteListView.svelte';
import { noteService, trashService } from '$lib/stores/services';
import { selectionStore } from '$lib/stores/selection.svelte';
import { uiStore } from '$lib/stores/dialog.svelte';
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

describe('NoteItems.svelte Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        
        // Setup notesStore state
        (notesStore as any).notes = new SvelteMap();
        const now = new Date().toISOString();
	        notesStore.notes.set('n1', {
	            id: 'n1',
	            title: 'Note 1',
	            content: 'Content 1',
	            updatedAt: now,
	            folderId: 'f1'
	        });
        
        // Mock noteListView to return our note
        vi.spyOn(noteListView, 'getSections').mockReturnValue([
            ['Today', [{ id: 'n1', title: 'Note 1', content: 'Content 1', updatedAt: now } as any]]
        ]);
        vi.spyOn(noteListView, 'getSelectedFolderTitle').mockReturnValue('My Notes');
    });

    it('should render the note title and content snippet', () => {
        render(NoteItems);
        
        expect(screen.getByText('Note 1')).toBeDefined();
        expect(screen.getByText('Content 1')).toBeDefined();
    });

    it('should focus the correct section header', () => {
        render(NoteItems);
        expect(screen.getByText('Today')).toBeDefined();
    });

    it('should call noteService.select when a note is clicked', async () => {
        render(NoteItems);
        
        const noteItem = screen.getByText('Note 1');
        await fireEvent.click(noteItem);
        
        expect(noteService.select).toHaveBeenCalledWith('n1');
    });

    it('should call noteService.create when the "New Note" button is clicked', async () => {
        // Ensure canCreateNote returns true
        vi.spyOn(noteListView, 'canCreateNote').mockReturnValue(true);
        vi.spyOn(noteListView, 'getCreateNoteFolderId').mockReturnValue('f1');
        
        render(NoteItems);
        
        const createBtn = screen.getByTitle('New Note');
        await fireEvent.click(createBtn);
        
        expect(noteService.create).toHaveBeenCalledWith('f1');
    });
});
