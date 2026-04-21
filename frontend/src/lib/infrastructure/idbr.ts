import { openDB, type IDBPDatabase, type IDBPTransaction } from 'idb';
import type { FolderItem } from '../stores/folders.svelte';
import type { NoteItem } from '../stores/notes.svelte';
import type { UIStore } from '../stores/dialog.svelte';

const DEFAULT_DB_NAME = 'mdnotes-db';
const DB_VERSION = 5;

export interface DBStore {
	folders: {
		key: string;
		value: any;
	};
	notes_meta: {
		key: string;
		value: any;
	};
	notes_contents: {
		key: string;
		value: any;
	};
	settings: {
		key: string;
		value: any;
	};
	backups: {
		key: string;
		value: any;
	};
	note_assets: {
		key: string;
		value: any;
	};
}

let dbPromise: Promise<IDBPDatabase<DBStore>>;

function getDBName() {
	if (typeof window === 'undefined') return DEFAULT_DB_NAME;

	const override = (window as typeof window & { __MDNOTES_DB_NAME__?: string }).__MDNOTES_DB_NAME__;
	return typeof override === 'string' && override.length > 0 ? override : DEFAULT_DB_NAME;
}

function ensureStores(db: IDBPDatabase<DBStore>) {
	if (!db.objectStoreNames.contains('folders')) {
		db.createObjectStore('folders', { keyPath: 'id' });
	}
	if (!db.objectStoreNames.contains('notes_meta')) {
		db.createObjectStore('notes_meta', { keyPath: 'id' });
	}
	if (!db.objectStoreNames.contains('notes_contents')) {
		db.createObjectStore('notes_contents', { keyPath: 'id' });
	}
	if (!db.objectStoreNames.contains('settings')) {
		db.createObjectStore('settings');
	}
	if (!db.objectStoreNames.contains('backups')) {
		db.createObjectStore('backups', { keyPath: 'id' });
	}
	if (!db.objectStoreNames.contains('note_assets')) {
		const assetStore = db.createObjectStore('note_assets', { keyPath: 'id' });
		assetStore.createIndex('by_note', 'noteId');
	}
}

let blockedHandler: ((current: number | undefined, blocked: number | null) => void) | null = null;
const LIBRARY_HISTORY_KEY = 'libraryHasUserData';

export function setDatabaseBlockedHandler(handler: typeof blockedHandler) {
	blockedHandler = handler;
}

export function handleDatabaseBlocked(
	currentVersion: number | undefined,
	blockedVersion: number | null
) {
	blockedHandler?.(currentVersion, blockedVersion);
}

export function initDB() {
	if (dbPromise) return dbPromise;

	dbPromise = openDB<DBStore>(getDBName(), DB_VERSION, {
		upgrade(db, oldVersion, newVersion) {
			switch (oldVersion) {
				case 0:
					ensureStores(db);
					break;
				case 1:
				case 2:
					// Fresh start for v3 as per user request to ignore/clean v2 data
					if (db.objectStoreNames.contains('notes')) {
						db.deleteObjectStore('notes');
					}
					ensureStores(db);
					break;
				case 3:
				case 4:
					// v5: ensure note_assets exists for databases that reached v4
					// before the store was added in code.
					if (!db.objectStoreNames.contains('note_assets')) {
						const assetStore = db.createObjectStore('note_assets', { keyPath: 'id' });
						assetStore.createIndex('by_note', 'noteId');
					}
					break;
				default:
					ensureStores(db);
					break;
			}
		},
		blocked(currentVersion, blockedVersion) {
			handleDatabaseBlocked(currentVersion, blockedVersion);
		},
		blocking(currentVersion, blockedVersion) {
			handleDatabaseBlocked(currentVersion, blockedVersion);
		}
	});

	return dbPromise;
}

export async function getDB() {
	return await initDB();
}

// ─────────────────────────────────────────────
// Transaction Helpers
// ─────────────────────────────────────────────

/**
 * Execute a callback within a transaction.
 * Usage:
 * await withTransaction(['folders', 'notes'], 'readwrite', async (tx) => {
 *   const fStore = tx.objectStore('folders');
 *   const nStore = tx.objectStore('notes');
 *   await fStore.put(folder);
 *   await nStore.put(note);
 * });
 */
export async function withTransaction<T>(
	storeNames: string | string[],
	mode: 'readonly' | 'readwrite',
	callback: (tx: IDBPTransaction<DBStore, any, any>) => Promise<T>
): Promise<T> {
	const db = await getDB();
	const tx = db.transaction(storeNames as any, mode);
	const result = await callback(tx);
	await tx.done;
	return result;
}

// ─────────────────────────────────────────────
// Granular Folder Methods
// ─────────────────────────────────────────────

export type FolderState = {
	items: any[];
	selectedId: string | null;
};

export async function putFolder(folder: any) {
	const db = await getDB();
	return db.put('folders', folder);
}

export async function getFolder(id: string) {
	const db = await getDB();
	return db.get('folders', id);
}

export async function deleteFolder(id: string) {
	const db = await getDB();
	return db.delete('folders', id);
}

export async function getAllFolders(): Promise<FolderItem[]> {
	const db = await getDB();
	return db.getAll('folders');
}

// ─────────────────────────────────────────────
// Granular Note Methods
// ─────────────────────────────────────────────

export async function putNoteMeta(meta: any) {
	const db = await getDB();
	return db.put('notes_meta', meta);
}

export async function getNoteMeta(id: string) {
	const db = await getDB();
	return db.get('notes_meta', id);
}

export async function putNoteContent(id: string, content: string) {
	const db = await getDB();
	return db.put('notes_contents', { id, content });
}

export async function getNoteContent(id: string) {
	const db = await getDB();
	const result = await db.get('notes_contents', id);
	return result ? result.content : '';
}

export async function getBulkNoteContents(ids: string[]): Promise<Record<string, string>> {
	if (ids.length === 0) return {};
	const db = await getDB();
	const tx = db.transaction('notes_contents', 'readonly');
	const store = tx.objectStore('notes_contents');
	const results: Record<string, string> = {};
	await Promise.all(
		ids.map(async (id) => {
			const entry = await store.get(id);
			results[id] = entry ? entry.content : '';
		})
	);
	return results;
}

export async function deleteNote(id: string) {
	const db = await getDB();
	return await withTransaction(['notes_meta', 'notes_contents'], 'readwrite', async (tx) => {
		const metaStore = tx.objectStore('notes_meta');
		const contentStore = tx.objectStore('notes_contents');
		if (metaStore) await metaStore.delete!(id);
		if (contentStore) await contentStore.delete!(id);
	});
}

export async function getAllNotesMeta(): Promise<any[]> {
	const db = await getDB();
	return db.getAll('notes_meta');
}

// ─────────────────────────────────────────────
// Granular Setting Methods
// ─────────────────────────────────────────────

export type SettingsState = {
	selectedFolderID: string | null;
	selectedNoteID: string | null;
	sidebarWidth: number | null;
	noteListWidth: number | null;
	applicationTheme: 'light' | 'dark' | 'system' | null;
	folderAccentColor: string | null;
	editorToolbar: 'fixed' | 'bubble' | 'both' | null;
	enabledLanguages: string[] | null;
	imageProcessingConcurrency: number | null;
};

type SettingsKey = keyof SettingsState;

export async function putSetting(property: string, value: any) {
	const db = await getDB();
	return db.put('settings', value, property);
}

export async function getSetting(property: string) {
	const db = await getDB();
	return db.get('settings', property);
}

export async function deleteSetting(property: string) {
	const db = await getDB();
	return db.delete('settings', property);
}

export async function markLibraryAsUsed(): Promise<void> {
	if (typeof indexedDB === 'undefined') return;
	const db = await getDB();
	await db.put('settings', true, LIBRARY_HISTORY_KEY);
}

export async function hasLibraryBeenUsed(): Promise<boolean> {
	if (typeof indexedDB === 'undefined') return false;
	const db = await getDB();
	return (await db.get('settings', LIBRARY_HISTORY_KEY)) === true;
}

export async function getAllSettings(): Promise<SettingsState> {
	return await withTransaction('settings', 'readonly', async (tx) => {
		const store = tx.objectStore('settings');
		const keys = await store.getAllKeys();
		const values = await store.getAll();
		let selectedFolderID: string | null = null;
		let selectedNoteID: string | null = null;
		let sidebarWidth: number | null = null;
		let noteListWidth: number | null = null;
		let applicationTheme: 'light' | 'dark' | 'system' | null = null;
		let folderAccentColor: string | null = null;
		let editorToolbar: 'fixed' | 'bubble' | 'both' | null = null;
		let enabledLanguages: string[] | null = null;
		let imageProcessingConcurrency: number | null = null;

		keys.forEach((key, index) => {
			switch (key) {
				case 'selectedFolderID':
					selectedFolderID = (values[index] as string | null) ?? null;
					break;
				case 'selectedNoteID':
					selectedNoteID = (values[index] as string | null) ?? null;
					break;
				case 'sidebarWidth':
					sidebarWidth = (values[index] as number | null) ?? null;
					break;
				case 'noteListWidth':
					noteListWidth = (values[index] as number | null) ?? null;
					break;
				case 'applicationTheme':
					applicationTheme = (values[index] as 'light' | 'dark' | 'system' | null) ?? null;
					break;
				case 'folderAccentColor':
					folderAccentColor = (values[index] as string | null) ?? null;
					break;
				case 'editorToolbar':
					editorToolbar = (values[index] as 'fixed' | 'bubble' | 'both' | null) ?? null;
					break;
				case 'enabledLanguages':
					enabledLanguages = (values[index] as string[] | null) ?? null;
					break;
				case 'imageProcessingConcurrency':
					imageProcessingConcurrency = (values[index] as number | null) ?? null;
					break;
				default:
					break;
			}
		});
		return {
			selectedFolderID,
			selectedNoteID,
			sidebarWidth,
			noteListWidth,
			applicationTheme,
			folderAccentColor,
			editorToolbar,
			enabledLanguages,
			imageProcessingConcurrency
		};
	});
}

// ─────────────────────────────────────────────
// Note Assets Methods
// ─────────────────────────────────────────────

export async function putNoteAsset(asset: {
	id: string;
	noteId: string;
	mimeType: string;
	data: Blob | Uint8Array;
}): Promise<void> {
	const db = await getDB();
	const normalizedData =
		asset.data instanceof Blob ? await blobToUint8Array(asset.data) : asset.data;
	await db.put('note_assets', {
		...asset,
		data: normalizedData
	});
}

async function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
	if (typeof blob.arrayBuffer === 'function') {
		return new Uint8Array(await blob.arrayBuffer());
	}

	const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as ArrayBuffer);
		reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob.'));
		reader.readAsArrayBuffer(blob);
	});

	return new Uint8Array(buffer);
}

function normalizeAssetRecord(asset: {
	id: string;
	noteId: string;
	mimeType: string;
	data: Blob | Uint8Array;
}) {
	const normalizedBlob =
		asset.data instanceof Blob
			? asset.data
			: new Blob([new Uint8Array(asset.data)], { type: asset.mimeType });

	return {
		...asset,
		data: normalizedBlob
	};
}

export async function getNoteAsset(
	id: string
): Promise<{ id: string; noteId: string; mimeType: string; data: Blob } | undefined> {
	const db = await getDB();
	const asset = await db.get('note_assets', id);
	return asset ? normalizeAssetRecord(asset) : undefined;
}

export async function getNoteAssetsByNoteId(
	noteId: string
): Promise<Array<{ id: string; noteId: string; mimeType: string; data: Blob }>> {
	const db = await getDB();
	const tx = db.transaction('note_assets', 'readonly');
	const index = tx.store.index('by_note');
	const assets = await index.getAll(noteId);
	await tx.done;
	return assets.map((asset) => normalizeAssetRecord(asset));
}

export async function deleteNoteAsset(id: string): Promise<void> {
	const db = await getDB();
	await db.delete('note_assets', id);
}

export async function deleteNoteAssetsByNoteId(noteId: string): Promise<void> {
	const db = await getDB();
	const tx = db.transaction('note_assets', 'readwrite');
	const index = tx.store.index('by_note');
	const keys = await index.getAllKeys(noteId);
	await Promise.all(keys.map((k) => tx.store.delete(k)));
	await tx.done;
}

export async function restoreBackupTransactionally(
	folders: any[],
	notes: Array<{
		id: string;
		folderId: string | null;
		title: string;
		summary: string;
		updatedAt: string;
		isFavorite?: boolean;
		deletedAt?: number | null;
		deletedBatchId?: string | null;
		content: string;
		assets?: Array<{
			id: string;
			noteId: string;
			mimeType: string;
			data: Blob | Uint8Array;
		}>;
	}>,
	settings: Partial<SettingsState>
) {
	return await withTransaction(
		['folders', 'notes_meta', 'notes_contents', 'settings', 'note_assets'],
		'readwrite',
		async (tx) => {
			const folderStore = tx.objectStore('folders')!;
			const metaStore = tx.objectStore('notes_meta')!;
			const contentStore = tx.objectStore('notes_contents')!;
			const settingsStore = tx.objectStore('settings')!;
			const assetStore = tx.objectStore('note_assets')!;

			await folderStore.clear!();
			await metaStore.clear!();
			await contentStore.clear!();
			await settingsStore.clear!();
			await assetStore.clear!();

			for (const folder of folders) {
				await folderStore.put!(folder);
			}

			for (const note of notes) {
				const { content, assets = [], ...meta } = note;
				await metaStore.put!(meta);
				await contentStore.put!({ id: note.id, content });
				for (const asset of assets) {
					await assetStore.put!(asset);
				}
			}

			for (const [key, value] of Object.entries(settings)) {
				await settingsStore.put!(value, key);
			}

			await settingsStore.put!(true, LIBRARY_HISTORY_KEY);
		}
	);
}

// ─────────────────────────────────────────────
// Transactional Archival/Deletion
// ─────────────────────────────────────────────

export async function permanentDeleteFolderTransactionally(
	notesToDelete: { note: any; path: string }[],
	foldersToDelete: FolderItem[],
	archivedAt: number
) {
	return await withTransaction(
		['folders', 'notes_meta', 'notes_contents', 'backups', 'note_assets'],
		'readwrite',
		async (tx) => {
			const fStore = tx.objectStore('folders')!;
			const mStore = tx.objectStore('notes_meta')!;
			const cStore = tx.objectStore('notes_contents')!;
			const bStore = tx.objectStore('backups')!;
			const aStore = tx.objectStore('note_assets')!;
			const assetIndex = aStore.index('by_note');

			// Backup and Delete Notes
			for (const { note, path } of notesToDelete) {
				// Re-assembling for backup:
				const content = await cStore.get(note.id);
				const assets = await assetIndex.getAll(note.id);
				await bStore.put!({
					id: `note_${note.id}`,
					type: 'note',
					data: { ...note, content: content?.content ?? '', assets },
					path,
					archivedAt
				});
				for (const asset of assets) {
					await aStore.delete!(asset.id);
				}
				await mStore.delete!(note.id);
				await cStore.delete!(note.id);
			}

			// Delete Folders
			for (const f of foldersToDelete) {
				await fStore.delete!(f.id);
			}
		}
	);
}

export async function permanentDeleteNoteTransactionally(
	note: any,
	path: string,
	archivedAt: number
) {
	return await withTransaction(
		['notes_meta', 'notes_contents', 'backups', 'note_assets'],
		'readwrite',
		async (tx) => {
			const mStore = tx.objectStore('notes_meta')!;
			const cStore = tx.objectStore('notes_contents')!;
			const bStore = tx.objectStore('backups')!;
			const aStore = tx.objectStore('note_assets')!;
			const assetIndex = aStore.index('by_note');

			const contentEntry = await cStore.get(note.id);
			const content = contentEntry?.content ?? '';
			const assets = await assetIndex.getAll(note.id);

			await bStore.put!({
				id: `note_${note.id}`,
				type: 'note',
				data: { ...note, content, assets },
				path,
				archivedAt
			});
			for (const asset of assets) {
				await aStore.delete!(asset.id);
			}
			await mStore.delete!(note.id);
			await cStore.delete!(note.id);
		}
	);
}
