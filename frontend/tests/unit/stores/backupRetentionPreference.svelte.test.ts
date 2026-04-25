import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PreferencesStore } from '$lib/stores/preferences.svelte';
import * as repositories from '$lib/infrastructure/repositories';
import { DEFAULT_BACKUP_RETENTION_DAYS } from '$lib/backup/retention';

vi.mock('$lib/infrastructure/repositories', () => ({
	settingsRepository: {
		getAll: vi.fn(),
		save: vi.fn()
	}
}));

describe('backup retention preference', () => {
	let store: PreferencesStore;

	beforeEach(() => {
		vi.clearAllMocks();
		store = new PreferencesStore();
	});

	it('defaults to 30 days when no setting is saved', async () => {
		vi.mocked(repositories.settingsRepository.getAll).mockResolvedValue({
			backupRetentionDays: null
		} as any);

		await store.init();

		expect(store.backupRetentionDays).toBe(DEFAULT_BACKUP_RETENTION_DAYS);
	});

	it('initializes with a valid saved retention window', async () => {
		vi.mocked(repositories.settingsRepository.getAll).mockResolvedValue({
			backupRetentionDays: 7
		} as any);

		await store.init();

		expect(store.backupRetentionDays).toBe(7);
	});

	it('persists the selected retention window', async () => {
		await store.setBackupRetentionDays(90);

		expect(store.backupRetentionDays).toBe(90);
		expect(repositories.settingsRepository.save).toHaveBeenCalledWith('backupRetentionDays', 90);
	});

	it('normalizes invalid saved retention values to the default', async () => {
		vi.mocked(repositories.settingsRepository.getAll).mockResolvedValue({
			backupRetentionDays: 999
		} as any);

		await store.init();

		expect(store.backupRetentionDays).toBe(DEFAULT_BACKUP_RETENTION_DAYS);
	});
});
