import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NoteService } from '../../../src/lib/stores/services/noteService';
import { FolderStore } from '../../../src/lib/stores/folders.svelte';
import { NotesStore } from '../../../src/lib/stores/notes.svelte';
import { SelectionStore } from '../../../src/lib/stores/selection.svelte';
import { initMenuBridge } from '../../../src/lib/menu/menuBridge.svelte';
import { ThemeStore } from '../../../src/lib/stores/theme.svelte';
import { UIStateStore } from '../../../src/lib/stores/uiState.svelte';
import { EventsOn } from '../../../src/lib/wailsjs/runtime/runtime';
import { ImportNotesZip } from '../../../src/lib/wailsjs/go/main/App';
import * as Repositories from '../../../src/lib/infrastructure/repositories';

vi.mock('../../../src/lib/wailsjs/runtime/runtime', () => ({
	EventsOn: vi.fn(),
	EventsEmit: vi.fn()
}));

vi.mock('../../../src/lib/wailsjs/go/main/App', () => ({
	ImportNotesZip: vi.fn(),
	ExportNoteToFile: vi.fn(),
	ExportNotesZip: vi.fn(),
	UpdateMenuState: vi.fn(),
	SaveBackupFile: vi.fn(),
	ReadBackupFile: vi.fn()
}));

const { mockFolderService, mockNoteService } = vi.hoisted(() => ({
	mockFolderService: {
		ensurePath: vi.fn().mockReturnValue(null)
	},
	mockNoteService: {
		create: vi.fn(),
		update: vi.fn()
	}
}));

vi.mock('../../../src/lib/stores/services', () => ({
	folderService: mockFolderService,
	noteService: mockNoteService,
	trashService: {}
}));

describe('NoteService', () => {
    let mockFolderStore: FolderStore;
    let selectionStore: SelectionStore;
    let mockNotesStore: NotesStore;

	beforeEach(() => {
		vi.clearAllMocks();
        mockFolderStore = new FolderStore();
        selectionStore = new SelectionStore(mockFolderStore);
        mockNotesStore = new NotesStore();
		
		(mockNotesStore as any).isInitialized = true;
		(mockFolderStore as any).isInitialized = true;
	});

	// ... [Rest of NoteService tests]
	it('should create in the selected regular folder and return the new ID', () => {
		const folders = {
			findItemById: vi.fn().mockReturnValue({ id: 'work', profile: 'regular' }),
			getDefaultFolderId: vi.fn()
		};
		const selection = {
			selectedFolderID: null,
			selectFolder: vi.fn(),
			getSelectedFolder: vi.fn(),
			clearFolderIfSelected: vi.fn()
		};
		const notes = { createNote: vi.fn().mockReturnValue('new-note-id') };

		const result = new NoteService(folders as any, notes as any, selection as any).create('work');

		expect(notes.createNote).toHaveBeenCalledWith('work');
		expect(selection.selectFolder).toHaveBeenCalledWith('work');
		expect(result).toBe('new-note-id');
		expect(folders.getDefaultFolderId).not.toHaveBeenCalled();
	});

	it('should fall back to the default folder for trash/favorites views', () => {
		const folders = {
			findItemById: vi.fn().mockReturnValue({ id: 'deleted-notes', profile: 'trash' }),
			getDefaultFolderId: vi.fn().mockReturnValue('notes')
		};
		const selection = {
			selectedFolderID: null,
			selectFolder: vi.fn(),
			getSelectedFolder: vi.fn(),
			clearFolderIfSelected: vi.fn()
		};
		const notes = { createNote: vi.fn() };

		new NoteService(folders as any, notes as any, selection as any).create('deleted-notes');

		expect(folders.getDefaultFolderId).toHaveBeenCalled();
		expect(notes.createNote).toHaveBeenCalledWith('notes');
		expect(selection.selectFolder).toHaveBeenCalledWith('notes');
	});

	it('should allow creation in the home view', () => {
		const folders = {
			findItemById: vi.fn().mockReturnValue({ id: 'home', profile: 'home' }),
			getDefaultFolderId: vi.fn()
		};
		const selection = {
			selectedFolderID: null,
			selectFolder: vi.fn(),
			getSelectedFolder: vi.fn(),
			clearFolderIfSelected: vi.fn()
		};
		const notes = { createNote: vi.fn() };

		new NoteService(folders as any, notes as any, selection as any).create('home');

		expect(folders.getDefaultFolderId).not.toHaveBeenCalled();
		expect(notes.createNote).toHaveBeenCalledWith('home');
	});

	it('should delegate note updates', () => {
		const folders = { findItemById: (id: string) => ({ id, profile: ['home', 'favorites', 'deleted-notes', 'trash'].includes(id) ? (id === 'deleted-notes' ? 'trash' : id) : 'regular' }) };
		const notes = { updateNote: vi.fn() };

		new NoteService(folders as any, notes as any, {} as any).update('note-1', { title: 'Updated' });

		expect(notes.updateNote).toHaveBeenCalledWith('note-1', { title: 'Updated' }, undefined);
	});

	it('should delegate note selection', () => {
		const folders = { findItemById: (id: string) => ({ id, profile: ['home', 'favorites', 'deleted-notes', 'trash'].includes(id) ? (id === 'deleted-notes' ? 'trash' : id) : 'regular' }) };
		const notes = { selectNote: vi.fn() };

		new NoteService(folders as any, notes as any, {} as any).select('note-1');

		expect(notes.selectNote).toHaveBeenCalledWith('note-1');
	});

	it('should delegate note favorite toggles', () => {
		const notes = { setFavorite: vi.fn() };

		new NoteService({ findItemById: (id: string) => ({ id, profile: ['home', 'favorites', 'deleted-notes', 'trash'].includes(id) ? id : 'regular' }) } as any, notes as any, {} as any).setFavorite('note-1', true);

		expect(notes.setFavorite).toHaveBeenCalledWith('note-1', true);
	});

	it('should select the next note after deleting the current note', () => {
		const folders = {
			findItemById: vi.fn().mockReturnValue({ id: 'f1', profile: 'regular' })
		};
		const selection = {
			selectedFolderID: 'f1',
			selectFolder: vi.fn(),
			getSelectedFolder: vi.fn().mockReturnValue({ id: 'f1', profile: 'regular' }),
			clearFolderIfSelected: vi.fn()
		};
		const notes = {
			listNotes: vi.fn().mockReturnValue([
				{ id: 'note-1', folderId: 'f1', updatedAt: '2025-01-02T00:00:00Z', deletedAt: null, summary: '', isFavorite: false, isContentLoaded: true },
				{ id: 'note-2', folderId: 'f1', updatedAt: '2025-01-01T00:00:00Z', deletedAt: null, summary: '', isFavorite: false, isContentLoaded: true }
			]),
			deleteNote: vi.fn(),
			selectNote: vi.fn()
		};

		new NoteService(folders as any, notes as any, selection as any).delete('note-1', 'batch-1');

		expect(notes.deleteNote).toHaveBeenCalledWith('note-1', expect.any(Number), 'batch-1');
		expect(notes.selectNote).toHaveBeenCalledWith('note-2');
	});

	it('should clear selection when deleting the last visible note', () => {
		const folders = {
			findItemById: vi.fn().mockReturnValue({ id: 'f1', profile: 'regular' })
		};
		const selection = {
			selectedFolderID: 'f1',
			selectFolder: vi.fn(),
			getSelectedFolder: vi.fn().mockReturnValue({ id: 'f1', profile: 'regular' }),
			clearFolderIfSelected: vi.fn()
		};
		const notes = {
			listNotes: vi
				.fn()
				.mockReturnValue([
					{ id: 'note-1', folderId: 'f1', updatedAt: '2025-01-02T00:00:00Z', deletedAt: null }
				]),
			deleteNote: vi.fn(),
			selectNote: vi.fn()
		};

		new NoteService(folders as any, notes as any, selection as any).delete('note-1', 'batch-1');

		expect(notes.selectNote).toHaveBeenCalledWith(null);
	});

	it('should return notes for a folder sorted by updatedAt descending', () => {
		const folders = { findItemById: vi.fn().mockImplementation((id) => ({ id, profile: ['home', 'favorites', 'deleted-notes', 'trash'].includes(id) ? id : 'regular' })) };
		const notes = {
			listNotes: vi.fn().mockReturnValue([
				{ id: '1', folderId: 'f1', updatedAt: '2020-01-01T00:00:00Z', deletedAt: null },
				{ id: '2', folderId: 'f1', updatedAt: '2025-01-01T00:00:00Z', deletedAt: null }
			])
		};

		const result = new NoteService(folders as any, notes as any, {} as any).getNotesForFolder('f1');

		expect(result.map((note: any) => note.id)).toEqual(['2', '1']);
	});

	it('should return deleted notes for trash folder', () => {
		const folders = { findItemById: (id: string) => ({ id, profile: ['home', 'favorites', 'deleted-notes', 'trash'].includes(id) ? (id === 'deleted-notes' ? 'trash' : id) : 'regular' }) };
		const notes = {
			listNotes: vi.fn().mockReturnValue([
				{ id: '1', folderId: 'f1', deletedAt: 123, updatedAt: '2025-01-01T00:00:00Z' },
				{ id: '2', folderId: 'f1', deletedAt: null, updatedAt: '2024-01-01T00:00:00Z' }
			])
		};

		const result = new NoteService(folders as any, notes as any, {} as any).getNotesForFolder('deleted-notes', 'trash');

		expect(result.map((note: any) => note.id)).toEqual(['1']);
	});

	it('should return favorite notes for the favorites virtual view', () => {
		const notes = {
			listNotes: vi.fn().mockReturnValue([
				{
					id: '1',
					folderId: 'f1',
					isFavorite: true,
					deletedAt: null,
					updatedAt: '2025-01-01T00:00:00Z'
				},
				{
					id: '2',
					folderId: 'f1',
					isFavorite: false,
					deletedAt: null,
					updatedAt: '2024-01-01T00:00:00Z'
				},
				{
					id: '3',
					folderId: 'f1',
					isFavorite: true,
					deletedAt: 123,
					updatedAt: '2023-01-01T00:00:00Z'
				}
			])
		};

		const result = new NoteService({ findItemById: (id: string) => ({ id, profile: ['home', 'favorites', 'deleted-notes', 'trash'].includes(id) ? id : 'regular' }) } as any, notes as any, {} as any).getNotesForFolder(
			'favorites',
			'favorites'
		);

		expect(result.map((note: any) => note.id)).toEqual(['1']);
	});

	it('should count notes using the folder-aware query rules', () => {
		const folders = {
			findItemById: vi.fn().mockImplementation((id) => (id ? { id, profile: 'regular' } : null))
		};
		const notes = {
			listNotes: vi.fn().mockReturnValue([
				{ id: '1', folderId: 'f1', deletedAt: null, updatedAt: '2025-01-01T00:00:00Z', summary: '', isFavorite: false, isContentLoaded: true },
				{ id: '2', folderId: 'f1', deletedAt: null, updatedAt: '2024-01-01T00:00:00Z', summary: '', isFavorite: false, isContentLoaded: true },
				{ id: '3', folderId: 'f2', deletedAt: null, updatedAt: '2023-01-01T00:00:00Z', summary: '', isFavorite: false, isContentLoaded: true }
			]),
			getNoteCount: vi.fn().mockReturnValue(2),
			getDeletedNotes: vi.fn(() => [])
		};

		const count = new NoteService(folders as any, notes as any, {} as any).getNoteCountForFolder('f1');

		expect(count).toBe(2);
	});

	it('should include deleted subtree notes when viewing a deleted folder', () => {
		const deletedFolder = { id: 'A', deletedAt: 123, deletedBatchId: 'batch-a', items: ['B'], profile: 'regular' };
		const childFolder = { id: 'B', deletedAt: 123, deletedBatchId: 'batch-a', items: [], profile: 'regular' };
		const folders = {
			findItemById: vi.fn().mockImplementation((id: string) => {
				if (id === 'A') return deletedFolder;
				if (id === 'B') return childFolder;
				return null;
			})
		};
		const notes = {
			listNotes: vi.fn().mockReturnValue([
				{ id: 'note-x', folderId: 'B', deletedAt: 123, deletedBatchId: 'batch-a', updatedAt: '2025-01-01T00:00:00Z' },
				{ id: 'note-y', folderId: 'B', deletedAt: 123, deletedBatchId: 'batch-b', updatedAt: '2024-01-01T00:00:00Z' }
			])
		};

		const result = new NoteService(folders as any, notes as any, {} as any).getNotesForFolder('A');

		expect(result.map((note: any) => note.id)).toEqual(['note-x']);
	});

	it('should return notes enriched for export', async () => {
		const folders = {
			findItemById: vi.fn().mockReturnValue({ id: 'f1', title: 'Work', parentId: null })
		};
		const notes = {
			getNote: vi.fn().mockReturnValue({ id: 'n1', title: 'T1', folderId: 'f1', updatedAt: 1000 }),
			getBulkNoteContents: vi.fn().mockResolvedValue({ 'n1': 'Content' })
		};
		const service = new NoteService(folders as any, notes as any, {} as any);
		// Mock getFolderPath manually for simplicity in this unit test
		(service as any).getFolderPath = vi.fn().mockReturnValue('Work');

		const result = await service.getNotesForExport(['n1']);

		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({
			title: 'T1',
			content: 'Content',
			folderPath: 'Work',
			updatedAt: new Date(1000).toISOString()
		});
	});

	describe('Import Mismatch Bug (RED)', () => {
		it('should pass the string ID to noteService.update, not the full object', async () => {
			const handlers: Record<string, Function> = {};
			vi.mocked(EventsOn).mockImplementation((event, handler) => {
				handlers[event] = handler;
				return () => {};
			});

			vi.mocked(ImportNotesZip).mockResolvedValue([
				{
					Title: 'Imported Note',
					Content: 'Imported Content',
					FolderPath: ''
				}
			]);

			const mockNote = { id: 'new-id-123', title: 'Untitled Note' };
			mockNoteService.create.mockReturnValue(mockNote as any);

			const mockUIStateStore = new UIStateStore();
			const mockThemeStore = new ThemeStore();
			initMenuBridge({ 
				uiState: mockUIStateStore, 
				theme: mockThemeStore,
				ui: {} as any,
				selection: {} as any,
				folders: mockFolderStore,
				notes: mockNotesStore,
				folderService: mockFolderService as any,
				noteService: mockNoteService as any,
				trashService: {} as any
			});

			// Trigger import
			await handlers['menu:import-markdown']();

			expect(mockNoteService.update).toHaveBeenCalledWith('new-id-123', expect.objectContaining({
				title: 'Imported Note'
			}));

			expect(mockNoteService.create).toHaveBeenCalledWith(null, expect.objectContaining({ silent: true }));
		});
	});
});
