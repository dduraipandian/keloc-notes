import { settingsRepository } from '../infrastructure/repositories';
import {
	clampImageProcessingConcurrency,
	MAX_IMAGE_PROCESSING_CONCURRENCY
} from '../editor/imageHandler';

export class PreferencesStore {
	#folderAccentColor = $state<string>('#007aff');
	#editorToolbar = $state<'fixed' | 'bubble' | 'both' | null>(null);
	#enabledLanguages = $state<string[] | null>(null);
	#imageProcessingConcurrency = $state<number | null>(null);

	get folderAccentColor() {
		return this.#folderAccentColor;
	}

	get editorToolbar() {
		return this.#editorToolbar;
	}

	get enabledLanguages() {
		return this.#enabledLanguages;
	}

	get imageProcessingConcurrency() {
		return this.#imageProcessingConcurrency;
	}

	async init(settings?: Record<string, unknown>) {
		let savedSettings = settings;
		if (!savedSettings) {
			savedSettings = await settingsRepository.getAll();
		}

		if (savedSettings.folderAccentColor && typeof savedSettings.folderAccentColor === 'string') {
			this.#folderAccentColor = savedSettings.folderAccentColor;
		}

		if (savedSettings.editorToolbar && typeof savedSettings.editorToolbar === 'string') {
			const value = savedSettings.editorToolbar as 'fixed' | 'bubble' | 'both';
			if (['fixed', 'bubble', 'both'].includes(value)) {
				this.#editorToolbar = value;
			}
		}

		if (savedSettings.enabledLanguages && Array.isArray(savedSettings.enabledLanguages)) {
			this.#enabledLanguages = savedSettings.enabledLanguages as string[];
		}

		if (
			typeof savedSettings.imageProcessingConcurrency === 'number' &&
			savedSettings.imageProcessingConcurrency >= 1 &&
			savedSettings.imageProcessingConcurrency <= MAX_IMAGE_PROCESSING_CONCURRENCY
		) {
			this.#imageProcessingConcurrency = savedSettings.imageProcessingConcurrency;
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

	async setEditorToolbar(value: 'fixed' | 'bubble' | 'both') {
		this.#editorToolbar = value;
		try {
			await settingsRepository.save('editorToolbar', value);
		} catch (err) {
			console.error('Failed to save editor toolbar setting:', err);
		}
	}

	async setEnabledLanguages(languages: string[]) {
		this.#enabledLanguages = languages;
		try {
			await settingsRepository.save('enabledLanguages', languages);
		} catch (err) {
			console.error('Failed to save enabled languages:', err);
		}
	}

	async setImageProcessingConcurrency(value: number) {
		const clamped = clampImageProcessingConcurrency(value);
		this.#imageProcessingConcurrency = clamped;
		try {
			await settingsRepository.save('imageProcessingConcurrency', clamped);
		} catch (err) {
			console.error('Failed to save image processing concurrency:', err);
		}
	}
}

