import { describe, it, expect, beforeEach, vi } from 'vitest';
import { uiStore } from './ui.svelte';

describe('UIStore', () => {
	beforeEach(() => {
		uiStore.noteDialog.open = false;
		uiStore.folderDialog.open = false;
	});

	it('should configure note delete dialog correctly', () => {
		const onConfirm = vi.fn();
		uiStore.confirmNoteDelete('Test Note', onConfirm);

		expect(uiStore.noteDialog.open).toBe(true);
		expect(uiStore.noteDialog.type).toBe('delete');
		expect(uiStore.noteDialog.title).toBe('Delete Note');
		expect(uiStore.noteDialog.description).toContain('Test Note');
		
		uiStore.noteDialog.onConfirm();
		expect(onConfirm).toHaveBeenCalled();
	});

	it('should configure note restore dialog for hierarchical context', () => {
		uiStore.confirmNoteRestore('Nested Note', true, () => {});

		expect(uiStore.noteDialog.type).toBe('restore');
		expect(uiStore.noteDialog.title).toBe('Restore Folder Tree?');
		expect(uiStore.noteDialog.description).toContain('restore its parent folder structure');
	});

	it('should configure folder delete dialog correctly', () => {
		uiStore.confirmFolderDelete('Big Folder', () => {});

		expect(uiStore.folderDialog.open).toBe(true);
		expect(uiStore.folderDialog.type).toBe('delete');
		expect(uiStore.folderDialog.title).toBe('Delete Folder');
	});
});
