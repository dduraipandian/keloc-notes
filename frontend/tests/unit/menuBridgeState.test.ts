import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initMenuStateEffect } from '$lib/menu/menuBridge.svelte';
import { notesStore } from '$lib/stores/notes.svelte';
import { themeStore } from '$lib/stores/theme.svelte';
import * as AppModule from '$lib/wailsjs/go/main/App';

vi.mock('$lib/wailsjs/go/main/App', () => ({
	UpdateMenuState: vi.fn()
}));

describe('Menu State Effect', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Mock Wails runtime for unit tests
		(window as any).runtime = {};
		notesStore.notes.clear();
		notesStore.selectedNoteID = null;
		notesStore.trashCount = 0;
		themeStore.init('system');
	});

	it('calls UpdateMenuState with HasSelectedNote false when no note selected', async () => {
		initMenuStateEffect();

		// Give effect time to run
		await new Promise((resolve) => setTimeout(resolve, 10));

		expect(AppModule.UpdateMenuState).toHaveBeenCalled();
		const call = (AppModule.UpdateMenuState as any).mock.calls[0];
		const menuState = call[0];
		expect(menuState.HasSelectedNote).toBe(false);
	});

	it('calls UpdateMenuState with HasSelectedNote true when note selected', async () => {
		const testNote = {
			id: 'note-1',
			folderId: null,
			title: 'Test Note',
			content: 'Test content',
			updatedAt: new Date().toISOString(),
			isFavorite: false,
			deletedAt: null,
			deletedBatchId: null
		};

		// Add note to store and select it
		notesStore.notes.set('note-1', testNote as any);
		notesStore.selectedNoteID = 'note-1';

		initMenuStateEffect();

		// Give effect time to run
		await new Promise((resolve) => setTimeout(resolve, 10));

		expect(AppModule.UpdateMenuState).toHaveBeenCalled();
		const call = (AppModule.UpdateMenuState as any).mock.calls[0];
		const menuState = call[0];
		expect(menuState.HasSelectedNote).toBe(true);
	});

	it('calls UpdateMenuState with SelectedNoteInTrash true when selected note is deleted', async () => {
		const testNote = {
			id: 'note-1',
			folderId: null,
			title: 'Test Note',
			content: 'Test content',
			updatedAt: new Date().toISOString(),
			isFavorite: false,
			deletedAt: Date.now(),
			deletedBatchId: 'batch-1'
		};

		notesStore.notes.set('note-1', testNote as any);
		notesStore.selectedNoteID = 'note-1';
		notesStore.trashCount = 1;

		initMenuStateEffect();

		// Give effect time to run
		await new Promise((resolve) => setTimeout(resolve, 10));

		expect(AppModule.UpdateMenuState).toHaveBeenCalled();
		const call = (AppModule.UpdateMenuState as any).mock.calls[0];
		const menuState = call[0];
		expect(menuState.SelectedNoteInTrash).toBe(true);
	});

	it('calls UpdateMenuState with TrashHasItems true when trash count > 0', async () => {
		notesStore.trashCount = 2;

		initMenuStateEffect();

		// Give effect time to run
		await new Promise((resolve) => setTimeout(resolve, 10));

		expect(AppModule.UpdateMenuState).toHaveBeenCalled();
		const call = (AppModule.UpdateMenuState as any).mock.calls[0];
		const menuState = call[0];
		expect(menuState.TrashHasItems).toBe(true);
	});

	it('calls UpdateMenuState with correct theme', async () => {
		themeStore.init('dark');

		initMenuStateEffect();

		// Give effect time to run
		await new Promise((resolve) => setTimeout(resolve, 10));

		expect(AppModule.UpdateMenuState).toHaveBeenCalled();
		const call = (AppModule.UpdateMenuState as any).mock.calls[0];
		const menuState = call[0];
		expect(menuState.Theme).toBe('dark');
	});
});
