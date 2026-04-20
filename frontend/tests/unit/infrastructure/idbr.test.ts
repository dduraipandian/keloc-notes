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
	permanentDeleteNoteTransactionally,
	putNoteAsset,
	getNoteAsset,
	deleteNoteAsset,
	deleteNoteAssetsByNoteId
} from '../../../src/lib/infrastructure/idbr';
import { UIStore } from '../../../src/lib/stores/dialog.svelte';
import { setDatabaseBlockedHandler } from '../../../src/lib/infrastructure/idbr';

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
		expect(db.objectStoreNames).toContain('note_assets');
	});

	it('should surface a user-visible dialog when the database is blocked', () => {
		const mockUIStore = new UIStore();
		const confirmSpy = vi.spyOn(mockUIStore, 'confirmAppQuit').mockImplementation(() => {});
		
		setDatabaseBlockedHandler((current, blocked) => {
			mockUIStore.confirmAppQuit(
				'Database blocked',
				'Another mdnotes window is open and preventing the update. Please close other windows to avoid data loss.',
				() => {}
			);
		});

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

		it('should return editorToolbar setting with default null', async () => {
			const settings = await getAllSettings();
			expect(settings.editorToolbar).toBeNull();
		});

		it('should put and get editorToolbar setting', async () => {
			await putSetting('editorToolbar', 'fixed');
			const settings = await getAllSettings();
			expect(settings.editorToolbar).toBe('fixed');
		});

		it('should return enabledLanguages setting with default null', async () => {
			const settings = await getAllSettings();
			expect(settings.enabledLanguages).toBeNull();
		});

		it('should put and get enabledLanguages setting as array', async () => {
			const languages = ['javascript', 'python', 'go'];
			await putSetting('enabledLanguages', languages);
			const settings = await getAllSettings();
			expect(settings.enabledLanguages).toEqual(languages);
		});

		it('should return imageProcessingConcurrency setting with default null', async () => {
			const settings = await getAllSettings();
			expect(settings.imageProcessingConcurrency).toBeNull();
		});

		it('should put and get imageProcessingConcurrency setting', async () => {
			await putSetting('imageProcessingConcurrency', 4);
			const settings = await getAllSettings();
			expect(settings.imageProcessingConcurrency).toBe(4);
		});
	});

	describe('Note Assets CRUD', () => {
		it('should put and get a note asset', async () => {
			const blob = new Blob(['image data'], { type: 'image/webp' });
			const asset = {
				id: 'asset-1',
				noteId: 'n1',
				mimeType: 'image/webp',
				data: blob
			};
			await putNoteAsset(asset);
			const result = await getNoteAsset('asset-1');
			expect(result).toBeDefined();
			expect(result?.id).toBe('asset-1');
			expect(result?.noteId).toBe('n1');
			expect(result?.mimeType).toBe('image/webp');
		});

		it('should delete a note asset', async () => {
			const blob = new Blob(['test'], { type: 'image/webp' });
			await putNoteAsset({
				id: 'asset-1',
				noteId: 'n1',
				mimeType: 'image/webp',
				data: blob
			});
			await deleteNoteAsset('asset-1');
			const result = await getNoteAsset('asset-1');
			expect(result).toBeUndefined();
		});

		it('should delete all assets for a note by noteId', async () => {
			const blob1 = new Blob(['img1'], { type: 'image/webp' });
			const blob2 = new Blob(['img2'], { type: 'image/webp' });
			const blob3 = new Blob(['img3'], { type: 'image/webp' });

			// Add assets for note n1
			await putNoteAsset({
				id: 'asset-1',
				noteId: 'n1',
				mimeType: 'image/webp',
				data: blob1
			});
			await putNoteAsset({
				id: 'asset-2',
				noteId: 'n1',
				mimeType: 'image/webp',
				data: blob2
			});

			// Add asset for note n2
			await putNoteAsset({
				id: 'asset-3',
				noteId: 'n2',
				mimeType: 'image/webp',
				data: blob3
			});

			// Delete all assets for n1
			await deleteNoteAssetsByNoteId('n1');

			// Verify n1 assets are gone
			expect(await getNoteAsset('asset-1')).toBeUndefined();
			expect(await getNoteAsset('asset-2')).toBeUndefined();

			// Verify n2 asset still exists
			expect(await getNoteAsset('asset-3')).toBeDefined();
		});

		it('should create note_assets store with noteId index on v4 migration', async () => {
			const db = await initDB();
			const storeNames = Array.from(db.objectStoreNames);
			expect(storeNames).toContain('note_assets');
		});
	});

	describe('Permanent Delete Note (Single)', () => {
		it('should CORRECTLY backup content even if called with the path signature (3 args)', async () => {
			const meta = { id: 'n1', title: 'Note 1' };
			const content = 'Actual Markdown Content';
			const archivedAt = Date.now();
			await putNoteMeta(meta);
			await putNoteContent('n1', content);

			// New robust signature (3 args)
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
			expect(backup.data).toEqual({ ...meta, content, assets: [] });
			expect(backup.path).toBe('Home / To Delete');
			expect(backup.archivedAt).toBe(archivedAt);
		});

		it('should move all note assets into the backup record and remove them from note_assets', async () => {
			const meta = { id: 'n-assets', title: 'Note With Assets' };
			const content = 'Body with images';
			const archivedAt = Date.now();
			const asset1 = {
				id: 'asset-1',
				noteId: meta.id,
				mimeType: 'image/webp',
				data: new Blob(['img-1'], { type: 'image/webp' })
			};
			const asset2 = {
				id: 'asset-2',
				noteId: meta.id,
				mimeType: 'image/png',
				data: new Blob(['img-2'], { type: 'image/png' })
			};
			const foreignAsset = {
				id: 'asset-3',
				noteId: 'other-note',
				mimeType: 'image/webp',
				data: new Blob(['img-3'], { type: 'image/webp' })
			};

			await putNoteMeta(meta);
			await putNoteContent(meta.id, content);
			await putNoteAsset(asset1);
			await putNoteAsset(asset2);
			await putNoteAsset(foreignAsset);

			await permanentDeleteNoteTransactionally(meta, 'Home / Images', archivedAt);

			const db = await initDB();
			const backup = await db.get('backups', 'note_n-assets');

			expect(backup).toBeDefined();
			expect(backup.data.content).toBe(content);
			expect(backup.data.assets).toHaveLength(2);
			expect(backup.data.assets).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						id: asset1.id,
						noteId: asset1.noteId,
						mimeType: asset1.mimeType
					}),
					expect.objectContaining({
						id: asset2.id,
						noteId: asset2.noteId,
						mimeType: asset2.mimeType
					})
				])
			);
			expect(await getNoteAsset(asset1.id)).toBeUndefined();
			expect(await getNoteAsset(asset2.id)).toBeUndefined();
			expect(await getNoteAsset(foreignAsset.id)).toBeDefined();
		});
	});
});
