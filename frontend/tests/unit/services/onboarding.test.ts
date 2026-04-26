import { describe, expect, it, vi, beforeEach } from 'vitest';
import { OnboardingService } from '../../../src/lib/stores/services/onboardingService';

vi.mock('../../../src/lib/infrastructure/idbr', () => ({
	hasOnboardingBeenDone: vi.fn(),
	markOnboardingAsDone: vi.fn(),
	isE2ETest: vi.fn().mockReturnValue(false)
}));

import { hasOnboardingBeenDone, markOnboardingAsDone, isE2ETest } from '../../../src/lib/infrastructure/idbr';

describe('OnboardingService', () => {
	let folderService: any;
	let noteService: any;
	let folderStore: any;
	let selectionStore: any;
	let notesStore: any;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(isE2ETest).mockReturnValue(false);

		folderService = {
			create: vi.fn().mockReturnValue('welcome-folder-id'),
			select: vi.fn()
		};

		noteService = {
			create: vi.fn().mockReturnValue({ id: 'welcome-note-id' }),
			update: vi.fn(),
			select: vi.fn()
		};

		folderStore = {
			renameFolder: vi.fn()
		};

		selectionStore = {
			selectFolder: vi.fn()
		};

		notesStore = {
			selectedNoteID: null
		};
	});

	it('skips creation and returns isFirstRun: false when onboarding already done', async () => {
		vi.mocked(hasOnboardingBeenDone).mockResolvedValue(true);
		const service = new OnboardingService(folderService, noteService, folderStore, selectionStore, notesStore);

		const result = await service.runFirstRunOnboarding();

		expect(folderService.create).not.toHaveBeenCalled();
		expect(markOnboardingAsDone).not.toHaveBeenCalled();
		expect(result.isFirstRun).toBe(false);
	});

	it('skips creation and returns isFirstRun: false in E2E test environment', async () => {
		vi.mocked(isE2ETest).mockReturnValue(true);
		const service = new OnboardingService(folderService, noteService, folderStore, selectionStore, notesStore);

		const result = await service.runFirstRunOnboarding();

		expect(folderService.create).not.toHaveBeenCalled();
		expect(markOnboardingAsDone).not.toHaveBeenCalled();
		expect(result.isFirstRun).toBe(false);
	});

	it('creates onboarding data and returns isFirstRun: true on first run', async () => {
		vi.mocked(hasOnboardingBeenDone).mockResolvedValue(false);
		const service = new OnboardingService(folderService, noteService, folderStore, selectionStore, notesStore);

		const result = await service.runFirstRunOnboarding();

		expect(folderService.create).toHaveBeenCalledWith(null, {
			silent: true,
			suppressLibraryUsageMark: true
		});
		expect(folderStore.renameFolder).toHaveBeenCalledWith('welcome-folder-id', 'Welcome');
		expect(noteService.create).toHaveBeenCalledWith('welcome-folder-id', {
			silent: true,
			suppressLibraryUsageMark: true
		});
		expect(noteService.update).toHaveBeenCalledWith('welcome-note-id', expect.objectContaining({
			title: 'Welcome to Keloc Notes',
			content: expect.any(String)
		}), { updatedTimestamp: true });
		expect(folderService.select).toHaveBeenCalledWith('welcome-folder-id');
		expect(noteService.select).toHaveBeenCalledWith('welcome-note-id');
		expect(markOnboardingAsDone).toHaveBeenCalled();
		expect(result.isFirstRun).toBe(true);
	});
});
