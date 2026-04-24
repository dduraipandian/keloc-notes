import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	consumePendingStartupRecoveryImport,
	exportBackupAndResetLocalDataForRecovery
} from '../../src/lib/startupRecovery';

describe('startupRecovery backup before reset', () => {
	beforeEach(() => {
		sessionStorage.clear();
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
