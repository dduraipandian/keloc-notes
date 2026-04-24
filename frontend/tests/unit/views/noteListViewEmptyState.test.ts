import { describe, expect, it, vi } from 'vitest';
import { NoteListView } from '$lib/views/noteListView.svelte';

const mockSearch = {
	ensureFolderIndexed: vi.fn(),
	version: 0,
	search: vi.fn().mockReturnValue([])
};

function createView(profile: 'home' | 'favorites' | 'trash' | 'regular', hasVisibleNotes = false) {
	return new NoteListView(
		{
			selection: {
				selectedFolderID: profile,
				getSelectedFolder: () => ({
					id: profile === 'trash' ? 'deleted-notes' : profile,
					title:
						profile === 'home'
							? 'Home'
							: profile === 'favorites'
								? 'Favorites'
								: profile === 'trash'
									? 'Recently Deleted'
									: 'Projects',
					profile: profile === 'regular' ? 'regular' : undefined,
					deletedAt: null
				})
			} as any
		},
		{} as any,
		{
			listNotes: () => (hasVisibleNotes ? [{ id: 'n1', title: 'Note', updatedAt: new Date().toISOString() }] : [])
		} as any,
		{} as any,
		{
			getNotesForFolder: vi.fn().mockReturnValue(
				hasVisibleNotes ? [{ id: 'n1', title: 'Note', updatedAt: new Date().toISOString() }] : []
			)
		} as any,
		mockSearch as any
	);
}

describe('NoteListView empty state copy', () => {
	it('returns home-specific empty state copy', () => {
		const view = createView('home');
		expect(view.getEmptyStateTitle()).toBe('No notes here yet');
		expect(view.getEmptyStateDescription()).toBe('Create a folder or note to start building your library.');
		expect(view.getEditorEmptyDescription()).toBe('Create a folder or note, and it will open here.');
	});

	it('returns favorites-specific empty state copy', () => {
		const view = createView('favorites');
		expect(view.getEmptyStateTitle()).toBe('Nothing in Favorites yet');
		expect(view.getEmptyStateDescription()).toBe('Favorite a note or folder and it will show up here.');
		expect(view.getEditorEmptyDescription()).toBe('Favorite a note or folder and it will appear here.');
	});

	it('returns trash-specific empty state copy', () => {
		const view = createView('trash');
		expect(view.getEmptyStateTitle()).toBe('Recently Deleted is empty');
		expect(view.getEmptyStateDescription()).toBe(
			'Deleted notes and folders stay here until you restore or permanently remove them.'
		);
		expect(view.getEditorEmptyDescription()).toBe(
			'Deleted notes and folders appear here until you restore or permanently remove them.'
		);
	});
});
