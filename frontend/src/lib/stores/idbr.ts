import { openDB, type IDBPDatabase, type IDBPTransaction } from 'idb';
import type { FolderItem } from './folders.svelte';

const DB_NAME = 'mdnotes-db';
const DB_VERSION = 2;

export interface DBStore {
	folders: {
		key: string;
		value: any;
	};
	notes: {
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
}

let dbPromise: Promise<IDBPDatabase<DBStore>>;

export function initDB() {
	if (dbPromise) return dbPromise;

	dbPromise = openDB<DBStore>(DB_NAME, DB_VERSION, {
		upgrade(db, oldVersion, newVersion) {
			if (!db.objectStoreNames.contains('folders')) {
				db.createObjectStore('folders', { keyPath: 'id' });
			}
			if (!db.objectStoreNames.contains('notes')) {
				db.createObjectStore('notes', { keyPath: 'id' });
			}
			if (!db.objectStoreNames.contains('settings')) {
				db.createObjectStore('settings');
			}
			if (!db.objectStoreNames.contains('backups')) {
				db.createObjectStore('backups', { keyPath: 'id' });
			}
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

export type NotesState = {
	notes: any[];
	selectedNoteId: string | null;
};

export async function putNote(note: any) {
	const db = await getDB();
	return db.put('notes', note);
}

export async function getNote(id: string) {
	const db = await getDB();
	return db.get('notes', id);
}

export async function deleteNote(id: string) {
	const db = await getDB();
	return db.delete('notes', id);
}

export async function getAllNotes(): Promise<any[]> {
	const db = await getDB();
	return db.getAll('notes');
}

// ─────────────────────────────────────────────
// Granular Setting Methods
// ─────────────────────────────────────────────

export type SettingsState = {
	selectedFolderID: string | null;
	selectedNoteID: string | null;
};

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

export async function getAllSettings(): Promise<SettingsState> {
	return await withTransaction('settings', 'readonly', async (tx) => {
		const store = tx.objectStore('settings');
		const keys = await store.getAllKeys();
		const values = await store.getAll();
		const settings: any = {};
		keys.forEach((key, index) => {
			settings[key] = values[index];
		});
		return settings as SettingsState;
	});
}

// ─────────────────────────────────────────────
// Transactional Archival/Deletion
// ─────────────────────────────────────────────

export async function permanentDeleteFolderTransactionally(
	notesToDelete: { note: any; path: string }[],
	foldersToDelete: any[],
	archivedAt: number
) {
	return await withTransaction(['folders', 'notes', 'backups'], 'readwrite', async (tx) => {
		const fStore = tx.objectStore('folders');
		const nStore = tx.objectStore('notes');
		const bStore = tx.objectStore('backups');

		// Backup and Delete Notes
		for (const { note, path } of notesToDelete) {
			await bStore.put({
				id: `note_${note.id}`,
				type: 'note',
				data: note,
				path,
				archivedAt
			});
			await nStore.delete(note.id);
		}

		// Delete Folders
		for (const f of foldersToDelete) {
			await fStore.delete(f.id);
		}
	});
}

export async function permanentDeleteNoteTransactionally(note: any, path: string, archivedAt: number) {
	return await withTransaction(['notes', 'backups'], 'readwrite', async (tx) => {
		const nStore = tx.objectStore('notes');
		const bStore = tx.objectStore('backups');

		await bStore.put({
			id: `note_${note.id}`,
			type: 'note',
			data: note,
			path,
			archivedAt
		});
		await nStore.delete(note.id);
	});
}
