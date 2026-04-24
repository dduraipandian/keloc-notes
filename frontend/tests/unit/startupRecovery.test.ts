import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	buildStartupRecoveryDiagnostics,
	consumePendingStartupRecoveryImport,
	copyStartupRecoveryDiagnostics,
	flagPendingStartupRecoveryImport,
	resetLocalDataForRecovery
} from '../../src/lib/startupRecovery';

describe('startupRecovery', () => {
	beforeEach(() => {
		sessionStorage.clear();
	});

	it('builds a diagnostic string with the startup error details', () => {
		const error = new Error('quota exceeded');
		error.stack = 'Error: quota exceeded\n    at startup';
		const diagnostics = buildStartupRecoveryDiagnostics(error);

		expect(diagnostics).toContain('Keloc Notes startup failure');
		expect(diagnostics).toContain('quota exceeded');
		expect(diagnostics).toContain('User agent:');
		expect(diagnostics).toContain('Stack trace:');
		expect(diagnostics).toContain('at startup');
	});

	it('prefers the injected clipboard writer when copying diagnostics', async () => {
		const writeText = vi.fn().mockResolvedValue(true);

		await copyStartupRecoveryDiagnostics('diagnostic payload', {
			writeText
		});

		expect(writeText).toHaveBeenCalledWith('diagnostic payload');
	});

	it('sets a post-reset import flag before reloading when requested', async () => {
		const resetDatabase = vi.fn().mockResolvedValue(undefined);
		const reload = vi.fn();

		await resetLocalDataForRecovery({
			resetDatabase,
			reload,
			importBackupAfterReset: true
		});

		expect(resetDatabase).toHaveBeenCalledOnce();
		expect(sessionStorage.getItem('kelocnotes:startup-recovery:import-backup')).toBe('1');
		expect(reload).toHaveBeenCalledOnce();
	});

	it('consumes the post-reset import flag only once', () => {
		flagPendingStartupRecoveryImport();

		expect(consumePendingStartupRecoveryImport()).toBe(true);
		expect(consumePendingStartupRecoveryImport()).toBe(false);
	});
});
