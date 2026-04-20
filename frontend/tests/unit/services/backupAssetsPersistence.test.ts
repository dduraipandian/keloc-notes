import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { exportBackup, importBackup } from '$lib/backup/backup';
import { FolderStore } from '$lib/stores/folders.svelte';
import { NotesStore } from '$lib/stores/notes.svelte';
import { SelectionStore } from '$lib/stores/selection.svelte';
import { NoteService } from '$lib/stores/services/noteService';
import {
	getNoteAsset,
	putFolder,
	putNoteAsset,
	putNoteContent,
	putNoteMeta,
	withTransaction
} from '$lib/infrastructure/idbr';

describe('Backup image asset persistence', () => {
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

	it('exports note assets in a JSON-safe format alongside the owning note', async () => {
		const folderStore = new FolderStore();
		const notesStore = new NotesStore();
		const selectionStore = new SelectionStore(folderStore);
		const noteService = new NoteService(folderStore, notesStore, selectionStore);

		const folder = {
			id: 'folder-1',
			title: 'Projects',
			items: [],
			parentId: null,
			deletedAt: null,
			deletedBatchId: null,
			isFavorite: false
		};
		const note = {
			id: 'note-1',
			folderId: folder.id,
			title: 'Roadmap',
			summary: 'Contains screenshot',
			updatedAt: '2025-04-01T00:00:00.000Z',
			isFavorite: false,
			deletedAt: null,
			deletedBatchId: null,
			content: '',
			isContentLoaded: false
		};

		folderStore.folders.set(folder.id, folder as any);
		folderStore.items.push(folder.id);
		notesStore.notes.set(note.id, note as any);

		await putNoteMeta({
			id: note.id,
			folderId: note.folderId,
			title: note.title,
			summary: note.summary,
			updatedAt: note.updatedAt,
			isFavorite: note.isFavorite,
			deletedAt: note.deletedAt,
			deletedBatchId: note.deletedBatchId
		});
		await putNoteContent(note.id, '{"type":"doc"}');
		await putNoteAsset({
			id: 'asset-1',
			noteId: note.id,
			mimeType: 'image/webp',
			data: new Blob(['binary-image-data'], { type: 'image/webp' })
		});

		const json = await exportBackup(noteService, folderStore, notesStore);
		const backup = JSON.parse(json);

		expect(backup.notes).toHaveLength(1);
		expect(backup.notes[0].assets).toEqual([
			{
				id: 'asset-1',
				noteId: note.id,
				mimeType: 'image/webp',
				dataBase64: expect.any(String)
			}
		]);
		expect(backup.notes[0].assets[0].dataBase64).not.toBe('');
	});

	it('restores note assets from backup JSON so image references remain loadable', async () => {
		const backupJson = JSON.stringify({
			schemaVersion: 1,
			exportedAt: '2025-04-01T00:00:00.000Z',
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
					summary: 'Contains screenshot',
					updatedAt: '2025-04-01T00:00:00.000Z',
					isFavorite: false,
					deletedAt: null,
					deletedBatchId: null,
					content: '{"type":"doc","content":[{"type":"image","attrs":{"src":"asset:asset-1"}}]}',
					assets: [
						{
							id: 'asset-1',
							noteId: 'note-1',
							mimeType: 'image/webp',
							dataBase64: 'YmluYXJ5LWltYWdlLWRhdGE='
						}
					]
				}
			],
			settings: {
				applicationTheme: 'dark'
			}
		});

		await importBackup(backupJson, new FolderStore(), new NotesStore());

		const restoredAsset = await getNoteAsset('asset-1');
		expect(restoredAsset).toBeDefined();
		expect(restoredAsset?.noteId).toBe('note-1');
		expect(restoredAsset?.mimeType).toBe('image/webp');
		expect(restoredAsset?.data.size).toBeGreaterThan(0);

		const restoredFolders = new FolderStore();
		const restoredNotes = new NotesStore();
		const restoredSelection = new SelectionStore(restoredFolders);
		const restoredNoteService = new NoteService(restoredFolders, restoredNotes, restoredSelection);

		await restoredFolders.init();
		await restoredNotes.init();

		const reExportedJson = await exportBackup(restoredNoteService, restoredFolders, restoredNotes);
		const reExportedBackup = JSON.parse(reExportedJson);

		expect(reExportedBackup.notes[0].assets).toEqual([
			{
				id: 'asset-1',
				noteId: 'note-1',
				mimeType: 'image/webp',
				dataBase64: 'YmluYXJ5LWltYWdlLWRhdGE='
			}
		]);
	});
});
