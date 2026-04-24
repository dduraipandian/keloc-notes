import { describe, expect, it, vi } from 'vitest';
import { UIStore } from '$lib/stores/dialog.svelte';
import { buildStartupRecoveryGuidance } from '$lib/startupRecovery';
import { buildFileOperationFailureMessage } from '$lib/fileOperationFailures';

describe('user-facing recovery UX', () => {
	it('structures startup recovery dialogs around cause, data impact, next action, and help', () => {
		const uiStore = new UIStore();

		uiStore.showStartupRecoveryDialog({
			errorMessage: 'IndexedDB UnknownError: database file may be corrupted',
			recoveryGuidance: buildStartupRecoveryGuidance(
				'IndexedDB UnknownError: database file may be corrupted'
			),
			onRetry: vi.fn(),
			onCopyDiagnostics: vi.fn(),
			onResetLocalData: vi.fn(),
			onResetAndImportBackup: vi.fn(),
			onQuit: vi.fn()
		});

		expect(uiStore.appDialog.description).toContain('What happened');
		expect(uiStore.appDialog.description).toContain('Data affected');
		expect(uiStore.appDialog.description).toContain('What you can do now');
		expect(uiStore.appDialog.description).toContain('Recovery guide');
		expect(uiStore.appDialog.description).toContain('docs/recovery.md');
	});

	it('adds recovery guide context to file operation failure messages', () => {
		const message = buildFileOperationFailureMessage(
			'backup-import',
			new Error('invalid backup file')
		);

		expect(message).toContain('Recovery guide');
		expect(message).toContain('README');
	});
});
