import { openDB, type IDBPDatabase, type IDBPTransaction } from 'idb';
import type { FolderItem } from './folders.svelte';
import type { NoteItem } from './notes.svelte';
import { uiStore } from './dialog.svelte';

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

function ensureStores(db: IDBPDatabase<DBStore>) {
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

export function handleDatabaseBlocked(currentVersion: number | undefined, blockedVersion: number | null) {
	uiStore.confirmAppQuit(
		'Database blocked',
		`Another mdnotes window is open and is blocking a database upgrade (current: ${currentVersion ?? 'unknown'}, target: ${blockedVersion ?? 'unknown'}). Please close the other window and restart mdnotes.`,
		() => {}
	);
}

export function initDB() {
	if (dbPromise) return dbPromise;

	dbPromise = openDB<DBStore>(DB_NAME, DB_VERSION, {
		upgrade(db, oldVersion, newVersion) {
			switch (oldVersion) {
				case 0:
					ensureStores(db);
					// fall through to future migrations
				case 1:
					// v1 -> v2 migrations go here
					break;
				default:
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
	sidebarWidth: number | null;
	noteListWidth: number | null;
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

export async function getAllSettings(): Promise<SettingsState> {
	return await withTransaction('settings', 'readonly', async (tx) => {
		const store = tx.objectStore('settings');
		const keys = await store.getAllKeys();
		const values = await store.getAll();
		let selectedFolderID: string | null = null;
		let selectedNoteID: string | null = null;
		let sidebarWidth: number | null = null;
		let noteListWidth: number | null = null;
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
				default:
					break;
			}
		});
		return {
			selectedFolderID,
			selectedNoteID,
			sidebarWidth,
			noteListWidth
		};
	});
}

// ─────────────────────────────────────────────
// Transactional Archival/Deletion
// ─────────────────────────────────────────────

export async function permanentDeleteFolderTransactionally(
	notesToDelete: { note: NoteItem; path: string }[],
	foldersToDelete: FolderItem[],
	archivedAt: number
) {
	return await withTransaction(['folders', 'notes', 'backups'], 'readwrite', async (tx) => {
		const fStore = tx.objectStore('folders')!;
		const nStore = tx.objectStore('notes')!;
		const bStore = tx.objectStore('backups')!;

		// Backup and Delete Notes
		for (const { note, path } of notesToDelete) {
			await bStore.put!({
				id: `note_${note.id}`,
				type: 'note',
				data: note,
				path,
				archivedAt
			});
			await nStore.delete!(note.id);
		}

		// Delete Folders
		for (const f of foldersToDelete) {
			await fStore.delete!(f.id);
		}
	});
}

export async function permanentDeleteNoteTransactionally(
	note: NoteItem,
	path: string,
	archivedAt: number
) {
	return await withTransaction(['notes', 'backups'], 'readwrite', async (tx) => {
		const nStore = tx.objectStore('notes')!;
		const bStore = tx.objectStore('backups')!;

		await bStore.put!({
			id: `note_${note.id}`,
			type: 'note',
			data: note,
			path,
			archivedAt
		});
		await nStore.delete!(note.id);
	});
}
