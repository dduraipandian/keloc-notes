import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UIStore } from '../../../src/lib/stores/dialog.svelte';

describe('UIStore', () => {
	let uiStore: UIStore;

	beforeEach(() => {
		uiStore = new UIStore();
	});

	it('should configure note delete dialog correctly', () => {
		const onConfirm = vi.fn();
		uiStore.confirmNoteDelete('Test Note', onConfirm);

		expect(uiStore.noteDialog.open).toBe(true);
		expect(uiStore.noteDialog.type).toBe('destroy');
		expect(uiStore.noteDialog.title).toBe('Delete Note');
		expect(uiStore.noteDialog.description).toContain('Test Note');

		uiStore.noteDialog.onConfirm();
		expect(onConfirm).toHaveBeenCalled();
	});

	it('should configure note restore dialog correctly', () => {
		uiStore.confirmNoteRestore('Test Note', () => {});

		expect(uiStore.noteDialog.type).toBe('restore');
		expect(uiStore.noteDialog.title).toBe('Restore Note');
		expect(uiStore.noteDialog.description).toContain("restore 'Test Note'");
	});

	it('should configure folder delete dialog correctly', () => {
		uiStore.confirmFolderDelete('Big Folder', () => {});

		expect(uiStore.folderDialog.open).toBe(true);
		expect(uiStore.folderDialog.type).toBe('destroy');
		expect(uiStore.folderDialog.title).toBe('Delete Folder');
	});

	it('should configure app dialog correctly for app-level failures', () => {
		uiStore.confirmAppQuit('Save failed', 'quota exceeded', () => {});

		expect(uiStore.appDialog.open).toBe(true);
		expect(uiStore.appDialog.title).toBe('Save failed');
		expect(uiStore.appDialog.allowHtml).toBe(true);
		expect(uiStore.appDialog.description).toContain('quota exceeded');
	});
});
