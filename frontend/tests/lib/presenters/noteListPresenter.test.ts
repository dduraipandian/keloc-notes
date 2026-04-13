import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NoteListPresenter } from '$lib/presenters/noteListPresenter';

vi.mock('$lib/stores/repositories', () => ({
	foldersRepository: {
		list: vi.fn(),
		save: vi.fn()
	},
	notesRepository: {
		list: vi.fn(),
		save: vi.fn()
	},
	settingsRepository: {
		getAll: vi.fn(),
		save: vi.fn()
	},
	trashRepository: {
		permanentlyDeleteFolderTree: vi.fn(),
		permanentlyDeleteNote: vi.fn()
	}
}));

describe('NoteListPresenter', () => {
	it('should expose the selected folder title with a fallback', () => {
		const presenter = new NoteListPresenter(
			{ folders: new Map() } as any,
			{} as any,
			{} as any,
			{} as any,
			{
				selectedFolderID: 'notes',
				getSelectedFolder: () => ({ id: 'notes', title: 'Notes', url: '#' })
			} as any
		);

		expect(presenter.getSelectedFolderTitle()).toBe('Notes');
	});

	it('should filter notes by the current query', () => {
		const presenter = new NoteListPresenter(
			{ folders: new Map() } as any,
			{} as any,
			{} as any,
			{
				getNotesForFolder: vi.fn().mockReturnValue([
					{ id: '1', title: 'Alpha', content: 'First', updatedAt: '2025-01-01T00:00:00Z' },
					{ id: '2', title: 'Beta', content: 'Second', updatedAt: '2025-01-02T00:00:00Z' }
				])
			} as any,
			{
				selectedFolderID: 'notes',
				getSelectedFolder: () => ({ id: 'notes', title: 'Notes', url: '#', type: 'regular' })
			} as any
		);

		expect(presenter.getFilteredNotes('alp')).toEqual([
			expect.objectContaining({ id: '1', title: 'Alpha' })
		]);
	});

	it('should compute note restore context from folder hierarchy', () => {
		const presenter = new NoteListPresenter(
			{} as any,
			{} as any,
			{
				findTopDeletedAncestor: vi.fn().mockReturnValue({ id: 'folder-a' })
			} as any,
			{} as any
		);

		expect(presenter.getRestoreContext({ id: 'n1', folderId: 'folder-a' } as any)).toEqual({
			isHierarchical: true,
			topDeletedAncestor: { id: 'folder-a' }
		});
	});

	it('should expose selected note delete context', () => {
		const presenter = new NoteListPresenter(
			{} as any,
			{
				selectedNoteID: 'n1',
				selectedNote: { id: 'n1', title: 'Selected', deletedAt: null }
			} as any,
			{} as any,
			{} as any
		);

		expect(presenter.getSelectedNoteDeleteContext()).toEqual({
			id: 'n1',
			title: 'Selected'
		});
	});
});
