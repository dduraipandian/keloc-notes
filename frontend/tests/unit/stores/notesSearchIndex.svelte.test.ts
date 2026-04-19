import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotesStore, type NoteItem } from '../../../src/lib/stores/notes.svelte';

describe('NotesStore search index sync', () => {
	let notesStore: NotesStore;
	let searchService: {
		removeNoteIndex: ReturnType<typeof vi.fn>;
		updateNoteIndex: ReturnType<typeof vi.fn>;
	};

	beforeEach(() => {
		notesStore = new NotesStore();
		(notesStore as any).isInitialized = true;
		searchService = {
			removeNoteIndex: vi.fn(),
			updateNoteIndex: vi.fn()
		};
		notesStore.setSearchService(searchService as any);
	});

	const addNote = (overrides: Partial<NoteItem> & { id: string }) => {
		const note: NoteItem = {
			id: overrides.id,
			title: 'Indexed note',
			content: 'note content',
			summary: 'note content',
			updatedAt: new Date().toISOString(),
			folderId: 'work',
			isFavorite: false,
			deletedAt: null,
			deletedBatchId: null,
			isContentLoaded: true,
			...overrides
		};
		notesStore.notes.set(note.id, note);
		return note;
	};

	it('removes a note from the search index when it is moved to trash', () => {
		addNote({ id: 'note-1' });

		notesStore.deleteNote('note-1', 123, 'batch-1');

		expect(searchService.removeNoteIndex).toHaveBeenCalledWith('note-1');
	});

	it('re-indexes a note when it is restored from trash', () => {
		addNote({ id: 'note-1', deletedAt: 123, deletedBatchId: 'batch-1' });

		notesStore.restoreNote('note-1', 'work');

		expect(searchService.updateNoteIndex).toHaveBeenCalledWith(
			'note-1',
			'Indexed note',
			'note content'
		);
	});

	it('updates the search index for folder-wide trash and restore flows', () => {
		addNote({ id: 'note-1', folderId: 'work' });
		addNote({ id: 'note-2', folderId: 'work', content: 'second note', summary: 'second note' });

		notesStore.deleteNotesInFolder('work', 123, 'batch-1');

		expect(searchService.removeNoteIndex).toHaveBeenCalledTimes(2);
		expect(searchService.removeNoteIndex).toHaveBeenCalledWith('note-1');
		expect(searchService.removeNoteIndex).toHaveBeenCalledWith('note-2');

		notesStore.restoreNotesInFolder('work', 'batch-1');

		expect(searchService.updateNoteIndex).toHaveBeenCalledTimes(2);
		expect(searchService.updateNoteIndex).toHaveBeenCalledWith(
			'note-1',
			'Indexed note',
			'note content'
		);
		expect(searchService.updateNoteIndex).toHaveBeenCalledWith(
			'note-2',
			'Indexed note',
			'second note'
		);
	});
});
