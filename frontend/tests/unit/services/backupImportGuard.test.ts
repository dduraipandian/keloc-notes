import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { importBackup } from '$lib/backup/backup';
import { FolderStore } from '$lib/stores/folders.svelte';
import { NotesStore } from '$lib/stores/notes.svelte';
import {
	getAllFolders,
	getAllNotesMeta,
	getAllSettings,
	getNoteContent,
	hasLibraryBeenUsed,
	hasOnboardingBeenDone,
	markLibraryAsUsed,
	markOnboardingAsDone,
	putFolder,
	putNoteContent,
	putNoteMeta,
	withTransaction
} from '$lib/infrastructure/idbr';

describe('Backup import guard', () => {
	const backupJson = JSON.stringify({
		schemaVersion: 1,
		exportedAt: '2025-04-01T00:00:00.000Z',
		appVersion: '1.0.0',
		folders: [
			{
				id: 'folder-1',
				title: 'Imported Projects',
				items: [],
				parentId: null,
				deletedAt: null,
				deletedBatchId: null,
				isFavorite: false
			}
		],
		notes: [
			{
				id: 'note-1',
				folderId: 'folder-1',
				title: 'Imported Note',
				summary: 'Imported summary',
				updatedAt: '2025-04-01T00:00:00.000Z',
				isFavorite: false,
				deletedAt: null,
				deletedBatchId: null,
				content: 'Imported content'
			}
		],
		settings: {
			applicationTheme: 'dark'
		}
	});

	beforeEach(async () => {
		await withTransaction(
			['folders', 'notes_meta', 'notes_contents', 'settings', 'backups', 'note_assets'],
			'readwrite',
			async (tx) => {
				await tx.objectStore('folders').clear!();
				await tx.objectStore('notes_meta').clear!();
				await tx.objectStore('notes_contents').clear!();
				await tx.objectStore('settings').clear!();
				await tx.objectStore('backups').clear!();
				await tx.objectStore('note_assets').clear!();
			}
		);
	});

	it('allows import when only onboarding content exists but library not marked as used', async () => {
		await putFolder({
			id: 'welcome-folder',
			title: 'Welcome',
			items: [],
			parentId: null,
			deletedAt: null,
			deletedBatchId: null,
			isFavorite: false
		});
		await putNoteMeta({
			id: 'welcome-note',
			folderId: 'welcome-folder',
			title: 'Welcome to Keloc Notes',
			summary: 'Onboarding summary',
			updatedAt: '2025-04-01T00:00:00.000Z',
			isFavorite: false,
			deletedAt: null,
			deletedBatchId: null
		});
		await putNoteContent('welcome-note', 'Onboarding content');

		await importBackup(backupJson, new FolderStore(), new NotesStore());

		expect(await getAllFolders()).toEqual([
			{
				id: 'folder-1',
				title: 'Imported Projects',
				items: [],
				parentId: null,
				deletedAt: null,
				deletedBatchId: null,
				isFavorite: false
			}
		]);
		expect(await getNoteContent('note-1')).toBe('Imported content');
	});

	it('allows import when old onboarding marked the stock welcome content as used', async () => {
		await markOnboardingAsDone();
		await markLibraryAsUsed();
		await putFolder({
			id: 'welcome-folder',
			title: 'Welcome',
			items: [],
			parentId: null,
			deletedAt: null,
			deletedBatchId: null,
			isFavorite: false
		});
		await putNoteMeta({
			id: 'welcome-note',
			folderId: 'welcome-folder',
			title: 'Welcome to Keloc Notes',
			summary: 'Onboarding summary',
			updatedAt: '2025-04-01T00:00:00.000Z',
			isFavorite: false,
			deletedAt: null,
			deletedBatchId: null
		});
		await putNoteContent(
			'welcome-note',
			JSON.stringify({
				type: 'doc',
				content: [
					{
						type: 'paragraph',
						content: [{ type: 'text', text: 'A local-first, privacy-focused notes app built for speed.' }]
					}
				]
			})
		);

		await importBackup(backupJson, new FolderStore(), new NotesStore());

		expect(await getAllFolders()).toEqual([
			{
				id: 'folder-1',
				title: 'Imported Projects',
				items: [],
				parentId: null,
				deletedAt: null,
				deletedBatchId: null,
				isFavorite: false
			}
		]);
		expect(await getNoteContent('note-1')).toBe('Imported content');
	});

	it('rejects backup import when the library was previously used even if current data is empty', async () => {
		await markLibraryAsUsed();

		await expect(importBackup(backupJson, new FolderStore(), new NotesStore())).rejects.toThrow(
			'Failed to import backup: Backup import is only allowed on a new app.'
		);

		expect(await getAllFolders()).toEqual([]);
		expect(await getAllNotesMeta()).toEqual([]);
	});

	it('allows backup import when the app has no persisted folders or notes', async () => {
		await importBackup(backupJson, new FolderStore(), new NotesStore());

		expect(await getAllFolders()).toEqual([
			{
				id: 'folder-1',
				title: 'Imported Projects',
				items: [],
				parentId: null,
				deletedAt: null,
				deletedBatchId: null,
				isFavorite: false
			}
		]);
		expect(await getAllNotesMeta()).toEqual([
			{
				id: 'note-1',
				folderId: 'folder-1',
				title: 'Imported Note',
				summary: 'Imported summary',
				updatedAt: '2025-04-01T00:00:00.000Z',
				isFavorite: false,
				deletedAt: null,
				deletedBatchId: null
			}
		]);
		expect(await getNoteContent('note-1')).toBe('Imported content');
		expect(await getAllSettings()).toEqual({
			selectedFolderID: null,
			selectedNoteID: null,
			sidebarWidth: null,
			noteListWidth: null,
			applicationTheme: 'dark',
			folderAccentColor: null,
			editorToolbar: null,
			enabledLanguages: null,
			imageProcessingConcurrency: null,
			backupRetentionDays: null
		});
		expect(await hasOnboardingBeenDone()).toBe(true);
		expect(await hasLibraryBeenUsed()).toBe(true);
	});
});
