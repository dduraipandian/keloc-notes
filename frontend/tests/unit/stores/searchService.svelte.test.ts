import { describe, expect, it, vi } from 'vitest';
import { SearchService } from '../../../src/lib/stores/searchService.svelte';
import { NotesStore, type NoteItem } from '../../../src/lib/stores/notes.svelte';

describe('SearchService', () => {
	it('excludes deleted notes from search results even if they remain indexed', () => {
		const activeNote: NoteItem = {
			id: 'active-note',
			title: 'MiniSearch active note',
			content: 'needle',
			summary: '',
			updatedAt: new Date().toISOString(),
			folderId: 'work',
			isFavorite: false,
			deletedAt: null,
			deletedBatchId: null,
			isContentLoaded: true
		};
		const deletedNote: NoteItem = {
			id: 'deleted-note',
			title: 'MiniSearch deleted note',
			content: 'needle',
			summary: '',
			updatedAt: new Date().toISOString(),
			folderId: 'work',
			isFavorite: false,
			deletedAt: Date.now(),
			deletedBatchId: 'batch-1',
			isContentLoaded: true
		};
		const notes = new NotesStore([activeNote, deletedNote]);
		const service = new SearchService(
			{
				findItemById: vi.fn().mockReturnValue({ id: 'work', items: [] })
			} as any,
			notes,
			{
				getNotesForFolder: vi.fn().mockReturnValue([activeNote, deletedNote])
			}
		);

		service.updateNoteIndex(activeNote.id, activeNote.title, activeNote.content);
		service.updateNoteIndex(deletedNote.id, deletedNote.title, deletedNote.content);

		expect(service.search('needle', 'work')).toEqual([activeNote.id]);
	});
});
