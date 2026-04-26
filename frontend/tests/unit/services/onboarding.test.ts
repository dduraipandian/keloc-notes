import { describe, expect, it, vi, beforeEach } from 'vitest';
import { OnboardingService } from '../../../src/lib/stores/services/onboardingService';

vi.mock('../../../src/lib/infrastructure/idbr', () => ({
	hasLibraryBeenUsed: vi.fn(),
	markLibraryAsUsed: vi.fn(),
	isE2ETest: vi.fn().mockReturnValue(false)
}));

import { hasLibraryBeenUsed, markLibraryAsUsed, isE2ETest } from '../../../src/lib/infrastructure/idbr';

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

	it('should do nothing if library has been used', async () => {
		vi.mocked(hasLibraryBeenUsed).mockResolvedValue(true);
		const service = new OnboardingService(folderService, noteService, folderStore, selectionStore, notesStore);
		
		await service.runFirstRunOnboarding();
		
		expect(folderService.create).not.toHaveBeenCalled();
		expect(markLibraryAsUsed).not.toHaveBeenCalled();
	});

	it('should do nothing if in E2E test environment', async () => {
		vi.mocked(isE2ETest).mockReturnValue(true);
		const service = new OnboardingService(folderService, noteService, folderStore, selectionStore, notesStore);
		
		await service.runFirstRunOnboarding();
		
		expect(folderService.create).not.toHaveBeenCalled();
		expect(markLibraryAsUsed).not.toHaveBeenCalled();
	});

	it('should create onboarding data if library is new', async () => {
		vi.mocked(hasLibraryBeenUsed).mockResolvedValue(false);
		const service = new OnboardingService(folderService, noteService, folderStore, selectionStore, notesStore);

		await service.runFirstRunOnboarding();

		expect(folderService.create).toHaveBeenCalledWith(null);
		expect(folderStore.renameFolder).toHaveBeenCalledWith('welcome-folder-id', 'Welcome');
		expect(noteService.create).toHaveBeenCalledWith('welcome-folder-id', { silent: true });
		expect(noteService.update).toHaveBeenCalledWith('welcome-note-id', expect.objectContaining({
			title: 'Welcome to Keloc Notes',
			content: expect.any(String)
		}), { updatedTimestamp: true });

		expect(folderService.select).toHaveBeenCalledWith('welcome-folder-id');
		expect(noteService.select).toHaveBeenCalledWith('welcome-note-id');
		expect(markLibraryAsUsed).toHaveBeenCalled();
	});

	it('should return isFirstRun: false when library has been used', async () => {
		vi.mocked(hasLibraryBeenUsed).mockResolvedValue(true);
		const service = new OnboardingService(folderService, noteService, folderStore, selectionStore, notesStore);

		const result = await service.runFirstRunOnboarding();

		expect(result.isFirstRun).toBe(false);
	});

	it('should return isFirstRun: false in E2E test environment', async () => {
		vi.mocked(isE2ETest).mockReturnValue(true);
		const service = new OnboardingService(folderService, noteService, folderStore, selectionStore, notesStore);

		const result = await service.runFirstRunOnboarding();

		expect(result.isFirstRun).toBe(false);
	});

	it('should return isFirstRun: true on first run', async () => {
		vi.mocked(hasLibraryBeenUsed).mockResolvedValue(false);
		const service = new OnboardingService(folderService, noteService, folderStore, selectionStore, notesStore);

		const result = await service.runFirstRunOnboarding();

		expect(result.isFirstRun).toBe(true);
	});
});
