import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { exportBackup, importBackup } from '$lib/backup/backup';
import { FolderStore } from '$lib/stores/folders.svelte';
import { NotesStore } from '$lib/stores/notes.svelte';
import { SelectionStore } from '$lib/stores/selection.svelte';
import { NoteService } from '$lib/stores/services/noteService';
import {
	getAllFolders,
	getAllNotesMeta,
	getAllSettings,
	getNoteContent,
	putFolder,
	putNoteContent,
	putNoteMeta,
	putSetting,
	withTransaction
} from '$lib/infrastructure/idbr';

describe('Backup persistence', () => {
	beforeEach(async () => {
		localStorage.clear();

		await withTransaction(
			['folders', 'notes_meta', 'notes_contents', 'settings'],
			'readwrite',
			async (tx) => {
				await tx.objectStore('folders').clear!();
				await tx.objectStore('notes_meta').clear!();
				await tx.objectStore('notes_contents').clear!();
				await tx.objectStore('settings').clear!();
			}
		);
	});

	it('exports persisted settings and full note records instead of localStorage and markdown DTOs', async () => {
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
		folderStore.folders.set(folder.id, folder as any);
		folderStore.items.push(folder.id);

		const note = {
			id: 'note-1',
			folderId: folder.id,
			title: 'Roadmap',
			summary: 'Q2 priorities',
			updatedAt: '2025-04-01T00:00:00.000Z',
			isFavorite: true,
			deletedAt: null,
			deletedBatchId: null,
			content: '',
			isContentLoaded: false
		};
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
		await putNoteContent(note.id, 'Durable content from IndexedDB');
		await putSetting('applicationTheme', 'dark');
		await putSetting('folderAccentColor', 'amber');
		await putSetting('sidebarWidth', 280);
		await putSetting('noteListWidth', 360);
		await putSetting('selectedFolderID', folder.id);
		await putSetting('selectedNoteID', note.id);

		localStorage.setItem('applicationTheme', 'light');
		localStorage.setItem('folderAccentColor', 'blue');
		localStorage.setItem('sidebarWidth', '111');
		localStorage.setItem('noteListWidth', '222');

		const json = await exportBackup(noteService, folderStore, notesStore);
		const backup = JSON.parse(json);

		expect(backup.settings).toEqual({
			selectedFolderID: folder.id,
			selectedNoteID: note.id,
			sidebarWidth: 280,
			noteListWidth: 360,
			applicationTheme: 'dark',
			folderAccentColor: 'amber',
			editorToolbar: null,
			enabledLanguages: null,
			imageProcessingConcurrency: null
		});
		expect(backup.notes).toEqual([
			{
				id: note.id,
				folderId: folder.id,
				title: 'Roadmap',
				summary: 'Q2 priorities',
				updatedAt: '2025-04-01T00:00:00.000Z',
				isFavorite: true,
				deletedAt: null,
				deletedBatchId: null,
				content: 'Durable content from IndexedDB'
			}
		]);
	});

	it('exports backup from IndexedDB even when live stores are empty during startup recovery', async () => {
		const emptyFolderStore = new FolderStore();
		const emptyNotesStore = new NotesStore();
		const emptySelectionStore = new SelectionStore(emptyFolderStore);
		const emptyNoteService = new NoteService(
			emptyFolderStore,
			emptyNotesStore,
			emptySelectionStore
		);

		const folder = {
			id: 'folder-recovery',
			title: 'Recovery Folder',
			items: [],
			parentId: null,
			deletedAt: null,
			deletedBatchId: null,
			isFavorite: false
		};
		const note = {
			id: 'note-recovery',
			folderId: folder.id,
			title: 'Recovered Note',
			summary: 'durable summary',
			updatedAt: '2026-04-25T00:00:00.000Z',
			isFavorite: false,
			deletedAt: null,
			deletedBatchId: null
		};

		await putFolder(folder);
		await putNoteMeta(note);
		await putNoteContent(note.id, 'Content that only exists in IndexedDB');

		const json = await exportBackup(emptyNoteService, emptyFolderStore, emptyNotesStore);
		const backup = JSON.parse(json);

		expect(backup.folders).toEqual([folder]);
		expect(backup.notes).toEqual([
			{
				...note,
				content: 'Content that only exists in IndexedDB'
			}
		]);
	});

	it('imports backups durably so a fresh store initialization can reload the restored data', async () => {
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
					summary: 'Q2 priorities',
					updatedAt: '2025-04-01T00:00:00.000Z',
					isFavorite: true,
					deletedAt: null,
					deletedBatchId: null,
					content: 'Restored content'
				}
			],
			settings: {
				selectedFolderID: 'folder-1',
				selectedNoteID: 'note-1',
				sidebarWidth: 280,
				noteListWidth: 360,
				applicationTheme: 'dark',
				folderAccentColor: 'amber'
			}
		});

		await importBackup(backupJson, new FolderStore(), new NotesStore());

		expect(await getAllFolders()).toEqual([
			{
				id: 'folder-1',
				title: 'Projects',
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
				title: 'Roadmap',
				summary: 'Q2 priorities',
				updatedAt: '2025-04-01T00:00:00.000Z',
				isFavorite: true,
				deletedAt: null,
				deletedBatchId: null
			}
		]);
		expect(await getNoteContent('note-1')).toBe('Restored content');
		expect(await getAllSettings()).toEqual({
			selectedFolderID: 'folder-1',
			selectedNoteID: 'note-1',
			sidebarWidth: 280,
			noteListWidth: 360,
			applicationTheme: 'dark',
			folderAccentColor: 'amber',
			editorToolbar: null,
			enabledLanguages: null,
			imageProcessingConcurrency: null
		});

		const restoredFolders = new FolderStore();
		const restoredNotes = new NotesStore();
		await restoredFolders.init();
		await restoredNotes.init();

		expect(restoredFolders.findItemById('folder-1')?.title).toBe('Projects');
		expect(restoredNotes.getNote('note-1')?.title).toBe('Roadmap');
		expect(restoredNotes.selectedNoteID).toBe('note-1');
		await restoredNotes.loadNoteContent('note-1');
		expect(restoredNotes.getNote('note-1')?.content).toBe('Restored content');
	});
});
