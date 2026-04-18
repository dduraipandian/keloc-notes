import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { 
	initDB, 
	handleDatabaseBlocked,
	putFolder, 
	getFolder, 
	deleteFolder, 
	getAllFolders, 
	putNoteMeta, 
	getNoteMeta, 
	putNoteContent, 
	getNoteContent, 
	deleteNote, 
	getAllNotesMeta, 
	putSetting, 
	getSetting, 
	getAllSettings,
	permanentDeleteNoteTransactionally
} from '../../src/lib/stores/idbr';
import { uiStore } from '../../src/lib/stores/dialog.svelte';

describe('IndexedDB Wrapper (idbr.ts)', () => {
	beforeEach(async () => {
		// Fresh environment for each test via fake-indexeddb
	});

	it('should initialize the database and create stores', async () => {
		const db = await initDB();
		expect(db.name).toBe('mdnotes-db');
		expect(db.objectStoreNames).toContain('folders');
		expect(db.objectStoreNames).toContain('notes_meta');
		expect(db.objectStoreNames).toContain('notes_contents');
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
		it('should put and get note metadata', async () => {
			const meta = { id: 'n1', title: 'Note 1', summary: 'Summary' };
			await putNoteMeta(meta);
			const result = await getNoteMeta('n1');
			expect(result).toEqual(meta);
		});

		it('should put and get note content', async () => {
			await putNoteContent('n1', 'Hello World');
			const result = await getNoteContent('n1');
			expect(result).toBe('Hello World');
		});

		it('should return all notes metadata', async () => {
			const n1 = { id: 'n1', title: 'N1' };
			const n2 = { id: 'n2', title: 'N2' };
			await putNoteMeta(n1);
			await putNoteMeta(n2);
			const all = await getAllNotesMeta();
			expect(all).toContainEqual(n1);
			expect(all).toContainEqual(n2);
		});

		it('should delete a note from both stores', async () => {
			await putNoteMeta({ id: 'n1', title: 'T' });
			await putNoteContent('n1', 'C');
			await deleteNote('n1');
			
			const meta = await getNoteMeta('n1');
			const content = await getNoteContent('n1');
			expect(meta).toBeUndefined();
			expect(content).toBe('');
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
			await putSetting('applicationTheme', 'dark');
			const settings = await getAllSettings();
			expect(settings.selectedNoteID).toBe('n1');
			expect(settings.selectedFolderID).toBeNull(); // Default
			expect(settings.sidebarWidth).toBe(280);
			expect(settings.noteListWidth).toBe(360);
			expect(settings.applicationTheme).toBe('dark');
		});
	});

	describe('Transactional Operations', () => {
		it('should archive and delete a note transactionally', async () => {
			const meta = {
				id: 'n1',
				title: 'To Delete',
				folderId: null,
				updatedAt: new Date().toISOString()
			};
			const content = 'Some content';
			await putNoteMeta(meta);
			await putNoteContent('n1', content);
			
			const archivedAt = Date.now();
			await permanentDeleteNoteTransactionally(meta, 'Home / To Delete', archivedAt);
			
			// Verify note is gone from notes stores
			const fetchedMeta = await getNoteMeta('n1');
			expect(fetchedMeta).toBeUndefined();
			const fetchedContent = await getNoteContent('n1');
			expect(fetchedContent).toBe('');
			
			// Verify note is in backups store
			const db = await initDB();
			const backup = await db.get('backups', 'note_n1');
			expect(backup).toBeDefined();
			expect(backup.data).toEqual({ ...meta, content });
			expect(backup.path).toBe('Home / To Delete');
			expect(backup.archivedAt).toBe(archivedAt);
		});
	});
});
