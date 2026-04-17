import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PreferencesStore } from '../../../src/lib/stores/preferences.svelte';
import { settingsRepository } from '../../../src/lib/stores/repositories';

vi.mock('../../../src/lib/stores/repositories', () => ({
	settingsRepository: {
		getAll: vi.fn(),
		save: vi.fn()
	}
}));

describe('PreferencesStore', () => {
	let store: PreferencesStore;

	beforeEach(() => {
		vi.clearAllMocks();
		store = new PreferencesStore();
	});

	it('initializes with default accent color', () => {
		expect(store.folderAccentColor).toBe('#007aff');
	});

	it('restores accent color on init', async () => {
		const savedColor = '#ff3b30';
		vi.mocked(settingsRepository.getAll).mockResolvedValue({
			selectedFolderID: null,
			selectedNoteID: null,
			sidebarWidth: null,
			noteListWidth: null,
			applicationTheme: null,
			folderAccentColor: savedColor
		});

		await store.init();

		expect(store.folderAccentColor).toBe(savedColor);
	});

	it('handles missing setting on init', async () => {
		vi.mocked(settingsRepository.getAll).mockResolvedValue({
			selectedFolderID: null,
			selectedNoteID: null,
			sidebarWidth: null,
			noteListWidth: null,
			applicationTheme: null,
			folderAccentColor: null
		});

		await store.init();

		expect(store.folderAccentColor).toBe('#007aff');
	});

	it('updates accent color and saves', async () => {
		const newColor = '#34c759';
		vi.mocked(settingsRepository.save).mockResolvedValue('folderAccentColor' as IDBValidKey);

		await store.setFolderAccentColor(newColor);

		expect(store.folderAccentColor).toBe(newColor);
		expect(settingsRepository.save).toHaveBeenCalledWith('folderAccentColor', newColor);
	});

	it('handles save error gracefully', async () => {
		const newColor = '#ff9500';
		vi.mocked(settingsRepository.save).mockRejectedValue(new Error('Save failed'));

		await store.setFolderAccentColor(newColor);

		expect(store.folderAccentColor).toBe(newColor);
	});
});
