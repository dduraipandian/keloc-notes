import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NoteListView } from '../../../src/lib/views/noteListView.svelte';

const NOW = new Date().toISOString();

describe('NoteListView', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	const mockSearch = { 
		ensureFolderIndexed: vi.fn(), 
		version: 0, 
		search: vi.fn().mockReturnValue([]) 
	};

	it('should expose the selected folder title with a fallback', () => {
		const selector = new NoteListView(
			{ 
				selection: {
					selectedFolderID: 'notes',
					getSelectedFolder: () => ({ id: 'notes', title: 'Notes' })
				} as any
			},
			{ folders: new Map() } as any,
			{ getNote: () => null, listNotes: () => [] } as any,
			{} as any,
			{} as any,
			mockSearch as any
		);

		expect(selector.getSelectedFolderTitle()).toBe('Notes');
	});

	it('should filter notes by the current query after debounce', async () => {
		const mockNotes = [
			{ id: '1', title: 'Alpha', content: 'First', updatedAt: NOW, summary: '', isFavorite: false, isContentLoaded: true, deletedAt: null },
			{ id: '2', title: 'Beta', content: 'Second', updatedAt: NOW, summary: '', isFavorite: false, isContentLoaded: true, deletedAt: null }
		];
		const selector = new NoteListView(
			{ 
				selection: { selectedFolderID: 'f1', getSelectedFolder: vi.fn() } as any
			},
			{ folders: new Map() } as any,
			{ getNote: (id: string) => mockNotes.find(n => n.id === id), listNotes: () => mockNotes } as any,
			{} as any,
			{
				getNotesForFolder: vi.fn().mockReturnValue(mockNotes)
			} as any,
			mockSearch as any
		);

		selector.setSearchQuery('alpha');
		await vi.advanceTimersByTimeAsync(150);
		const notes = selector.getFilteredNotes();
		expect(notes).toHaveLength(1);
		expect(notes[0].title).toBe('Alpha');
	});

	it('should get context for deleting the selected note', () => {
		const mockNote = { id: 'n1', title: 'Note 1', deletedAt: null, updatedAt: NOW };
		const selector = new NoteListView(
			{ selection: {} as any },
			{} as any,
			{ selectedNote: mockNote, selectedNoteID: 'n1' } as any,
			{} as any,
			{} as any,
			mockSearch as any
		);

		const context = selector.getSelectedNoteDeleteContext();
		expect(context).toEqual({ id: 'n1', title: 'Note 1' });
	});

	it('should provide visible note IDs', () => {
		const mockNotes = [
			{ id: '1', title: 'A', updatedAt: NOW },
			{ id: '2', title: 'B', updatedAt: NOW }
		];
		const selector = new NoteListView(
			{
				selection: { selectedFolderID: 'f1', getSelectedFolder: vi.fn() } as any
			},
			{ folders: new Map() } as any,
			{ getNote: (id: string) => mockNotes.find(n => n.id === id), listNotes: () => mockNotes } as any,
			{} as any,
			{
				getNotesForFolder: vi.fn().mockReturnValue(mockNotes)
			} as any,
			mockSearch as any
		);

		expect(selector.getVisibleNoteIds()).toEqual(['1', '2']);
	});

	it('should get restore context for a note', () => {
		const selector = new NoteListView(
			{ selection: {} as any },
			{ 
				findItemById: vi.fn().mockReturnValue({ id: 'f1', title: 'Work', deletedAt: null }) 
			} as any,
			{} as any,
			{} as any,
			{} as any,
			mockSearch as any
		);

		const context = selector.getRestoreContext({ id: 'n1', folderId: 'f1' } as any);
		expect(context.targetName).toBe('Work');
	});

	it('should fallback to Home if parent folder is deleted in restore context', () => {
		const selector = new NoteListView(
			{ selection: {} as any },
			{ 
				findItemById: vi.fn().mockReturnValue({ id: 'f1', title: 'Old Folder', deletedAt: 12345 }) 
			} as any,
			{} as any,
			{} as any,
			{} as any,
			mockSearch as any
		);

		const context = selector.getRestoreContext({ id: 'n1', folderId: 'f1' } as any);
		expect(context.targetName).toBe('Home');
	});
});
