import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	buildStartupRecoveryDiagnostics,
	consumePendingStartupRecoveryImport,
	copyStartupRecoveryDiagnostics,
	exportBackupAndResetLocalDataForRecovery,
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

	it('does not reset when the user cancels the backup save dialog', async () => {
		const exportBackupJson = vi.fn().mockResolvedValue('{"schemaVersion":1}');
		const saveBackupFile = vi.fn().mockResolvedValue(false);
		const resetDatabase = vi.fn();
		const reload = vi.fn();

		const result = await exportBackupAndResetLocalDataForRecovery({
			exportBackupJson,
			saveBackupFile,
			resetDatabase,
			reload
		});

		expect(result).toBe('cancelled');
		expect(exportBackupJson).toHaveBeenCalledOnce();
		expect(saveBackupFile).toHaveBeenCalledWith('{"schemaVersion":1}');
		expect(resetDatabase).not.toHaveBeenCalled();
		expect(reload).not.toHaveBeenCalled();
	});

	it('exports a backup before resetting and keeps the post-reset import flag when requested', async () => {
		const exportBackupJson = vi.fn().mockResolvedValue('{"schemaVersion":1}');
		const saveBackupFile = vi.fn().mockResolvedValue(true);
		const resetDatabase = vi.fn().mockResolvedValue(undefined);
		const reload = vi.fn();

		const result = await exportBackupAndResetLocalDataForRecovery({
			exportBackupJson,
			saveBackupFile,
			resetDatabase,
			reload,
			importBackupAfterReset: true
		});

		expect(result).toBe('reset');
		expect(exportBackupJson).toHaveBeenCalledOnce();
		expect(saveBackupFile).toHaveBeenCalledWith('{"schemaVersion":1}');
		expect(resetDatabase).toHaveBeenCalledOnce();
		expect(reload).toHaveBeenCalledOnce();
		expect(consumePendingStartupRecoveryImport()).toBe(true);
	});

	it('does not reset if backup export fails', async () => {
		const exportBackupJson = vi.fn().mockRejectedValue(new Error('backup export failed'));
		const saveBackupFile = vi.fn();
		const resetDatabase = vi.fn();
		const reload = vi.fn();

		await expect(
			exportBackupAndResetLocalDataForRecovery({
				exportBackupJson,
				saveBackupFile,
				resetDatabase,
				reload
			})
		).rejects.toThrow('backup export failed');

		expect(saveBackupFile).not.toHaveBeenCalled();
		expect(resetDatabase).not.toHaveBeenCalled();
		expect(reload).not.toHaveBeenCalled();
	});
});
