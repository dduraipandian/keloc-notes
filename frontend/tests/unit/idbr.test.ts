import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { 
	initDB, 
	handleDatabaseBlocked,
	putFolder, 
	getFolder, 
	deleteFolder, 
	getAllFolders, 
	putNote, 
	getNote, 
	deleteNote, 
	getAllNotes, 
	putSetting, 
	getSetting, 
	getAllSettings,
	permanentDeleteNoteTransactionally
} from '../../src/lib/stores/idbr';
import { uiStore } from '../../src/lib/stores/dialog.svelte';

describe('IndexedDB Wrapper (idbr.ts)', () => {
	beforeEach(async () => {
		// No explicit reset needed for fake-indexeddb as we can just overwrite the DB if needed,
		// but typically we should clear the object stores.
		// For simplicity, we just use a fresh environment for each test.
	});

	it('should initialize the database and create stores', async () => {
		const db = await initDB();
		expect(db.name).toBe('mdnotes-db');
		expect(db.objectStoreNames).toContain('folders');
		expect(db.objectStoreNames).toContain('notes');
		expect(db.objectStoreNames).toContain('settings');
		expect(db.objectStoreNames).toContain('backups');
	});

	it('should surface a user-visible dialog when the database is blocked', () => {
		const confirmSpy = vi.spyOn(uiStore, 'confirmAppQuit').mockImplementation(() => {});

		handleDatabaseBlocked(1, 2);

		expect(confirmSpy).toHaveBeenCalledWith(
			'Database blocked',
			expect.stringContaining('Another mdnotes window is open'),
			expect.any(Function)
		);
	});

	describe('Folder CRUD', () => {
		it('should put and get a folder', async () => {
			const folder = { id: 'f1', title: 'Test Folder', items: [] };
			await putFolder(folder);
			const result = await getFolder('f1');
			expect(result).toEqual(folder);
		});

		it('should return all folders', async () => {
			const f1 = { id: 'f1', title: 'Folder 1', items: [] };
			const f2 = { id: 'f2', title: 'Folder 2', items: [] };
			await putFolder(f1);
			await putFolder(f2);
			const all = await getAllFolders();
			expect(all).toContainEqual(f1);
			expect(all).toContainEqual(f2);
		});

		it('should delete a folder', async () => {
			await putFolder({ id: 'f1', title: 'Delete Me' });
			await deleteFolder('f1');
			const result = await getFolder('f1');
			expect(result).toBeUndefined();
		});
	});

	describe('Note CRUD', () => {
		it('should put and get a note', async () => {
			const note = { id: 'n1', title: 'Note 1', content: 'Hello' };
			await putNote(note);
			const result = await getNote('n1');
			expect(result).toEqual(note);
		});

		it('should return all notes', async () => {
			const n1 = { id: 'n1', title: 'N1' };
			const n2 = { id: 'n2', title: 'N2' };
			await putNote(n1);
			await putNote(n2);
			const all = await getAllNotes();
			expect(all).toContainEqual(n1);
			expect(all).toContainEqual(n2);
		});
	});

	describe('Settings CRUD', () => {
		it('should put and get a setting', async () => {
			await putSetting('selectedNoteID', 'test-id');
			const result = await getSetting('selectedNoteID');
			expect(result).toBe('test-id');
		});

		it('should return all settings with defaults', async () => {
			await putSetting('selectedNoteID', 'n1');
			await putSetting('sidebarWidth', 280);
			await putSetting('noteListWidth', 360);
			const settings = await getAllSettings();
			expect(settings.selectedNoteID).toBe('n1');
			expect(settings.selectedFolderID).toBeNull(); // Default
			expect(settings.sidebarWidth).toBe(280);
			expect(settings.noteListWidth).toBe(360);
		});
	});

		describe('Transactional Operations', () => {
			it('should archive and delete a note transactionally', async () => {
				const note = {
					id: 'n1',
					title: 'To Delete',
					content: 'Some content',
					folderId: null,
					updatedAt: new Date().toISOString()
				};
				await putNote(note);
				
				const archivedAt = Date.now();
			await permanentDeleteNoteTransactionally(note, 'Home / To Delete', archivedAt);
			
			// Verify note is gone from notes store
			const fetchedNote = await getNote('n1');
			expect(fetchedNote).toBeUndefined();
			
			// Verify note is in backups store
			const db = await initDB();
			const backup = await db.get('backups', 'note_n1');
			expect(backup).toBeDefined();
			expect(backup.data).toEqual(note);
			expect(backup.path).toBe('Home / To Delete');
			expect(backup.archivedAt).toBe(archivedAt);
		});
	});
});
