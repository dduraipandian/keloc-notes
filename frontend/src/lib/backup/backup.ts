import type { FolderStore } from '$lib/stores/folders.svelte';
import type { NoteMeta, NotesStore } from '$lib/stores/notes.svelte';
import { assetsRepository, settingsRepository } from '$lib/infrastructure/repositories';
import type { NoteService } from '$lib/stores/services/noteService';
import { resolveProfile } from '$lib/stores/domain/profiles';
import type { FolderItem } from '$lib/stores/folders.svelte';
import { hasLibraryBeenUsed, withTransaction } from '$lib/infrastructure/idbr';

type SerializedNoteAsset = {
	id: string;
	noteId: string;
	mimeType: string;
	dataBase64: string;
};

interface BackupPayload {
	schemaVersion: number;
	exportedAt: string;
	appVersion: string;
	folders: FolderItem[];
	notes: Array<NoteMeta & { content: string; assets?: SerializedNoteAsset[] }>;
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
): Array<NoteMeta & { content: string; assets?: SerializedNoteAsset[] }> {
	if (notes.length === 0) return [];

	if (typeof notes[0] === 'object' && notes[0] !== null && 'id' in notes[0]) {
		return notes.map((note) => {
			const typed = note as NoteMeta & { content?: string; assets?: SerializedNoteAsset[] };
			return {
				id: typed.id,
				folderId: typed.folderId ?? null,
				title: typed.title ?? 'Untitled Note',
				summary: typed.summary ?? '',
				updatedAt: typed.updatedAt ?? new Date(0).toISOString(),
				isFavorite: typed.isFavorite ?? false,
				deletedAt: typed.deletedAt ?? null,
				deletedBatchId: typed.deletedBatchId ?? null,
				content: typed.content ?? '',
				assets: typed.assets ?? []
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
		content: note.content ?? '',
		assets: []
	}));
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = '';
	const CHUNK_SIZE = 0x8000;

	for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
		const chunk = bytes.subarray(i, i + CHUNK_SIZE);
		binary += String.fromCharCode(...chunk);
	}

	return btoa(binary);
}

function base64ToUint8Array(dataBase64: string): Uint8Array {
	const binary = atob(dataBase64);
	const bytes = new Uint8Array(binary.length);

	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}

	return bytes;
}

async function serializeNoteAsset(asset: {
	id: string;
	noteId: string;
	mimeType: string;
	data: Blob;
}): Promise<SerializedNoteAsset> {
	const readAsDataURL = () =>
		new Promise<string>((resolve, reject) => {
			if (typeof FileReader === 'undefined') {
				reject(new Error('FileReader is unavailable.'));
				return;
			}

			const reader = new FileReader();
			reader.onload = () => resolve(String(reader.result ?? ''));
			reader.onerror = () => reject(reader.error ?? new Error('Failed to read asset blob.'));
			reader.readAsDataURL(asset.data);
		});

	const readViaFileReader = () =>
		new Promise<ArrayBuffer>((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as ArrayBuffer);
			reader.onerror = () => reject(reader.error ?? new Error('Failed to read asset blob.'));
			reader.readAsArrayBuffer(asset.data);
		});

	let dataBase64 = '';

	if (typeof FileReader !== 'undefined') {
		const dataUrl = await readAsDataURL();
		dataBase64 = dataUrl.includes(',') ? dataUrl.split(',', 2)[1] : dataUrl;
	}

	if (!dataBase64) {
		const dataBuffer =
			typeof asset.data.arrayBuffer === 'function'
				? await asset.data.arrayBuffer()
				: await readViaFileReader();
		dataBase64 = arrayBufferToBase64(dataBuffer);
	}

	if (!dataBase64 && asset.data.size > 0) {
		dataBase64 = btoa(await asset.data.text());
	}

	return {
		id: asset.id,
		noteId: asset.noteId,
		mimeType: asset.mimeType,
		dataBase64
	};
}

function deserializeNoteAsset(asset: SerializedNoteAsset): {
	id: string;
	noteId: string;
	mimeType: string;
	data: Uint8Array;
} {
	return {
		id: asset.id,
		noteId: asset.noteId,
		mimeType: asset.mimeType,
		data: base64ToUint8Array(asset.dataBase64)
	};
}

async function assertImportAllowedForNewApp(): Promise<void> {
	if (await hasLibraryBeenUsed()) {
		throw new Error('Backup import is only allowed on a new app.');
	}

	const hasExistingData = await withTransaction(
		['folders', 'notes_meta', 'notes_contents'],
		'readonly',
		async (tx) => {
			const [folderCount, noteMetaCount, noteContentCount] = await Promise.all([
				tx.objectStore('folders').count(),
				tx.objectStore('notes_meta').count(),
				tx.objectStore('notes_contents').count()
			]);

			return folderCount > 0 || noteMetaCount > 0 || noteContentCount > 0;
		}
	);

	if (hasExistingData) {
		throw new Error('Backup import is only allowed on a new app.');
	}
}

export async function exportBackup(
	noteService: NoteService,
	folderStore: FolderStore,
	notesStore: NotesStore
): Promise<string> {
	void noteService;
	const folders = Array.from(folderStore.folders.values())
		.filter((folder) => resolveProfile(folder).section === 'folders')
		.map((folder) => ({ ...folder }));
	const noteIds = Array.from(notesStore.notes.keys());
	const contents = await notesStore.getBulkNoteContents(noteIds);
	const fullNotesArr = await Promise.all(
		noteIds
			.map((id) => notesStore.getNote(id))
			.filter((note): note is NonNullable<typeof note> => note != null)
			.map(async (note) => ({
				id: note.id,
				folderId: note.folderId ?? null,
				title: note.title,
				summary: note.summary,
				updatedAt: note.updatedAt,
				isFavorite: note.isFavorite ?? false,
				deletedAt: note.deletedAt ?? null,
				deletedBatchId: note.deletedBatchId ?? null,
				content: contents[note.id] ?? note.content ?? '',
				...(await (async () => {
					const assets = await Promise.all(
						(await assetsRepository.getByNoteId(note.id)).map((asset) => serializeNoteAsset(asset))
					);
					return assets.length > 0 ? { assets } : {};
				})())
			}))
	);
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
		await assertImportAllowedForNewApp();
		const backup: BackupPayload = JSON.parse(json);

		if (backup.schemaVersion !== 1) {
			throw new Error(`Unsupported backup schema version: ${backup.schemaVersion}`);
		}
		const folders = (backup.folders ?? [])
			.filter(
				(folder): folder is FolderItem =>
					typeof folder === 'object' && folder !== null && 'id' in folder
			)
			.filter((folder) => resolveProfile(folder).section === 'folders')
			.map((folder) => ({
				...folder,
				isFavorite: folder.isFavorite ?? false,
				deletedAt: folder.deletedAt ?? null,
				deletedBatchId: folder.deletedBatchId ?? null
			}));
		const notes = normalizeBackupNotes(backup.notes ?? [], folders);
		const restoredNotes = notes.map((note) => ({
			...note,
			assets: (note.assets ?? []).map((asset) => deserializeNoteAsset(asset))
		}));

		await settingsRepository.restore(
			folders,
			restoredNotes,
			(backup.settings ?? {}) as Record<string, unknown>
		);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw new Error(`Failed to import backup: ${message}`);
	}
}
