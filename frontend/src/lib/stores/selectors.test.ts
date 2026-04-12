import { describe, expect, it, vi } from 'vitest';
import { FolderSidebarSelector, NoteListSelector } from './selectors';

describe('NoteListSelector', () => {
	it('should expose the selected folder title with a fallback', () => {
		const selector = new NoteListSelector(
			{
				selectedFolderID: 'notes',
				getSelectedFolder: () => ({ id: 'notes', title: 'Notes', url: '#' }),
				folders: new Map()
			} as any,
			{} as any,
			{} as any,
			{} as any
		);

		expect(selector.getSelectedFolderTitle()).toBe('Notes');
	});

	it('should filter notes by the current query', () => {
		const selector = new NoteListSelector(
			{
				selectedFolderID: 'notes',
				getSelectedFolder: () => ({ id: 'notes', title: 'Notes', url: '#', type: 'regular' }),
				folders: new Map()
			} as any,
			{} as any,
			{} as any,
			{
				getNotesForFolder: vi.fn().mockReturnValue([
					{ id: '1', title: 'Alpha', content: 'First', updatedAt: '2025-01-01T00:00:00Z' },
					{ id: '2', title: 'Beta', content: 'Second', updatedAt: '2025-01-02T00:00:00Z' }
				])
			} as any
		);

		expect(selector.getFilteredNotes('alp')).toEqual([
			expect.objectContaining({ id: '1', title: 'Alpha' })
		]);
	});

	it('should compute note restore context from folder hierarchy', () => {
		const selector = new NoteListSelector(
			{} as any,
			{} as any,
			{
				findTopDeletedAncestor: vi.fn().mockReturnValue({ id: 'folder-a' })
			} as any,
			{} as any
		);

		expect(selector.getRestoreContext({ id: 'n1', folderId: 'folder-a' } as any)).toEqual({
			isHierarchical: true,
			topDeletedAncestor: { id: 'folder-a' }
		});
	});

	it('should expose selected note delete context', () => {
		const selector = new NoteListSelector(
			{} as any,
			{
				selectedNoteID: 'n1',
				selectedNote: { id: 'n1', title: 'Selected', deletedAt: null }
			} as any,
			{} as any,
			{} as any
		);

		expect(selector.getSelectedNoteDeleteContext()).toEqual({
			id: 'n1',
			title: 'Selected'
		});
	});
});

describe('FolderSidebarSelector', () => {
	it('should expose root folder items', () => {
		const selector = new FolderSidebarSelector(
			{
				items: ['notes'],
				folders: new Map([['notes', { id: 'notes', title: 'Notes', url: '#' }]])
			} as any,
			{} as any,
			{} as any
		);

		expect(selector.getRootItems()).toEqual([expect.objectContaining({ id: 'notes', title: 'Notes' })]);
	});

	it('should expose trash root ids for the trash folder', () => {
		const selector = new FolderSidebarSelector(
			{ folders: new Map() } as any,
			{ getTrashRootIds: vi.fn().mockReturnValue(['deleted-folder']) } as any,
			{} as any
		);

		expect(
			selector.getVisibleChildIds({ id: 'deleted-notes', title: 'Trash', url: '#', type: 'trash' } as any)
		).toEqual(['deleted-folder']);
	});

	it('should hide deleted children in the regular tree', () => {
		const selector = new FolderSidebarSelector(
			{
				folders: new Map([
					['child-a', { id: 'child-a', title: 'A', url: '#', deletedAt: null }],
					['child-b', { id: 'child-b', title: 'B', url: '#', deletedAt: 123 }]
				])
			} as any,
			{} as any,
			{} as any
		);

		expect(
			selector.getVisibleChildIds({
				id: 'parent',
				title: 'Parent',
				url: '#',
				items: ['child-a', 'child-b']
			} as any)
		).toEqual(['child-a']);
	});

	it('should expose note counts for a folder item', () => {
		const selector = new FolderSidebarSelector(
			{} as any,
			{} as any,
			{ getNoteCountForFolder: vi.fn().mockReturnValue(3) } as any
		);

		expect(selector.getNoteCount({ id: 'notes', title: 'Notes', url: '#', type: 'regular' } as any)).toBe(3);
	});
});
