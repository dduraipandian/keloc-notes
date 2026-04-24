import { describe, expect, it, vi } from 'vitest';
import { UIStore } from '../../src/lib/stores/dialog.svelte';
import { buildStartupRecoveryGuidance } from '../../src/lib/startupRecovery';

describe('startup recovery dialog actions', () => {
	it('shows backup-first reset actions for recoverable storage failures', () => {
		const uiStore = new UIStore();

		uiStore.showStartupRecoveryDialog({
			errorMessage: 'IndexedDB quota exceeded',
			recoveryGuidance: buildStartupRecoveryGuidance('IndexedDB quota exceeded'),
			onRetry: vi.fn(),
			onCopyDiagnostics: vi.fn(),
			onResetLocalData: vi.fn(),
			onResetAndImportBackup: vi.fn(),
			onQuit: vi.fn()
		});

		expect(uiStore.appDialog.description).toContain(
			'export a backup copy to a file'
		);
		expect(uiStore.appDialog.actions?.map((action) => action.label)).toEqual([
			'Retry Startup',
			'Copy Diagnostics',
			'Reset Local Data',
			'Reset And Import Backup'
		]);
	});

	it('omits reset actions for blocked upgrades', () => {
		const uiStore = new UIStore();

		uiStore.showStartupRecoveryDialog({
			errorMessage: 'Database upgrade is blocked by another Keloc Notes window.',
			recoveryGuidance: buildStartupRecoveryGuidance(
				'Database upgrade is blocked by another Keloc Notes window.'
			),
			onRetry: vi.fn(),
			onCopyDiagnostics: vi.fn(),
			onResetLocalData: vi.fn(),
			onResetAndImportBackup: vi.fn(),
			onQuit: vi.fn()
		});

		expect(uiStore.appDialog.actions?.map((action) => action.label)).toEqual([
			'Retry Startup',
			'Copy Diagnostics'
		]);
	});
});
