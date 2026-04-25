import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { importBackup } from '$lib/backup/backup';
import { FolderStore } from '$lib/stores/folders.svelte';
import { NotesStore } from '$lib/stores/notes.svelte';
import {
	getAllFolders,
	getAllNotesMeta,
	getAllSettings,
	getNoteAsset,
	getNoteContent,
	withTransaction
} from '$lib/infrastructure/idbr';

describe('Backup restore guarantees', () => {
	function buildBackup(overrides: Record<string, unknown> = {}) {
		return JSON.stringify({
			schemaVersion: 1,
			exportedAt: '2026-04-25T00:00:00.000Z',
			appVersion: '1.0.0',
			folders: [
				{
					id: 'folder-1',
					title: 'Projects',
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
					title: 'Roadmap',
					summary: 'Restore contract',
					updatedAt: '2026-04-25T00:00:00.000Z',
					isFavorite: false,
					deletedAt: null,
					deletedBatchId: null,
					content: 'Restored content'
				}
			],
			settings: {
				applicationTheme: 'dark'
			},
			...overrides
		});
	}

	async function clearDatabase() {
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
	}

	async function expectNoPartialRestore() {
		expect(await getAllFolders()).toEqual([]);
		expect(await getAllNotesMeta()).toEqual([]);
		expect(await getNoteContent('note-1')).toBe('');
		expect(await getNoteAsset('asset-1')).toBeUndefined();
		expect(await getAllSettings()).toEqual({
			selectedFolderID: null,
			selectedNoteID: null,
			sidebarWidth: null,
			noteListWidth: null,
			applicationTheme: null,
			folderAccentColor: null,
			editorToolbar: null,
			enabledLanguages: null,
			imageProcessingConcurrency: null,
			backupRetentionDays: null
		});
	}

	beforeEach(async () => {
		await clearDatabase();
	});

	it('rejects unsupported schema versions without partial imported state', async () => {
		await expect(
			importBackup(buildBackup({ schemaVersion: 999 }), new FolderStore(), new NotesStore())
		).rejects.toThrow('Failed to import backup: Unsupported backup schema version: 999');

		await expectNoPartialRestore();
	});

	it('rejects malformed JSON without partial imported state', async () => {
		await expect(importBackup('{not-json', new FolderStore(), new NotesStore())).rejects.toThrow(
			'Failed to import backup:'
		);

		await expectNoPartialRestore();
	});

	it('rejects asset restore failures without partial imported state', async () => {
		await expect(
			importBackup(
				buildBackup({
					notes: [
						{
							id: 'note-1',
							folderId: 'folder-1',
							title: 'Roadmap',
							summary: 'Restore contract',
							updatedAt: '2026-04-25T00:00:00.000Z',
							isFavorite: false,
							deletedAt: null,
							deletedBatchId: null,
							content: 'Restored content',
							assets: [
								{
									id: 'asset-1',
									noteId: 'note-1',
									mimeType: 'image/webp',
									dataBase64: '%'
								}
							]
						}
					]
				}),
				new FolderStore(),
				new NotesStore()
			)
		).rejects.toThrow('Failed to import backup:');

		await expectNoPartialRestore();
	});

	it('rejects malformed settings without partial imported state', async () => {
		await expect(
			importBackup(buildBackup({ settings: ['dark'] }), new FolderStore(), new NotesStore())
		).rejects.toThrow('Failed to import backup: Backup settings must be an object.');

		await expectNoPartialRestore();
	});
});
