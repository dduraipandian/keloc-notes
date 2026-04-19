import type { FolderStore } from '$lib/stores/folders.svelte';
import type { NoteMeta, NotesStore } from '$lib/stores/notes.svelte';
import { settingsRepository } from '$lib/infrastructure/repositories';
import type { NoteService } from '$lib/stores/services/noteService';
import { resolveProfile } from '$lib/stores/domain/profiles';
import type { FolderItem } from '$lib/stores/folders.svelte';

interface BackupPayload {
	schemaVersion: number;
	exportedAt: string;
	appVersion: string;
	folders: FolderItem[];
	notes: Array<NoteMeta & { content: string }>;
	settings: Record<string, unknown>;
}

type LegacyBackupNote = {
	title: string;
	content: string;
	folderPath?: string;
	updatedAt?: string;
};

function buildFolderPathMap(folders: FolderItem[]) {
	const byId = new Map(folders.map((folder) => [folder.id, folder]));
	const byPath = new Map<string, FolderItem>();

	for (const folder of folders) {
		const parts: string[] = [];
		let current: FolderItem | undefined = folder;

		while (current) {
			parts.unshift(current.title);
			current = current.parentId ? byId.get(current.parentId) : undefined;
		}

		byPath.set(parts.join('/'), folder);
	}

	return byPath;
}

function normalizeBackupNotes(
	notes: unknown[],
	folders: FolderItem[]
): Array<NoteMeta & { content: string }> {
	if (notes.length === 0) return [];

	if (typeof notes[0] === 'object' && notes[0] !== null && 'id' in notes[0]) {
		return notes.map((note) => {
			const typed = note as NoteMeta & { content?: string };
			return {
				id: typed.id,
				folderId: typed.folderId ?? null,
				title: typed.title ?? 'Untitled Note',
				summary: typed.summary ?? '',
				updatedAt: typed.updatedAt ?? new Date(0).toISOString(),
				isFavorite: typed.isFavorite ?? false,
				deletedAt: typed.deletedAt ?? null,
				deletedBatchId: typed.deletedBatchId ?? null,
				content: typed.content ?? ''
			};
		});
	}

	const folderPathMap = buildFolderPathMap(folders);
	return (notes as LegacyBackupNote[]).map((note) => ({
		id: crypto.randomUUID(),
		folderId: note.folderPath ? (folderPathMap.get(note.folderPath)?.id ?? null) : null,
		title: note.title ?? 'Untitled Note',
		summary: '',
		updatedAt: note.updatedAt ?? new Date(0).toISOString(),
		isFavorite: false,
		deletedAt: null,
		deletedBatchId: null,
		content: note.content ?? ''
	}));
}

export async function exportBackup(
    noteService: NoteService,
    folderStore: FolderStore,
    notesStore: NotesStore
): Promise<string> {
	const folders = Array.from(folderStore.folders.values())
		.filter((folder) => resolveProfile(folder).section === 'folders')
		.map((folder) => ({ ...folder }));
	const noteIds = Array.from(notesStore.notes.keys());
	const contents = await notesStore.getBulkNoteContents(noteIds);
	const fullNotesArr = noteIds
		.map((id) => notesStore.getNote(id))
		.filter((note): note is NonNullable<typeof note> => note != null)
		.map((note) => ({
			id: note.id,
			folderId: note.folderId ?? null,
			title: note.title,
			summary: note.summary,
			updatedAt: note.updatedAt,
			isFavorite: note.isFavorite ?? false,
			deletedAt: note.deletedAt ?? null,
			deletedBatchId: note.deletedBatchId ?? null,
			content: contents[note.id] ?? note.content ?? ''
		}));
	const settings = await settingsRepository.getAll();

	const backup: BackupPayload = {
		schemaVersion: 1,
		exportedAt: new Date().toISOString(),
		appVersion: import.meta.env.VITE_APP_VERSION || '1.0.0',
		folders,
		notes: fullNotesArr,
		settings
	};

	return JSON.stringify(backup, null, 2);
}

export async function importBackup(
    json: string,
    folderStore: FolderStore,
    notesStore: NotesStore
): Promise<void> {
	void folderStore;
	void notesStore;

	try {
		const backup: BackupPayload = JSON.parse(json);

		if (backup.schemaVersion !== 1) {
			throw new Error(`Unsupported backup schema version: ${backup.schemaVersion}`);
		}
		const folders = (backup.folders ?? [])
			.filter((folder): folder is FolderItem => typeof folder === 'object' && folder !== null && 'id' in folder)
			.filter((folder) => resolveProfile(folder).section === 'folders')
			.map((folder) => ({
				...folder,
				isFavorite: folder.isFavorite ?? false,
				deletedAt: folder.deletedAt ?? null,
				deletedBatchId: folder.deletedBatchId ?? null
			}));
		const notes = normalizeBackupNotes(backup.notes ?? [], folders);

		await settingsRepository.restore(
			folders,
			notes,
			(backup.settings ?? {}) as Record<string, unknown>
		);
	} catch (err) {
		throw new Error(`Failed to import backup: ${String(err)}`);
	}
}
