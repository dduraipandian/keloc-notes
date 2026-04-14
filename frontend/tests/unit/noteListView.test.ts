import { describe, expect, it, vi } from 'vitest';
import { NoteListView } from '../../src/lib/views/noteListView.svelte';

describe('NoteListView', () => {
	it('should expose the selected folder title with a fallback', () => {
		const selector = new NoteListView(
			{ folders: new Map() } as any,
			{} as any,
			{} as any,
			{} as any,
			{
				selectedFolderID: 'notes',
				getSelectedFolder: () => ({ id: 'notes', title: 'Notes', url: '#' })
			} as any
		);

		expect(selector.getSelectedFolderTitle()).toBe('Notes');
	});

	it('should filter notes by the current query', () => {
		const selector = new NoteListView(
			{ folders: new Map() } as any,
			{} as any,
			{} as any,
			{
				getNotesForFolder: vi.fn().mockReturnValue([
					{ id: '1', title: 'Alpha', content: 'First', updatedAt: '2025-01-01T00:00:00Z' },
					{ id: '2', title: 'Beta', content: 'Second', updatedAt: '2025-01-02T00:00:00Z' }
				])
			} as any,
			{ selectedFolderID: 'f1', getSelectedFolder: vi.fn() } as any
		);

		const notes = selector.getFilteredNotes('alpha');
		expect(notes).toHaveLength(1);
		expect(notes[0].title).toBe('Alpha');
	});

	it('should get context for deleting the selected note', () => {
		const selector = new NoteListView(
			{} as any,
			{
				selectedNoteID: '123',
				selectedNote: { id: '123', title: 'Note', deletedAt: null }
			} as any,
			{} as any,
			{} as any,
			{} as any
		);
		expect(selector.getSelectedNoteDeleteContext()).toEqual({
			id: '123',
			title: 'Note'
		});
	});

	it('should check if a note is selected', () => {
		const selector = new NoteListView(
			{} as any,
			{ selectedNoteID: '123' } as any,
			{} as any,
			{} as any,
			{} as any
		);
		expect(selector.isSelectedNote('123')).toBe(true);
		expect(selector.isSelectedNote('456')).toBe(false);
	});

	it('should provide note sections grouped by date', () => {
		const selector = new NoteListView(
			{} as any,
			{} as any,
			{} as any,
			{
				getNotesForFolder: vi.fn().mockReturnValue([
					{ id: '1', title: 'A', content: '', updatedAt: '2025-01-01T00:00:00Z' },
					{ id: '2', title: 'B', content: '', updatedAt: '2025-01-01T12:00:00Z' }
				])
			} as any,
			{ selectedFolderID: 'f1', getSelectedFolder: vi.fn() } as any
		);
		const sections = selector.getSections('');
		expect(sections).toHaveLength(1);
		const [label, notes] = sections[0];
		expect(label).toBeDefined();
		expect(notes).toHaveLength(2);
	});

	it('should expose restore context for a note with target information', () => {
		const mockFolders = { findItemById: vi.fn() };
		const selector = new NoteListView(mockFolders as any, {} as any, {} as any, {} as any, {} as any);

		const note = { id: 'n1', folderId: 'f1' } as any;
		mockFolders.findItemById.mockReturnValue({ id: 'f1', title: 'ParentFolder', deletedAt: null });

		const context = selector.getRestoreContext(note);
		expect(context.isHierarchical).toBe(false);
		expect(context.targetName).toBe('ParentFolder');
	});

	it('should target Home when the original folder is deleted', () => {
		const mockFolders = { findItemById: vi.fn() };
		const selector = new NoteListView(mockFolders as any, {} as any, {} as any, {} as any, {} as any);

		const note = { id: 'n1', folderId: 'f1' } as any;
		mockFolders.findItemById.mockReturnValue({ id: 'f1', title: 'DeletedFolder', deletedAt: 12345 });

		const context = selector.getRestoreContext(note);
		expect(context.targetName).toBe('Home');
	});

	it('should determine if a note can be created in the current folder', () => {
		const selector = new NoteListView(
			{} as any,
			{} as any,
			{} as any,
			{} as any,
			{ getSelectedFolder: () => ({ profile: 'regular' }) } as any
		);
		expect(selector.canCreateNote()).toBe(true);

		const trashSelector = new NoteListView(
			{} as any,
			{} as any,
			{} as any,
			{} as any,
			{ getSelectedFolder: () => ({ profile: 'trash' }) } as any
		);
		expect(trashSelector.canCreateNote()).toBe(false);
	});
});
