import { settingsRepository } from '../infrastructure/repositories';
import {
	clampImageProcessingConcurrency,
	MAX_IMAGE_PROCESSING_CONCURRENCY
} from '../editor/imageHandler';
import {
	DEFAULT_BACKUP_RETENTION_DAYS,
	normalizeBackupRetentionDays,
	type BackupRetentionDays
} from '$lib/backup/retention';

export class PreferencesStore {
	#folderAccentColor = $state<string>('#007aff');
	#editorToolbar = $state<'fixed' | 'bubble' | 'both' | null>(null);
	#enabledLanguages = $state<string[] | null>(null);
	#imageProcessingConcurrency = $state<number | null>(null);
	#backupRetentionDays = $state<BackupRetentionDays>(DEFAULT_BACKUP_RETENTION_DAYS);

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

	get backupRetentionDays() {
		return this.#backupRetentionDays;
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

		this.#backupRetentionDays = normalizeBackupRetentionDays(
			savedSettings.backupRetentionDays
		);
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

	async setBackupRetentionDays(value: number) {
		const normalized = normalizeBackupRetentionDays(value);
		this.#backupRetentionDays = normalized;
		try {
			await settingsRepository.save('backupRetentionDays', normalized);
		} catch (err) {
			console.error('Failed to save backup retention setting:', err);
		}
	}
}
