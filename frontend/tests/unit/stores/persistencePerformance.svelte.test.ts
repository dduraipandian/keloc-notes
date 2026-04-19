import { describe, it, expect, beforeEach, vi } from 'vitest';
import { notesStore } from '../../../src/lib/stores/notes.svelte';
import { notesRepository, settingsRepository } from '../../../src/lib/stores/repositories';
import { SvelteMap } from 'svelte/reactivity';

// Mock repositories
vi.mock('../../../src/lib/stores/repositories', () => ({
	foldersRepository: { list: vi.fn(), save: vi.fn() },
	notesRepository: { 
		list: vi.fn(), 
		saveMeta: vi.fn().mockResolvedValue(undefined),
		saveContent: vi.fn().mockResolvedValue(undefined)
	},
	settingsRepository: { getAll: vi.fn(), save: vi.fn() }
}));

describe('Phase B: Persistence Performance', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		
		// Reset store state
		(notesStore as any).notes.clear();
		(notesStore as any).isInitialized = true;
		(notesStore as any).selectedNoteID = null;
		
		// Setup a test note
		const note = {
			id: 'n1',
			title: 'Initial Title',
			content: 'Initial Content',
			folderId: null,
			updatedAt: '2021-01-01T00:00:00.000Z',
			isContentLoaded: true
		};
		let n = $state(note);
		notesStore.notes.set('n1', n as any);
	});

	it('Item 4.1: should debounce note persistence', () => {
		notesStore.updateNote('n1', { content: 'typed' });
		
		// Should NOT call save immediately
		expect(notesRepository.saveContent).not.toHaveBeenCalled();

		// Advance time partially
		vi.advanceTimersByTime(200);
		expect(notesRepository.saveContent).not.toHaveBeenCalled();

		// Advance to trigger debounce
		vi.advanceTimersByTime(200);
		expect(notesRepository.saveContent).toHaveBeenCalledTimes(1);
		
		// Verify meta was also updated (updatedAt)
		expect(notesRepository.saveMeta).toHaveBeenCalledTimes(1);
	});

	it('Item 4.1: should flush pending debounce on note switch', () => {
		notesStore.selectNote('n1');
		notesStore.updateNote('n1', { content: 'unsaved content' });
		
		expect(notesRepository.saveContent).not.toHaveBeenCalled();

		// Switch to another note
		notesStore.selectNote('n2');

		// n1 should have been flushed immediately
		expect(notesRepository.saveContent).toHaveBeenCalledTimes(1);
		expect(notesRepository.saveContent).toHaveBeenCalledWith('n1', 'unsaved content');
	});

	it('Item 4.2: should separate selection persistence from note persistence', () => {
		notesStore.selectNote('n1');
		(settingsRepository.save as any).mockClear();

		// Update note content
		notesStore.updateNote('n1', { content: 'updated' });
		
		// Advance timers so persistence fires
		vi.advanceTimersByTime(400);
		
		expect(notesRepository.saveContent).toHaveBeenCalled();
		// settingsRepository.save ONLY for selectedNoteID should NOT be called during note update
		const selectionCalls = (settingsRepository.save as any).mock.calls.filter(
			(call: any) => call[0] === 'selectedNoteID'
		);
		expect(selectionCalls.length).toBe(0);
	});

	it('Item 4.2: should persist selection only when selectNote is called', () => {
		notesStore.selectNote('n1');
		expect(settingsRepository.save).toHaveBeenCalledWith('selectedNoteID', 'n1');
	});
});
