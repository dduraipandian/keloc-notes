import { settingsRepository } from './repositories';

export class PreferencesStore {
	#folderAccentColor = $state<string>('#007aff');

	get folderAccentColor() {
		return this.#folderAccentColor;
	}

	async init(settings?: Record<string, unknown>) {
		let savedSettings = settings;
		if (!savedSettings) {
			savedSettings = await settingsRepository.getAll();
		}

		if (savedSettings.folderAccentColor && typeof savedSettings.folderAccentColor === 'string') {
			this.#folderAccentColor = savedSettings.folderAccentColor;
		}
	}

	async setFolderAccentColor(color: string) {
		this.#folderAccentColor = color;
		try {
			await settingsRepository.save('folderAccentColor', color);
		} catch (err) {
			console.error('Failed to save folder accent color:', err);
		}
	}
}

export const preferencesStore = new PreferencesStore();
