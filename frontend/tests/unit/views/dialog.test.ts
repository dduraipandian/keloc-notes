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

	it('should configure startup recovery dialog with retry and recovery actions', () => {
		const onRetry = vi.fn();
		const onCopyDiagnostics = vi.fn();
		const onResetLocalData = vi.fn();
		const onResetAndImportBackup = vi.fn();
		const onQuit = vi.fn();

		uiStore.showStartupRecoveryDialog({
			errorMessage: 'IndexedDB quota exceeded',
			onRetry,
			onCopyDiagnostics,
			onResetLocalData,
			onResetAndImportBackup,
			onQuit
		});

		expect(uiStore.appDialog.open).toBe(true);
		expect(uiStore.appDialog.title).toBe('Failed to Start');
		expect(uiStore.appDialog.description).toContain('IndexedDB quota exceeded');
		expect(uiStore.appDialog.actions).toHaveLength(4);
		expect(uiStore.appDialog.actions?.map((action) => action.label)).toEqual([
			'Retry Startup',
			'Copy Diagnostics',
			'Reset Local Data',
			'Reset And Import Backup'
		]);
		expect(uiStore.appDialog.actions?.[0].closeDialog).toBe(false);
		expect(uiStore.appDialog.confirmLabel).toBe('Quit Application');

		uiStore.appDialog.actions?.[0].onSelect();
		uiStore.appDialog.actions?.[1].onSelect();
		uiStore.appDialog.actions?.[2].onSelect();
		uiStore.appDialog.actions?.[3].onSelect();
		uiStore.appDialog.onConfirm();

		expect(onRetry).toHaveBeenCalledOnce();
		expect(onCopyDiagnostics).toHaveBeenCalledOnce();
		expect(onResetLocalData).toHaveBeenCalledOnce();
		expect(onResetAndImportBackup).toHaveBeenCalledOnce();
		expect(onQuit).toHaveBeenCalledOnce();
	});
});
