import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PreferencesStore } from '../../../src/lib/stores/preferences.svelte';
import * as settingsRepository from '../../../src/lib/infrastructure/repositories';

vi.mock('../../../src/lib/infrastructure/repositories', () => ({
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

	describe('editorToolbar', () => {
		it('should initialize with null if no saved value', async () => {
			vi.mocked(settingsRepository.settingsRepository.getAll).mockResolvedValue({
				selectedFolderID: null,
				selectedNoteID: null,
				sidebarWidth: null,
				noteListWidth: null,
				applicationTheme: null,
				folderAccentColor: null,
				editorToolbar: null,
				enabledLanguages: null,
				imageProcessingConcurrency: null
			});

			await store.init();

			expect(store.editorToolbar).toBeNull();
		});

		it('should initialize with saved editorToolbar value', async () => {
			vi.mocked(settingsRepository.settingsRepository.getAll).mockResolvedValue({
				selectedFolderID: null,
				selectedNoteID: null,
				sidebarWidth: null,
				noteListWidth: null,
				applicationTheme: null,
				folderAccentColor: null,
				editorToolbar: 'fixed',
				enabledLanguages: null,
				imageProcessingConcurrency: null
			});

			await store.init();

			expect(store.editorToolbar).toBe('fixed');
		});

		it('should persist editorToolbar to settings on setEditorToolbar', async () => {
			vi.mocked(settingsRepository.settingsRepository.getAll).mockResolvedValue({
				selectedFolderID: null,
				selectedNoteID: null,
				sidebarWidth: null,
				noteListWidth: null,
				applicationTheme: null,
				folderAccentColor: null,
				editorToolbar: null,
				enabledLanguages: null,
				imageProcessingConcurrency: null
			});

			await store.init();
			await store.setEditorToolbar('bubble');

			expect(store.editorToolbar).toBe('bubble');
			expect(settingsRepository.settingsRepository.save).toHaveBeenCalledWith(
				'editorToolbar',
				'bubble'
			);
		});

		it('should accept all valid editorToolbar values', async () => {
			vi.mocked(settingsRepository.settingsRepository.getAll).mockResolvedValue({
				selectedFolderID: null,
				selectedNoteID: null,
				sidebarWidth: null,
				noteListWidth: null,
				applicationTheme: null,
				folderAccentColor: null,
				editorToolbar: null,
				enabledLanguages: null,
				imageProcessingConcurrency: null
			});

			await store.init();

			const values: Array<'fixed' | 'bubble' | 'both'> = ['fixed', 'bubble', 'both'];
			for (const value of values) {
				vi.mocked(settingsRepository.settingsRepository.save).mockClear();
				await store.setEditorToolbar(value);
				expect(store.editorToolbar).toBe(value);
			}
		});
	});

	describe('enabledLanguages', () => {
		it('should initialize with null if no saved value', async () => {
			vi.mocked(settingsRepository.settingsRepository.getAll).mockResolvedValue({
				selectedFolderID: null,
				selectedNoteID: null,
				sidebarWidth: null,
				noteListWidth: null,
				applicationTheme: null,
				folderAccentColor: null,
				editorToolbar: null,
				enabledLanguages: null,
				imageProcessingConcurrency: null
			});

			await store.init();

			expect(store.enabledLanguages).toBeNull();
		});

		it('should initialize with saved enabledLanguages array', async () => {
			const languages = ['javascript', 'python', 'go'];
			vi.mocked(settingsRepository.settingsRepository.getAll).mockResolvedValue({
				selectedFolderID: null,
				selectedNoteID: null,
				sidebarWidth: null,
				noteListWidth: null,
				applicationTheme: null,
				folderAccentColor: null,
				editorToolbar: null,
				enabledLanguages: languages,
				imageProcessingConcurrency: null
			});

			await store.init();

			expect(store.enabledLanguages).toEqual(languages);
		});

		it('should persist enabledLanguages to settings on setEnabledLanguages', async () => {
			vi.mocked(settingsRepository.settingsRepository.getAll).mockResolvedValue({
				selectedFolderID: null,
				selectedNoteID: null,
				sidebarWidth: null,
				noteListWidth: null,
				applicationTheme: null,
				folderAccentColor: null,
				editorToolbar: null,
				enabledLanguages: null,
				imageProcessingConcurrency: null
			});

			await store.init();
			const languages = ['javascript', 'typescript', 'rust'];
			await store.setEnabledLanguages(languages);

			expect(store.enabledLanguages).toEqual(languages);
			expect(settingsRepository.settingsRepository.save).toHaveBeenCalledWith(
				'enabledLanguages',
				languages
			);
		});

		it('should handle empty languages array', async () => {
			vi.mocked(settingsRepository.settingsRepository.getAll).mockResolvedValue({
				selectedFolderID: null,
				selectedNoteID: null,
				sidebarWidth: null,
				noteListWidth: null,
				applicationTheme: null,
				folderAccentColor: null,
				editorToolbar: null,
				enabledLanguages: null,
				imageProcessingConcurrency: null
			});

			await store.init();
			await store.setEnabledLanguages([]);

			expect(store.enabledLanguages).toEqual([]);
			expect(settingsRepository.settingsRepository.save).toHaveBeenCalledWith(
				'enabledLanguages',
				[]
			);
		});
	});

	describe('imageProcessingConcurrency', () => {
		it('should initialize with null if no saved value', async () => {
			vi.mocked(settingsRepository.settingsRepository.getAll).mockResolvedValue({
				selectedFolderID: null,
				selectedNoteID: null,
				sidebarWidth: null,
				noteListWidth: null,
				applicationTheme: null,
				folderAccentColor: null,
				editorToolbar: null,
				enabledLanguages: null,
				imageProcessingConcurrency: null
			});

			await store.init();

			expect(store.imageProcessingConcurrency).toBeNull();
		});

		it('should initialize with saved imageProcessingConcurrency value', async () => {
			vi.mocked(settingsRepository.settingsRepository.getAll).mockResolvedValue({
				selectedFolderID: null,
				selectedNoteID: null,
				sidebarWidth: null,
				noteListWidth: null,
				applicationTheme: null,
				folderAccentColor: null,
				editorToolbar: null,
				enabledLanguages: null,
				imageProcessingConcurrency: 5
			});

			await store.init();

			expect(store.imageProcessingConcurrency).toBe(5);
		});

		it('should persist imageProcessingConcurrency setting', async () => {
			vi.mocked(settingsRepository.settingsRepository.getAll).mockResolvedValue({
				selectedFolderID: null,
				selectedNoteID: null,
				sidebarWidth: null,
				noteListWidth: null,
				applicationTheme: null,
				folderAccentColor: null,
				editorToolbar: null,
				enabledLanguages: null,
				imageProcessingConcurrency: null
			});

			await store.init();
			await store.setImageProcessingConcurrency(4);

			expect(store.imageProcessingConcurrency).toBe(4);
			expect(settingsRepository.settingsRepository.save).toHaveBeenCalledWith(
				'imageProcessingConcurrency',
				4
			);
		});

		it('should ignore invalid saved imageProcessingConcurrency values', async () => {
			vi.mocked(settingsRepository.settingsRepository.getAll).mockResolvedValue({
				selectedFolderID: null,
				selectedNoteID: null,
				sidebarWidth: null,
				noteListWidth: null,
				applicationTheme: null,
				folderAccentColor: null,
				editorToolbar: null,
				enabledLanguages: null,
				imageProcessingConcurrency: 999
			});

			await store.init();

			expect(store.imageProcessingConcurrency).toBeNull();
		});
	});
});
